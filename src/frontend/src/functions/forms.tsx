import { invalidResponse, permissionDenied } from '@lib/functions/Notification';
import type { ApiFormFieldSet, ApiFormFieldType } from '@lib/types/Forms';
import type { AxiosResponse } from 'axios';

/**
 * Extract the available fields (for a given method) from the response object
 *
 * @returns - A list of field definitions, or null if there was an error
 */
export function extractAvailableFields(
  response: AxiosResponse,
  method?: string,
  hideErrors?: boolean
): Record<string, ApiFormFieldType> | null {
  // OPTIONS request *must* return 200 status
  if (response.status !== 200) {
    invalidResponse(response.status);
    return null;
  }

  const actions: any = response.data?.actions ?? null;

  if (!method || !actions) {
    return null;
  }

  method = method.toUpperCase();

  // PATCH method is supported, but metadata is provided via PUT
  if (method === 'PATCH') {
    method = 'PUT';
  }

  if (!(method in actions)) {
    // Missing method - this means user does not have appropriate permission
    if (!hideErrors) {
      permissionDenied();
    }
    return null;
  }

  const processField = (field: any, fieldName: string) => {
    const resField: ApiFormFieldType = {
      ...field,
      name: fieldName,
      field_type: field.type,
      description: field.help_text,
      value: field.value ?? field.default,
      disabled: field.read_only ?? false
    };

    // Remove the 'read_only' field - plays havoc with react components
    delete resField.read_only;

    if (resField.field_type === 'nested object' && resField.children) {
      resField.children = processFields(resField.children, fieldName);
    }

    if (resField.field_type === 'dependent field' && resField.child) {
      resField.child = processField(resField.child, fieldName);

      // copy over the label from the dependent field to the child field
      if (!resField.child.label) {
        resField.child.label = resField.label;
      }
    }

    return resField;
  };

  const processFields = (fields: any, _path?: string) => {
    const _fields: ApiFormFieldSet = {};

    for (const [fieldName, field] of Object.entries(fields) as any) {
      const path = _path ? `${_path}.${fieldName}` : fieldName;
      _fields[fieldName] = processField(field, path);
    }

    return _fields;
  };

  return processFields(actions[method]);
}

/*
 * Build a complete field definition based on the provided data
 */
export function constructField({
  field,
  definition,
  fieldName
}: {
  field: ApiFormFieldType;
  definition?: ApiFormFieldType;
  fieldName?: string;
}) {
  const def = {
    ...definition,
    ...field
  };

  const name = fieldName || def.name;

  if (!def.field_type) {
    if (typeof def.value === 'boolean' || typeof def.default === 'boolean') {
      def.field_type = 'boolean';
    } else if (def.choices) {
      def.field_type = 'choice';
    } else if (name && (name.endsWith('_date') || name.endsWith('Date') || name === 'date')) {
      def.field_type = 'date';
    } else if (name && ['category', 'part', 'location', 'default_location', 'supplier', 'manufacturer', 'responsible', 'variant_of', 'revision_of', 'sub_part', 'order', 'destination'].includes(name)) {
      def.field_type = 'related field';
    } else if (name && ['quantity', 'price', 'purchase_price', 'amount', 'minimum_stock', 'maximum_stock'].includes(name)) {
      def.field_type = 'string'; // Usually parsed as string/number in UI
    } else {
      def.field_type = 'string';
    }
  }

  if (!def.label && name) {
    def.label = name.split('_').map(word => {
      // Keep things like IPN uppercase
      if (word.toUpperCase() === word && word.length > 1 && !/\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }

  switch (def.field_type) {
    case 'nested object':
      def.children = {};
      for (const k of Object.keys(field.children ?? {})) {
        def.children[k] = constructField({
          field: field.children?.[k] ?? {},
          definition: definition?.children?.[k] ?? {},
          fieldName: k
        });
      }
      break;
    case 'dependent field':
      if (!definition?.child) break;

      def.child = constructField({
        // use the raw definition here as field, since a dependent field cannot be influenced by the frontend
        field: definition.child ?? {},
        fieldName: name
      });
      break;
    default:
      break;
  }

  // Clear out the 'read_only' attribute
  def.disabled = def.disabled ?? def.read_only ?? false;
  delete def['read_only'];

  return def;
}
