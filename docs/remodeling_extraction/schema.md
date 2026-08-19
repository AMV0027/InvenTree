# InvenTree Database Schema (Statically Extracted)

This document lists the database models, their fields, descriptions, and relations extracted from the Django codebase.

## App: `build` (backend/InvenTree/build/models.py)

### Model: `Build`

**Description:** A Build object organizes the creation of new StockItem objects from other existing StockItem objects.

Attributes:
    part: The part to be built (from component BOM items)
    reference: Build order reference (required, must be unique)
    title: Brief title describing the build (optional)
    quantity: Number of units to be built
    parent: Reference to a Build object for which this Build is required
    sales_order: References to a SalesOrder object for which this Build is required (e.g. the output of this build will be used to fulfil a sales order)
    take_from: Location to take stock from to make this build (if blank, can take from anywhere)
    status: Build status code
    external: Set to indicate that this build order is fulfilled externally
    batch: Batch code transferred to build parts (optional)
    creation_date: Date the build was created (auto)
    target_date: Date the build will be overdue
    completion_date: Date the build was completed (or, if incomplete, the expected date of completion)
    link: External URL for extra information
    notes: Text notes
    completed_by: User that completed the build
    issued_by: User that issued the build
    responsible: User (or group) responsible for completing the build
    priority: Priority of the build

**Bases:** InvenTree.models.PluginValidationMixin, report.mixins.InvenTreeReportMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeTagsMixin, InvenTree.models.InvenTreeNotesMixin, InvenTree.models.ReferenceIndexingMixin, StateTransitionMixin, StatusCodeMixin, InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeTree

**Database Table:** "build_build" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `reference` | `models.CharField` | False / False | `generate_next_build_reference` |  | Build Order Reference |
| `title` | `models.CharField` | False / True | `` |  | Brief description of the build (optional) |
| `parent` | `TreeForeignKey` | True / True | `` | `self` | Build Order to which this build is allocated |
| `part` | `models.ForeignKey` | False / False | `` | `part.Part` | Select part to build |
| `sales_order` | `models.ForeignKey` | True / True | `` | `order.SalesOrder` | Sales Order to which this build is allocated |
| `take_from` | `models.ForeignKey` | True / True | `` | `stock.StockLocation` | Select location to take stock from for this build (leave blank to take from any stock location) |
| `external` | `models.BooleanField` | False / False | `False` |  | This build order is fulfilled externally |
| `destination` | `models.ForeignKey` | True / True | `` | `stock.StockLocation` | Select location where the completed items will be stored |
| `quantity` | `models.PositiveIntegerField` | False / False | `1` |  | Number of stock items to build |
| `completed` | `models.PositiveIntegerField` | False / False | `0` |  | Number of stock items which have been completed |
| `status` | `generic.states.fields.InvenTreeCustomStatusModelField` | False / False | `BuildStatus.PENDING.value` |  | Build status code |
| `batch` | `models.CharField` | True / True | `` |  | Batch code for this build output |
| `creation_date` | `models.DateField` | False / False | `` |  |  |
| `start_date` | `models.DateField` | True / True | `` |  | Scheduled start date for this build order |
| `target_date` | `models.DateField` | True / True | `` |  | Target date for build completion. Build will be overdue after this date. |
| `completion_date` | `models.DateField` | True / True | `` |  |  |
| `completed_by` | `models.ForeignKey` | True / True | `` | `User` |  |
| `issued_by` | `models.ForeignKey` | True / True | `` | `User` | User who issued this build order |
| `responsible` | `models.ForeignKey` | True / True | `` | `users.models.Owner` | User or group responsible for this build order |
| `link` | `InvenTree.fields.InvenTreeURLField` | False / True | `` |  | Link to external URL |
| `priority` | `models.PositiveIntegerField` | False / False | `0` |  | Priority of this build order |
| `project_code` | `models.ForeignKey` | True / True | `` | `ProjectCode` | Project code for this build order |

### Model: `BuildLine`

**Description:** A BuildLine object links a BOMItem to a Build.

When a new Build is created, the BuildLine objects are created automatically.
- A BuildLine entry is created for each BOM item associated with the part
- The quantity is set to the quantity required to build the part
- BuildItem objects are associated with a particular BuildLine

Once a build has been created, BuildLines can (optionally) be removed from the Build

Attributes:
    build: Link to a Build object
    bom_item: Link to a BomItem object
    quantity: Number of units required for the Build
    consumed: Number of units which have been consumed against this line item

**Bases:** report.mixins.InvenTreeReportMixin, InvenTree.models.InvenTreeModel

**Database Table:** "build_buildline" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `build` | `models.ForeignKey` | False / False | `` | `Build` | Build object |
| `bom_item` | `models.ForeignKey` | False / False | `` | `part.models.BomItem` |  |
| `quantity` | `models.DecimalField` | False / False | `1` |  | Required quantity for build order |
| `consumed` | `models.DecimalField` | False / False | `0` |  | Quantity of consumed stock |

### Model: `BuildItem`

**Description:** A BuildItem links multiple StockItem objects to a Build.

These are used to allocate part stock to a build. Once the Build is completed, the parts are removed from stock and the BuildItemAllocation objects are removed.

Attributes:
    build: Link to a Build object
    build_line: Link to a BuildLine object (this is a "line item" within a build)
    stock_item: Link to a StockItem object
    quantity: Number of units allocated
    install_into: Destination stock item (or None)

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "build_builditem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `build_line` | `models.ForeignKey` | True / False | `` | `BuildLine` |  |
| `stock_item` | `models.ForeignKey` | False / False | `` | `stock.StockItem` | Source stock item |
| `quantity` | `models.DecimalField` | False / False | `1` |  | Stock quantity to allocate to build |
| `install_into` | `models.ForeignKey` | True / True | `` | `stock.StockItem` | Destination stock item |

## App: `common` (backend/InvenTree/common/models.py)

### Model: `MetaMixin`

**Description:** A base class for InvenTree models to include shared meta fields.

Attributes:
- updated: The last time this object was updated

**Bases:** models.Model

**Database Table:** "common_metamixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `updated` | `models.DateTimeField` | True / False | `` |  | Timestamp of last update |

### Model: `UpdatedUserMixin`

**Description:** A mixin which stores additional information about the user who created or last modified the object.

**Bases:** models.Model

**Database Table:** "common_updatedusermixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `updated` | `models.DateTimeField` | True / True | `None` |  | Timestamp of last update |
| `updated_by` | `models.ForeignKey` | True / True | `` | `User` | User who last updated this object |

### Model: `ProjectCode`

**Description:** A ProjectCode is a unique identifier for a project.

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "common_projectcode" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `code` | `models.CharField` | False / False | `` |  | Unique project code |
| `description` | `models.CharField` | False / True | `` |  | Project description |
| `active` | `models.BooleanField` | False / False | `True` |  | Is this project code active? |
| `responsible` | `models.ForeignKey` | True / True | `` | `users.models.Owner` | User or group responsible for this project |

### Model: `BaseInvenTreeSetting`

**Description:** An base InvenTreeSetting object is a key:value pair used for storing single values (e.g. one-off settings values).

Attributes:
    SETTINGS: definition of all available settings
    extra_unique_fields: List of extra fields used to be unique, e.g. for PluginConfig -> plugin

**Bases:** models.Model

**Database Table:** "common_baseinventreesetting" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `key` | `models.CharField` | False / False | `` |  | Settings key |
| `value` | `models.CharField` | False / True | `` |  | Settings value |

### Model: `InvenTreeSetting`

**Description:** An InvenTreeSetting object is a key:value pair used for storing single values (e.g. one-off settings values).

The class provides a way of retrieving the value for a particular key,
even if that key does not exist.

**Bases:** BaseInvenTreeSetting

**Database Table:** "common_inventreesetting" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `key` | `models.CharField` | False / False | `` |  | Settings key |

### Model: `InvenTreeUserSetting`

**Description:** An InvenTreeSetting object with a user context.

**Bases:** BaseInvenTreeSetting

**Database Table:** "common_inventreeusersetting" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `key` | `models.CharField` | False / False | `` |  | Settings key |
| `user` | `models.ForeignKey` | True / True | `` | `User` | User |

### Model: `PriceBreak`

**Description:** Represents a PriceBreak model.

**Bases:** MetaMixin

**Database Table:** "common_pricebreak" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `quantity` | `InvenTree.fields.RoundingDecimalField` | False / False | `1` |  | Price break quantity |
| `price` | `InvenTree.fields.InvenTreeModelMoneyField` | True / False | `` |  | Unit price at specified quantity |

### Model: `WebhookEndpoint`

**Description:** Defines a Webhook endpoint.

Attributes:
    endpoint_id: Path to the webhook,
    name: Name of the webhook,
    active: Is this webhook active?,
    user: User associated with webhook,
    token: Token for sending a webhook,
    secret: Shared secret for HMAC verification,

**Bases:** models.Model

**Database Table:** "common_webhookendpoint" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `endpoint_id` | `models.CharField` | False / False | `uuid.uuid4` |  | Endpoint at which this webhook is received |
| `name` | `models.CharField` | True / True | `` |  | Name for this webhook |
| `active` | `models.BooleanField` | False / False | `True` |  | Is this webhook active |
| `user` | `models.ForeignKey` | True / True | `` | `User` | User |
| `token` | `models.CharField` | True / True | `uuid.uuid4` |  | Token for access |
| `secret` | `models.CharField` | True / True | `` |  | Shared secret for HMAC |

### Model: `WebhookMessage`

**Description:** Defines a webhook message.

Attributes:
    message_id: Unique identifier for this message,
    host: Host from which this message was received,
    header: Header of this message,
    body: Body of this message,
    endpoint: Endpoint on which this message was received,
    worked_on: Was the work on this message finished?

**Bases:** models.Model

**Database Table:** "common_webhookmessage" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `message_id` | `InvenTree.fields.InvenTreeUUIDField` | False / False | `uuid.uuid4` |  | Unique identifier for this message |
| `host` | `models.CharField` | False / False | `` |  | Host from which this message was received |
| `header` | `models.CharField` | True / True | `` |  | Header of this message |
| `body` | `models.JSONField` | True / True | `` |  | Body of this message |
| `endpoint` | `models.ForeignKey` | True / True | `` | `WebhookEndpoint` | Endpoint on which this message was received |
| `worked_on` | `models.BooleanField` | False / False | `False` |  | Was the work on this message finished? |

### Model: `NotificationEntry`

**Description:** A NotificationEntry records the last time a particular notification was sent out.

It is recorded to ensure that notifications are not sent out "too often" to users.

Attributes:
- key: A text entry describing the notification e.g. 'part.notify_low_stock'
- uid: An (optional) numerical ID for a particular instance
- date: The last time this notification was sent

**Bases:** MetaMixin

**Database Table:** "common_notificationentry" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `key` | `models.CharField` | False / False | `` |  |  |
| `uid` | `models.CharField` | False / False | `` |  |  |

### Model: `NotificationMessage`

**Description:** A NotificationMessage is a message sent to a particular user, notifying them of some important information.

Notification messages can be generated by a variety of sources.

Attributes:
    target_object: The 'target' of the notification message
    source_object: The 'source' of the notification message

**Bases:** models.Model

**Database Table:** "common_notificationmessage" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `target_content_type` | `models.ForeignKey` | False / False | `` | `ContentType` |  |
| `target_object_id` | `models.CharField` | False / False | `` |  |  |
| `target_object` | `GenericForeignKey` | False / False | `` | `target_content_type` |  |
| `source_content_type` | `models.ForeignKey` | True / True | `` | `ContentType` |  |
| `source_object_id` | `models.CharField` | True / True | `` |  |  |
| `source_object` | `GenericForeignKey` | False / False | `` | `source_content_type` |  |
| `user` | `models.ForeignKey` | True / True | `` | `User` | User |
| `category` | `models.CharField` | False / False | `` |  |  |
| `name` | `models.CharField` | False / False | `` |  |  |
| `message` | `models.CharField` | True / True | `` |  |  |
| `link` | `models.URLField` | True / True | `` |  | Optional explicit URL associated with this notification |
| `creation` | `models.DateTimeField` | False / False | `` |  |  |
| `read` | `models.BooleanField` | False / False | `False` |  |  |

### Model: `NewsFeedEntry`

**Description:** A NewsFeedEntry represents an entry on the RSS/Atom feed that is generated for InvenTree news.

Attributes:
- feed_id: Unique id for the news item
- title: Title for the news item
- link: Link to the news item
- published: Date of publishing of the news item
- author: Author of news item
- summary: Summary of the news items content
- read: Was this item already by a superuser?

**Bases:** models.Model

**Database Table:** "common_newsfeedentry" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `feed_id` | `models.CharField` | False / False | `` |  |  |
| `title` | `models.CharField` | False / False | `` |  |  |
| `link` | `models.URLField` | False / False | `` |  |  |
| `published` | `models.DateTimeField` | False / False | `` |  |  |
| `author` | `models.CharField` | False / False | `` |  |  |
| `summary` | `models.CharField` | False / False | `` |  |  |
| `read` | `models.BooleanField` | False / False | `False` |  | Was this news item read? |

### Model: `NotesImage`

**Description:** Model for storing uploading images for the 'notes' fields of various models.

Simply stores the image file, for use in the 'notes' field (of any models which support markdown).

**Bases:** models.Model

**Database Table:** "common_notesimage" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `image` | `models.ImageField` | False / False | `` |  | Image file |
| `user` | `models.ForeignKey` | True / True | `` | `User` |  |
| `date` | `models.DateTimeField` | False / False | `` |  |  |
| `model_type` | `models.CharField` | True / True | `` |  | Target model type for this image |
| `model_id` | `models.IntegerField` | True / True | `None` |  | Target model ID for this image |

### Model: `CustomUnit`

**Description:** Model for storing custom physical unit definitions.

Model Attributes:
    name: Name of the unit
    definition: Definition of the unit
    symbol: Symbol for the unit (e.g. 'm' for 'metre') (optional)

Refer to the pint documentation for further information on unit definitions.
https://pint.readthedocs.io/en/stable/advanced/defining.html

**Bases:** models.Model

**Database Table:** "common_customunit" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Unit name |
| `symbol` | `models.CharField` | False / True | `` |  | Optional unit symbol |
| `definition` | `models.CharField` | False / False | `` |  | Unit definition |

### Model: `Attachment`

**Description:** Class which represents an uploaded file attachment.

An attachment can be either an uploaded file, or an external URL.

Attributes:
    model_type: The type of model to which this attachment is linked
    model_id: The ID of the model to which this attachment is linked
    attachment: The uploaded file
    url: An external URL
    thumbnail: A generated thumbnail for the uploaded file (if applicable)
    is_image: True if this attachment is a valid image file
    comment: A comment or description for the attachment
    user: The user who uploaded the attachment
    upload_date: The date the attachment was uploaded
    file_size: The size of the uploaded file
    metadata: Arbitrary metadata for the attachment (inherit from MetadataMixin)
    tags: Tags for the attachment

**Bases:** InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeTagsMixin, InvenTree.models.InvenTreeModel

**Database Table:** "common_attachment" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `model_type` | `models.CharField` | False / False | `` |  | Target model type for image |
| `model_id` | `models.PositiveIntegerField` | False / False | `` |  |  |
| `attachment` | `models.FileField` | True / True | `` |  | Select file to attach |
| `thumbnail` | `models.ImageField` | True / True | `` |  | Thumbnail image for this attachment |
| `link` | `InvenTree.fields.InvenTreeURLField` | True / True | `` |  | Link to external URL |
| `comment` | `models.CharField` | False / True | `` |  | Attachment comment |
| `upload_user` | `models.ForeignKey` | True / True | `` | `User` | User |
| `upload_date` | `models.DateField` | True / True | `` |  | Date the file was uploaded |
| `is_image` | `models.BooleanField` | False / False | `False` |  | True if this attachment is a valid image file |
| `file_size` | `models.PositiveIntegerField` | False / False | `0` |  | File size in bytes |

### Model: `InvenTreeCustomUserStateModel`

**Description:** Custom model to extends any registered state with extra custom, user defined states.

Fields:
    reference_status: Status set that is extended with this custom state
    logical_key: State logical key that is equal to this custom state in business logic
    key: Numerical value that will be saved in the models database
    name: Name of the state (must be uppercase and a valid variable identifier)
    label: Label that will be displayed in the frontend (human readable)
    color: Color that will be displayed in the frontend

**Bases:** models.Model

**Database Table:** "common_inventreecustomuserstatemodel" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `reference_status` | `models.CharField` | False / False | `` |  | Status set that is extended with this custom state |
| `logical_key` | `models.IntegerField` | False / False | `` |  | State logical key that is equal to this custom state in business logic |
| `key` | `models.IntegerField` | False / False | `` |  | Numerical value that will be saved in the models database |
| `name` | `models.CharField` | False / False | `` |  | Name of the state |
| `label` | `models.CharField` | False / False | `` |  | Label that will be displayed in the frontend |
| `color` | `models.CharField` | False / False | `ColorEnum.secondary.value` |  | Color that will be displayed in the frontend |
| `model` | `models.ForeignKey` | True / True | `` | `ContentType` | Model this state is associated with |

### Model: `SelectionList`

**Description:** Class which represents a list of selectable items for parameters.

A lists selection options can be either manually defined, or sourced from a plugin.

Attributes:
    name: The name of the selection list
    description: A description of the selection list
    locked: Is this selection list locked (i.e. cannot be modified)?
    active: Is this selection list active?
    source_plugin: The plugin which provides the selection list
    source_string: The string representation of the selection list
    default: The default value for the selection list
    created: The date/time that the selection list was created
    last_updated: The date/time that the selection list was last updated

**Bases:** InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeModel

**Database Table:** "common_selectionlist" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Name of the selection list |
| `description` | `models.CharField` | False / True | `` |  | Description of the selection list |
| `locked` | `models.BooleanField` | False / False | `False` |  | Is this selection list locked? |
| `active` | `models.BooleanField` | False / False | `True` |  | Can this selection list be used? |
| `source_plugin` | `models.ForeignKey` | True / True | `` | `plugin.PluginConfig` | Plugin which provides the selection list |
| `source_string` | `models.CharField` | False / True | `` |  | Optional string identifying the source used for this list |
| `default` | `models.ForeignKey` | True / True | `` | `SelectionListEntry` | Default entry for this selection list |
| `created` | `models.DateTimeField` | False / False | `` |  | Date and time that the selection list was created |
| `last_updated` | `models.DateTimeField` | False / False | `` |  | Date and time that the selection list was last updated |

### Model: `SelectionListEntry`

**Description:** Class which represents a single entry in a SelectionList.

Attributes:
    list: The SelectionList to which this entry belongs
    value: The value of the selection list entry
    label: The label for the selection list entry
    description: A description of the selection list entry
    active: Is this selection list entry active?

**Bases:** models.Model

**Database Table:** "common_selectionlistentry" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `list` | `models.ForeignKey` | True / True | `` | `SelectionList` | Selection list to which this entry belongs |
| `value` | `models.CharField` | False / False | `` |  | Value of the selection list entry |
| `label` | `models.CharField` | False / False | `` |  | Label for the selection list entry |
| `description` | `models.CharField` | False / True | `` |  | Description of the selection list entry |
| `active` | `models.BooleanField` | False / False | `True` |  | Is this selection list entry active? |

### Model: `ParameterTemplate`

**Description:** A ParameterTemplate provides a template for defining parameter values against various models.

This allow for assigning arbitrary data fields against existing models,
extending their functionality beyond the built-in fields.

Attributes:
    name: The name (key) of the template
    description: A description of the template
    model_type: The type of model to which this template applies (e.g. 'part')
    units: The units associated with the template (if applicable)
    checkbox: Is this template a checkbox (boolean) type?
    choices: Comma-separated list of choices (if applicable)
    selectionlist: Optional link to a SelectionList for this template
    enabled: Is this template enabled?

**Bases:** InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeModel

**Database Table:** 'part_partparametertemplate'

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `model_type` | `models.ForeignKey` | True / True | `` | `ContentType` | Target model type for this parameter template |
| `name` | `models.CharField` | False / False | `` |  | Parameter Name |
| `units` | `models.CharField` | False / True | `` |  | Physical units for this parameter |
| `description` | `models.CharField` | False / True | `` |  | Parameter description |
| `checkbox` | `models.BooleanField` | False / False | `False` |  | Is this parameter a checkbox? |
| `choices` | `models.CharField` | False / True | `` |  | Valid choices for this parameter (comma-separated) |
| `selectionlist` | `models.ForeignKey` | True / True | `` | `SelectionList` | Selection list for this parameter |
| `enabled` | `models.BooleanField` | False / False | `True` |  | Is this parameter template enabled? |
| `unique` | `models.PositiveIntegerField` | False / False | `UniqueOptions.NONE` |  | Enforce uniqueness of linked parameter values against this template |

### Model: `Parameter`

**Description:** Class which represents a parameter value assigned to a particular model instance.

Attributes:
    model_type: The type of model to which this parameter is linked
    model_id: The ID of the model to which this parameter is linked
    template: The ParameterTemplate which defines this parameter
    data: The value of the parameter [string]
    data_numeric: Numeric value of the parameter (if applicable) [float]
    note: Optional note associated with this parameter [string]
    updated: Date/time that this parameter was last updated
    updated_by: User who last updated this parameter

**Bases:** UpdatedUserMixin, InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeModel

**Database Table:** 'part_partparameter'

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `model_type` | `models.ForeignKey` | False / False | `` | `ContentType` |  |
| `model_id` | `models.PositiveIntegerField` | False / False | `` |  | ID of the target model for this parameter |
| `content_object` | `GenericForeignKey` | False / False | `` | `model_type` |  |
| `template` | `models.ForeignKey` | False / False | `` | `ParameterTemplate` | Parameter template |
| `data` | `models.CharField` | False / False | `` |  | Parameter Value |
| `data_numeric` | `models.FloatField` | True / True | `None` |  |  |
| `note` | `models.CharField` | False / True | `` |  | Optional note field |

### Model: `BarcodeScanResult`

**Description:** Model for storing barcode scans results.

**Bases:** InvenTree.models.InvenTreeModel

**Database Table:** "common_barcodescanresult" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `data` | `models.CharField` | False / False | `` |  | Barcode data |
| `user` | `models.ForeignKey` | True / True | `` | `User` | User who scanned the barcode |
| `timestamp` | `models.DateTimeField` | False / False | `` |  | Date and time of the barcode scan |
| `endpoint` | `models.CharField` | True / True | `` |  | URL endpoint which processed the barcode |
| `context` | `models.JSONField` | True / True | `` |  | Context data for the barcode scan |
| `response` | `models.JSONField` | True / True | `` |  | Response data from the barcode scan |
| `result` | `models.BooleanField` | False / False | `False` |  | Was the barcode scan successful? |

### Model: `DataOutput`

**Description:** Model for storing generated data output from various processes.

This model is intended for storing data files which are generated by various processes,
and need to be retained for future use (e.g. download by the user).

Attributes:
    created: Date and time that the data output was created
    user: User who created the data output (if applicable)
    total: Total number of items / records in the data output
    progress: Current progress of the data output generation process
    complete: Has the data output generation process completed?
    output_type: The type of data output generated (e.g. 'label', 'report', etc)
    template_name: Name of the template used to generate the data output (if applicable)
    plugin: Key for the plugin which generated the data output (if applicable)
    output: File field for storing the generated file
    errors: JSON field for storing any errors generated during the data output generation process

**Bases:** models.Model

**Database Table:** "common_dataoutput" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `created` | `models.DateField` | False / False | `` |  |  |
| `user` | `models.ForeignKey` | True / True | `` | `User` |  |
| `total` | `models.PositiveIntegerField` | False / False | `1` |  |  |
| `progress` | `models.PositiveIntegerField` | False / False | `0` |  |  |
| `complete` | `models.BooleanField` | False / False | `False` |  |  |
| `output_type` | `models.CharField` | True / True | `` |  |  |
| `template_name` | `models.CharField` | True / True | `` |  |  |
| `plugin` | `models.CharField` | True / True | `` |  |  |
| `output` | `models.FileField` | True / True | `` |  |  |
| `errors` | `models.JSONField` | True / True | `` |  |  |

### Model: `EmailMessage`

**Description:** Model for storing email messages sent or received by the system.

Attributes:
    global_id: Unique identifier for the email message
    message_id_key: Identifier for the email message - might be supplied by external system
    thread_id_key: Identifier of thread - might be supplied by external system
    subject: Subject of the email message
    body: Body of the email message
    to: Recipient of the email message
    sender: Sender of the email message
    status: Status of the email message (e.g. 'sent', 'failed', etc)
    timestamp: Date and time that the email message left the system or was received by the system
    headers: Headers of the email message
    full_message: Full email message content
    direction: Direction of the email message (e.g. 'inbound', 'outbound')
    error_code: Error code (if applicable)
    error_message: Error message (if applicable)
    error_timestamp: Date and time of the error (if applicable)
    delivery_options: Delivery options for the email message

**Bases:** models.Model

**Database Table:** "common_emailmessage" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `global_id` | `InvenTree.fields.InvenTreeUUIDField` | False / False | `uuid.uuid4` |  | Unique identifier for this message |
| `message_id_key` | `models.CharField` | True / True | `` |  | Identifier for this message (might be supplied by external system) |
| `thread_id_key` | `models.CharField` | True / True | `` |  | Identifier for this message thread (might be supplied by external system) |
| `thread` | `models.ForeignKey` | True / True | `` | `EmailThread` | Linked thread for this message |
| `subject` | `models.CharField` | False / False | `` |  |  |
| `body` | `models.TextField` | False / False | `` |  |  |
| `to` | `models.EmailField` | False / False | `` |  |  |
| `sender` | `models.EmailField` | False / False | `` |  |  |
| `status` | `models.CharField` | True / True | `` |  |  |
| `timestamp` | `models.DateTimeField` | False / False | `` |  |  |
| `headers` | `models.JSONField` | True / True | `` |  |  |
| `full_message` | `models.TextField` | True / True | `` |  |  |
| `direction` | `models.CharField` | True / True | `` |  |  |
| `priority` | `models.IntegerField` | False / False | `` |  |  |
| `delivery_options` | `models.JSONField` | True / True | `` |  |  |
| `error_code` | `models.CharField` | True / True | `` |  |  |
| `error_message` | `models.TextField` | True / True | `` |  |  |
| `error_timestamp` | `models.DateTimeField` | True / True | `` |  |  |

### Model: `EmailThread`

**Description:** Model for storing email threads.

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "common_emailthread" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `key` | `models.CharField` | True / True | `` |  | Unique key for this thread (used to identify the thread) |
| `global_id` | `InvenTree.fields.InvenTreeUUIDField` | False / False | `uuid.uuid4` |  | Unique identifier for this thread |
| `started_internal` | `models.BooleanField` | False / False | `False` |  | Was this thread started internally? |
| `created` | `models.DateTimeField` | False / False | `` |  | Date and time that the thread was created |
| `updated` | `models.DateTimeField` | False / False | `` |  | Date and time that the thread was last updated |

## App: `company` (backend/InvenTree/company/models.py)

### Model: `Company`

**Description:** A Company object represents an external company.

It may be a supplier or a customer or a manufacturer (or a combination)

- A supplier is a company from which parts can be purchased
- A customer is a company to which parts can be sold
- A manufacturer is a company which manufactures a raw good (they may or may not be a "supplier" also)


Attributes:
    name: Brief name of the company
    description: Longer form description
    website: URL for the company website
    address: One-line string representation of primary address
    phone: contact phone number
    email: contact email address
    link: Secondary URL e.g. for link to internal Wiki page
    image: Company image / logo
    notes: Extra notes about the company
    active: boolean value, is this company active
    is_customer: boolean value, is this company a customer
    is_supplier: boolean value, is this company a supplier
    is_manufacturer: boolean value, is this company a manufacturer
    currency_code: Specifies the default currency for the company
    tax_id: Tax ID for the company

**Bases:** InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.InvenTreeNotesMixin, InvenTree.models.InvenTreeTagsMixin, report.mixins.InvenTreeReportMixin, InvenTree.models.InvenTreeImageMixin, InvenTree.models.InvenTreeMetadataModel

**Database Table:** "company_company" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Company name |
| `description` | `models.CharField` | False / True | `` |  | Description of the company |
| `website` | `InvenTreeURLField` | False / True | `` |  | Company website URL |
| `phone` | `models.CharField` | False / True | `` |  | Contact phone number |
| `email` | `models.EmailField` | True / True | `` |  | Contact email address |
| `contact` | `models.CharField` | False / True | `` |  | Point of contact |
| `link` | `InvenTreeURLField` | False / True | `` |  | Link to external company information |
| `active` | `models.BooleanField` | False / False | `True` |  | Is this company active? |
| `is_customer` | `models.BooleanField` | False / False | `False` |  | Do you sell items to this company? |
| `is_supplier` | `models.BooleanField` | False / False | `True` |  | Do you purchase items from this company? |
| `is_manufacturer` | `models.BooleanField` | False / False | `False` |  | Does this company manufacture parts? |
| `currency` | `models.CharField` | False / True | `currency_code_default` |  | Default currency used for this company |
| `tax_id` | `models.CharField` | False / True | `` |  | Company Tax ID |

### Model: `Contact`

**Description:** A Contact represents a person who works at a particular company. A Company may have zero or more associated Contact objects.

Attributes:
    company: Company link for this contact
    name: Name of the contact
    phone: contact phone number
    email: contact email
    role: position in company

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "company_contact" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `company` | `models.ForeignKey` | False / False | `` | `Company` |  |
| `name` | `models.CharField` | False / False | `` |  |  |
| `phone` | `models.CharField` | False / True | `` |  |  |
| `email` | `models.EmailField` | False / True | `` |  |  |
| `role` | `models.CharField` | False / True | `` |  |  |

### Model: `Address`

**Description:** An address represents a physical location where the company is located. It is possible for a company to have multiple locations.

Attributes:
    company: Company link for this address
    title: Human-readable name for the address
    primary: True if this is the company's primary address
    line1: First line of address
    line2: Optional line two for address
    postal_code: Postal code, city and state
    country: Location country
    shipping_notes: Notes for couriers transporting shipments to this address
    internal_shipping_notes: Internal notes regarding shipping to this address
    link: External link to additional address information

**Bases:** InvenTree.models.InvenTreeModel

**Database Table:** "company_address" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `company` | `models.ForeignKey` | False / False | `` | `Company` | Select company |
| `title` | `models.CharField` | False / False | `` |  | Title describing the address entry |
| `primary` | `models.BooleanField` | False / False | `False` |  | Set as primary address |
| `line1` | `models.CharField` | False / True | `` |  | Address line 1 |
| `line2` | `models.CharField` | False / True | `` |  | Address line 2 |
| `postal_code` | `models.CharField` | False / True | `` |  | Postal code |
| `postal_city` | `models.CharField` | False / True | `` |  | Postal code city/region |
| `province` | `models.CharField` | False / True | `` |  | State or province |
| `country` | `models.CharField` | False / True | `` |  | Address country |
| `shipping_notes` | `models.CharField` | False / True | `` |  | Notes for shipping courier |
| `internal_shipping_notes` | `models.CharField` | False / True | `` |  | Shipping notes for internal use |
| `link` | `InvenTreeURLField` | False / True | `` |  | Link to address information (external) |

### Model: `ManufacturerPart`

**Description:** Represents a unique part as provided by a Manufacturer Each ManufacturerPart is identified by a MPN (Manufacturer Part Number) Each ManufacturerPart is also linked to a Part object. A Part may be available from multiple manufacturers.

Attributes:
    part: Link to the master Part
    manufacturer: Company that manufactures the ManufacturerPart
    MPN: Manufacture part number
    link: Link to external website for this manufacturer part
    description: Descriptive notes field

**Bases:** InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeNotesMixin, InvenTree.models.InvenTreeTagsMixin, InvenTree.models.InvenTreeMetadataModel

**Database Table:** "company_manufacturerpart" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `part.Part` | Select part |
| `manufacturer` | `models.ForeignKey` | True / False | `` | `Company` | Select manufacturer |
| `MPN` | `models.CharField` | True / False | `` |  | Manufacturer Part Number |
| `link` | `InvenTreeURLField` | True / True | `` |  | URL for external manufacturer part link |
| `description` | `models.CharField` | True / True | `` |  | Manufacturer part description |

### Model: `SupplierPart`

**Description:** Represents a unique part as provided by a Supplier Each SupplierPart is identified by a SKU (Supplier Part Number) Each SupplierPart is also linked to a Part or ManufacturerPart object. A Part may be available from multiple suppliers.

Attributes:
    part: Link to the master Part (Obsolete)
    source_item: The sourcing item linked to this SupplierPart instance
    supplier: Company that supplies this SupplierPart object
    active: Boolean value, is this supplier part active
    primary: Boolean value, is this the primary supplier part for the linked Part
    SKU: Stock keeping unit (supplier part number)
    link: Link to external website for this supplier part
    description: Descriptive notes field
    note: Longer form note field
    base_cost: Base charge added to order independent of quantity e.g. "Reeling Fee"
    multiple: Multiple that the part is provided in
    packaging: packaging that the part is supplied in, e.g. "Reel"
    pack_quantity: Quantity of item supplied in a single pack (e.g. 30ml in a single tube)
    pack_quantity_native: Pack quantity, converted to "native" units of the referenced part
    updated: Date that the SupplierPart was last updated

**Bases:** InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeTagsMixin, InvenTree.models.InvenTreeNotesMixin, common.models.MetaMixin, InvenTree.models.InvenTreeModel

**Database Table:** 'part_supplierpart'

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `part.Part` | Select part |
| `supplier` | `models.ForeignKey` | False / False | `` | `Company` | Select supplier |
| `SKU` | `models.CharField` | False / False | `` |  | Supplier stock keeping unit |
| `active` | `models.BooleanField` | False / False | `True` |  | Is this supplier part active? |
| `primary` | `models.BooleanField` | False / False | `False` |  | Is this the primary supplier part for the linked Part? |
| `manufacturer_part` | `models.ForeignKey` | True / True | `` | `ManufacturerPart` | Select manufacturer part |
| `link` | `InvenTreeURLField` | True / True | `` |  | URL for external supplier part link |
| `description` | `models.CharField` | True / True | `` |  | Supplier part description |
| `note` | `models.CharField` | True / True | `` |  | Notes |
| `base_cost` | `models.DecimalField` | False / False | `0` |  | Minimum charge (e.g. stocking fee) |
| `packaging` | `models.CharField` | True / True | `` |  | Part packaging |
| `pack_quantity` | `models.CharField` | False / True | `` |  | Total quantity supplied in a single pack. Leave empty for single items. |
| `pack_quantity_native` | `RoundingDecimalField` | True / False | `1` |  |  |
| `multiple` | `models.PositiveIntegerField` | False / False | `1` |  | Order multiple |
| `available` | `models.DecimalField` | False / False | `0` |  | Quantity available from supplier |
| `availability_updated` | `models.DateTimeField` | True / True | `` |  | Date of last update of availability data |

### Model: `SupplierPriceBreak`

**Description:** Represents a quantity price break for a SupplierPart.

- Suppliers can offer discounts at larger quantities
- SupplierPart(s) may have zero-or-more associated SupplierPriceBreak(s)

Attributes:
    part: Link to a SupplierPart object that this price break applies to
    updated: Automatic DateTime field that shows last time the price break was updated
    quantity: Quantity required for price break
    cost: Cost at specified quantity
    currency: Reference to the currency of this pricebreak (leave empty for base currency)

**Bases:** common.models.PriceBreak

**Database Table:** 'part_supplierpricebreak'

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `SupplierPart` |  |

## App: `importer` (backend/InvenTree/importer/models.py)

### Model: `DataImportSession`

**Description:** Database model representing a data import session.

An initial file is uploaded, and used to populate the database.

Fields:
    timestamp: Timestamp for the import session
    data_file: FileField for the data file to import
    status: IntegerField for the status of the import session
    user: ForeignKey to the User who initiated the import
    field_defaults: JSONField for field default values - provides a backup value for a field
    field_overrides: JSONField for field override values - used to force a value for a field
    field_filters: JSONField for field filter values - optional field API filters

**Bases:** models.Model

**Database Table:** "importer_dataimportsession" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `timestamp` | `models.DateTimeField` | False / False | `` |  |  |
| `data_file` | `models.FileField` | False / False | `` |  | Data file to import |
| `columns` | `models.JSONField` | True / True | `` |  |  |
| `model_type` | `models.CharField` | False / False | `` |  | Target model type for this import session |
| `status` | `models.PositiveIntegerField` | False / False | `DataImportStatusCode.INITIAL.value` |  | Import status |
| `user` | `models.ForeignKey` | True / True | `` | `User` |  |
| `field_defaults` | `models.JSONField` | True / True | `` |  |  |
| `field_overrides` | `models.JSONField` | True / True | `` |  |  |
| `field_filters` | `models.JSONField` | True / True | `` |  |  |
| `update_records` | `models.BooleanField` | False / False | `False` |  | If enabled, existing records will be updated with new data |
| `completed_row_count_history` | `models.PositiveIntegerField` | True / True | `` |  |  |
| `row_count_history` | `models.PositiveIntegerField` | True / True | `` |  |  |

### Model: `DataImportColumnMap`

**Description:** Database model representing a mapping between a file column and serializer field.

- Each row maps a "column" (in the import file) to a "field" (in the serializer)
- Column must exist in the file
- Field must exist in the serializer (and not be read-only)

**Bases:** models.Model

**Database Table:** "importer_dataimportcolumnmap" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `session` | `models.ForeignKey` | False / False | `` | `DataImportSession` |  |
| `field` | `models.CharField` | False / False | `` |  |  |
| `column` | `models.CharField` | False / True | `` |  |  |
| `lookup_field` | `models.CharField` | True / True | `` |  | Database field to use for foreign-key lookup. Leave blank for automatic lookup. |

### Model: `DataImportRow`

**Description:** Database model representing a single row in a data import session.

Each row corresponds to a single row in the import file, and is used to populate the database.

Fields:
    session: ForeignKey to the parent DataImportSession object
    data: JSONField for the data in this row
    status: IntegerField for the status of the row import

**Bases:** models.Model

**Database Table:** "importer_dataimportrow" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `session` | `models.ForeignKey` | False / False | `` | `DataImportSession` |  |
| `row_index` | `models.PositiveIntegerField` | False / False | `0` |  |  |
| `row_data` | `models.JSONField` | True / True | `` |  |  |
| `data` | `models.JSONField` | True / True | `` |  |  |
| `errors` | `models.JSONField` | True / True | `` |  |  |
| `valid` | `models.BooleanField` | False / False | `False` |  |  |
| `complete` | `models.BooleanField` | False / False | `False` |  |  |

## App: `InvenTree` (backend/InvenTree/InvenTree/models.py)

### Model: `PluginValidationMixin`

**Description:** Mixin class which exposes the model instance to plugin validation.

Any model class which inherits from this mixin will be exposed to the plugin validation system.

**Bases:** DiffMixin

**Database Table:** "InvenTree_pluginvalidationmixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |

### Model: `MetadataMixin`

**Description:** Model mixin class which adds a JSON metadata field to a model, for use by any (and all) plugins.

The intent of this mixin is to provide a metadata field on a model instance,
for plugins to read / modify as required, to store any extra information.

The assumptions for models implementing this mixin are:

- The internal InvenTree business logic will make no use of this field
- Multiple plugins may read / write to this metadata field, and not assume they have sole rights

**Bases:** models.Model

**Database Table:** "InvenTree_metadatamixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `metadata` | `models.JSONField` | True / True | `` |  | JSON metadata field, for use by external plugins |

### Model: `ReferenceIndexingMixin`

**Description:** A mixin for keeping track of numerical copies of the "reference" field.

Here, we attempt to convert a "reference" field value (char) to an integer,
for performing fast natural sorting.

This requires extra database space (due to the extra table column),
but is required as not all supported database backends provide equivalent casting.

This mixin adds a field named 'reference_int'.

- If the 'reference' field can be cast to an integer, it is stored here
- If the 'reference' field *starts* with an integer, it is stored here
- Otherwise, we store zero

**Bases:** models.Model

**Database Table:** "InvenTree_referenceindexingmixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `reference_int` | `models.BigIntegerField` | False / False | `0` |  |  |

### Model: `InvenTreeModel`

**Description:** Base class for InvenTree models, which provides some common functionality.

Includes the following mixins by default:

- PluginValidationMixin: Provides a hook for plugins to validate model instances

**Bases:** ContentTypeMixin, PluginValidationMixin, models.Model

**Database Table:** "InvenTree_inventreemodel" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |

### Model: `InvenTreeMetadataModel`

**Description:** Base class for an InvenTree model which includes a metadata field.

**Bases:** MetadataMixin, InvenTreeModel

**Database Table:** "InvenTree_inventreemetadatamodel" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |

### Model: `InvenTreeParameterMixin`

**Description:** Provides an abstracted class for managing parameters.

Links the implementing model to the common.models.Parameter table,
and provides the following methods:

**Bases:** InvenTreePermissionCheckMixin, models.Model

**Database Table:** "InvenTree_inventreeparametermixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |

### Model: `InvenTreeAttachmentMixin`

**Description:** Provides an abstracted class for managing file attachments.

Links the implementing model to the common.models.Attachment table,
and provides the following methods:

- attachments: Return a queryset containing all attachments for this model

**Bases:** InvenTreePermissionCheckMixin

**Database Table:** "InvenTree_inventreeattachmentmixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |

### Model: `InvenTreeTree`

**Description:** Provides an abstracted self-referencing tree model, based on the MPTTModel class.

Our implementation provides the following key improvements:

- Allow tracking of separate concepts of "nodes" and "items"
- Better handling of deletion of nodes and items
- Ensure tree is correctly rebuilt after deletion and other operations
- Improved protection against recursive tree structures

**Bases:** ContentTypeMixin, MPTTModel

**Database Table:** "InvenTree_inventreetree" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |

### Model: `PathStringMixin`

**Description:** Mixin class for adding a 'pathstring' field to a model class.

The pathstring is a string representation of the path to this model instance,
which can be used for display purposes.

The pathstring is automatically generated when the model instance is saved.

**Bases:** models.Model

**Database Table:** "InvenTree_pathstringmixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Name |
| `description` | `models.CharField` | False / True | `` |  | Description (optional) |
| `parent` | `TreeForeignKey` | True / True | `` | `self` |  |
| `pathstring` | `models.CharField` | False / True | `` |  | Path |

### Model: `InvenTreeNotesMixin`

**Description:** A mixin class for adding notes functionality to a model class.

The following fields are added to any model which implements this mixin:

- notes : A text field for storing notes

**Bases:** models.Model

**Database Table:** "InvenTree_inventreenotesmixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `notes` | `InvenTree.fields.InvenTreeNotesField` | False / False | `` |  | Markdown notes (optional) |

### Model: `InvenTreeTagsMixin`

**Description:** A mixin class for adding tag functionality to a model class.

The following fields are added to any model which implements this mixin:

- tags : A text field for storing comma-separated tags

**Bases:** models.Model

**Database Table:** "InvenTree_inventreetagsmixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |

### Model: `InvenTreeBarcodeMixin`

**Description:** A mixin class for adding barcode functionality to a model class.

Two types of barcodes are supported:

- Internal barcodes (QR codes using a strictly defined format)
- External barcodes (assign third party barcode data to a model instance)

The following fields are added to any model which implements this mixin:

- barcode_data : Raw data associated with an assigned barcode
- barcode_hash : A 'hash' of the assigned barcode data used to improve matching

The barcode_model_type_code() classmethod must be implemented in the model class.

**Bases:** models.Model

**Database Table:** "InvenTree_inventreebarcodemixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `barcode_data` | `models.CharField` | False / True | `` |  | Third party barcode data |
| `barcode_hash` | `models.CharField` | False / True | `` |  | Unique hash of barcode data |

### Model: `InvenTreeImageMixin`

**Description:** A mixin class for adding image functionality to a model class.

The following fields are added to any model which implements this mixin:

- image : An image field for storing an image

**Bases:** models.Model

**Database Table:** "InvenTree_inventreeimagemixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `image` | `StdImageField` | True / True | `` |  |  |

## App: `machine` (backend/InvenTree/machine/models.py)

### Model: `MachineConfig`

**Description:** A Machine objects represents a physical machine.

**Bases:** models.Model

**Database Table:** "machine_machineconfig" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `InvenTree.fields.InvenTreeUUIDField` | False / False | `uuid.uuid4` |  |  |
| `name` | `models.CharField` | False / False | `` |  | Name of machine |
| `machine_type` | `models.CharField` | False / False | `` |  | Type of machine |
| `driver` | `models.CharField` | False / False | `` |  | Driver used for the machine |
| `active` | `models.BooleanField` | False / False | `True` |  | Machines can be disabled |

### Model: `MachineSetting`

**Description:** This models represents settings for individual machines.

**Bases:** common.models.BaseInvenTreeSetting

**Database Table:** "machine_machinesetting" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `machine_config` | `models.ForeignKey` | False / False | `` | `MachineConfig` |  |
| `config_type` | `models.CharField` | False / False | `` |  |  |

## App: `order` (backend/InvenTree/order/models.py)

### Model: `TotalPriceMixin`

**Description:** Mixin which provides 'total_price' field for an order.

**Bases:** models.Model

**Database Table:** "order_totalpricemixin" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `total_price` | `InvenTreeModelMoneyField` | True / True | `` |  | Total price for this order |
| `order_currency` | `models.CharField` | True / True | `` |  | Currency for this order (leave blank to use company default) |

### Model: `Order`

**Description:** Abstract model for an order.

Instances of this class:

- PurchaseOrder
- SalesOrder

Attributes:
    reference: Unique order number / reference / code
    description: Long form description (required)
    notes: Extra note field (optional)
    creation_date: Automatic date of order creation
    created_by: User who created this order (automatically captured)
    issue_date: Date the order was issued
    start_date: Date the order is scheduled to be started
    target_date: Expected or desired completion date
    complete_date: Date the order was completed
    responsible: User (or group) responsible for managing the order

**Bases:** StatusCodeMixin, StateTransitionMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeNotesMixin, InvenTree.models.InvenTreeTagsMixin, report.mixins.InvenTreeReportMixin, InvenTree.models.MetadataMixin, InvenTree.models.ReferenceIndexingMixin, InvenTree.models.InvenTreeModel

**Database Table:** "order_order" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `description` | `models.CharField` | False / True | `` |  | Order description (optional) |
| `project_code` | `models.ForeignKey` | True / True | `` | `common_models.ProjectCode` | Select project code for this order |
| `link` | `InvenTreeURLField` | False / True | `` |  | Link to external page |
| `start_date` | `models.DateField` | True / True | `` |  | Scheduled start date for this order |
| `target_date` | `models.DateField` | True / True | `` |  | Expected date for order delivery. Order will be overdue after this date. |
| `creation_date` | `models.DateField` | True / True | `` |  |  |
| `created_by` | `models.ForeignKey` | True / True | `` | `User` |  |
| `issue_date` | `models.DateField` | True / True | `` |  | Date order was issued |
| `updated_at` | `models.DateTimeField` | True / True | `` |  | Timestamp of last update |
| `responsible` | `models.ForeignKey` | True / True | `` | `UserModels.Owner` | User or group responsible for this order |
| `contact` | `models.ForeignKey` | True / True | `` | `Contact` | Point of contact for this order |
| `address` | `models.ForeignKey` | True / True | `` | `Address` | Company address for this order |

### Model: `PurchaseOrder`

**Description:** A PurchaseOrder represents goods shipped inwards from an external supplier.

Attributes:
    supplier: Reference to the company supplying the goods in the order
    supplier_reference: Optional field for supplier order reference code
    received_by: User that received the goods
    target_date: Expected delivery target date for PurchaseOrder completion (optional)

**Bases:** TotalPriceMixin, Order

**Database Table:** "order_purchaseorder" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `reference` | `models.CharField` | False / False | `order.validators.generate_next_purchase_order_reference` |  | Order reference |
| `status` | `InvenTreeCustomStatusModelField` | False / False | `PurchaseOrderStatus.PENDING.value` |  | Purchase order status |
| `supplier` | `models.ForeignKey` | True / False | `` | `Company` | Company from which the items are being ordered |
| `supplier_reference` | `models.CharField` | False / True | `` |  | Supplier order reference code |
| `received_by` | `models.ForeignKey` | True / True | `` | `User` |  |
| `complete_date` | `models.DateField` | True / True | `` |  | Date order was completed |
| `destination` | `TreeForeignKey` | True / True | `` | `stock.StockLocation` | Destination for received items |

### Model: `SalesOrder`

**Description:** A SalesOrder represents a list of goods shipped outwards to a customer.

**Bases:** TotalPriceMixin, Order

**Database Table:** "order_salesorder" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `reference` | `models.CharField` | False / False | `order.validators.generate_next_sales_order_reference` |  | Order reference |
| `customer` | `models.ForeignKey` | True / False | `` | `Company` | Company to which the items are being sold |
| `status` | `InvenTreeCustomStatusModelField` | False / False | `SalesOrderStatus.PENDING.value` |  | Sales order status |
| `customer_reference` | `models.CharField` | False / True | `` |  | Customer order reference code |
| `shipment_date` | `models.DateField` | True / True | `` |  |  |
| `shipped_by` | `models.ForeignKey` | True / True | `` | `User` |  |

### Model: `OrderLineItem`

**Description:** Abstract model for an order line item.

Attributes:
    quantity: Number of items
    line: The line number for this item (optional)
    line_int: An integer line number for this item (optional - used for natural sorting)
    reference: Reference text (e.g. customer reference) for this line item
    project_code: Project code associated with this line item (optional)
    note: Annotation for the item
    target_date: An (optional) date for expected shipment of this line item.

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "order_orderlineitem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `quantity` | `RoundingDecimalField` | False / False | `1` |  | Item quantity |
| `discount` | `models.DecimalField` | False / False | `0` |  | Discount percentage applied to this line item (0-100) |
| `line` | `models.CharField` | False / True | `''` |  | Line number for this item (optional) |
| `line_int` | `models.IntegerField` | False / False | `0` |  |  |
| `reference` | `models.CharField` | False / True | `` |  | Line item reference |
| `notes` | `models.CharField` | False / True | `` |  | Line item notes |
| `link` | `InvenTreeURLField` | False / True | `` |  | Link to external page |
| `target_date` | `models.DateField` | True / True | `` |  | Target date for this line item (leave blank to use the target date from the order) |
| `project_code` | `models.ForeignKey` | True / True | `` | `common_models.ProjectCode` | Select project code for this order |

### Model: `OrderExtraLine`

**Description:** Abstract Model for a single ExtraLine in a Order.

Attributes:
    price: The unit sale price for this OrderLineItem

**Bases:** OrderLineItem

**Database Table:** "order_orderextraline" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `description` | `models.CharField` | False / True | `` |  | Line item description (optional) |
| `context` | `models.JSONField` | True / True | `` |  | Additional context for this line |
| `price` | `InvenTreeModelMoneyField` | True / True | `` |  | Unit price |

### Model: `PurchaseOrderLineItem`

**Description:** Model for a purchase order line item.

Attributes:
    order: Reference to a PurchaseOrder object
    part: Reference to a SupplierPart object
    received: Number of items received
    purchase_price: Unit purchase price for this line item
    build_order: Link to an external BuildOrder to be fulfilled by this line item
    destination: Destination for received items

**Bases:** OrderLineItem

**Database Table:** "order_purchaseorderlineitem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `PurchaseOrder` | Purchase Order |
| `part` | `models.ForeignKey` | True / False | `` | `SupplierPart` | Supplier part |
| `received` | `models.DecimalField` | False / False | `0` |  | Number of items received |
| `purchase_price` | `InvenTreeModelMoneyField` | True / True | `` |  | Unit purchase price |
| `build_order` | `models.ForeignKey` | True / True | `` | `build.Build` | External Build Order to be fulfilled by this line item |
| `destination` | `TreeForeignKey` | True / True | `` | `stock.StockLocation` | Destination for received items |

### Model: `PurchaseOrderExtraLine`

**Description:** Model for a single ExtraLine in a PurchaseOrder.

Attributes:
    order: Link to the PurchaseOrder that this line belongs to

**Bases:** OrderExtraLine

**Database Table:** "order_purchaseorderextraline" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `PurchaseOrder` | Purchase Order |

### Model: `SalesOrderLineItem`

**Description:** Model for a single LineItem in a SalesOrder.

Attributes:
    order: Link to the SalesOrder that this line item belongs to
    part: Link to a Part object (may be null)
    sale_price: The unit sale price for this OrderLineItem
    shipped: The number of items which have actually shipped against this line item

**Bases:** OrderLineItem

**Database Table:** "order_salesorderlineitem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `SalesOrder` | Sales Order |
| `part` | `models.ForeignKey` | True / False | `` | `part.Part` | Part |
| `sale_price` | `InvenTreeModelMoneyField` | True / True | `` |  | Unit sale price |
| `shipped` | `RoundingDecimalField` | False / False | `0` |  | Shipped quantity |

### Model: `SalesOrderShipment`

**Description:** The SalesOrderShipment model represents a physical shipment made against a SalesOrder.

- Points to a single SalesOrder object
- Multiple SalesOrderAllocation objects point to a particular SalesOrderShipment
- When a given SalesOrderShipment is "shipped", stock items are removed from stock

Attributes:
    order: SalesOrder reference
    shipment_address: Shipping address for this shipment (optional)
    shipment_date: Date this shipment was "shipped" (or null)
    checked_by: User reference field indicating who checked this order
    reference: Custom reference text for this shipment (e.g. consignment number?)
    notes: Custom notes field for this shipment

**Bases:** InvenTree.models.InvenTreeParameterMixin, InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeTagsMixin, InvenTree.models.InvenTreeNotesMixin, report.mixins.InvenTreeReportMixin, InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeModel

**Database Table:** "order_salesordershipment" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `SalesOrder` | Sales Order |
| `shipment_address` | `models.ForeignKey` | True / True | `` | `Address` | Shipping address for this shipment |
| `shipment_date` | `models.DateField` | True / True | `` |  | Date of shipment |
| `delivery_date` | `models.DateField` | True / True | `` |  | Date of delivery of shipment |
| `checked_by` | `models.ForeignKey` | True / True | `` | `User` | User who checked this shipment |
| `reference` | `models.CharField` | False / False | `'1'` |  | Shipment number |
| `tracking_number` | `models.CharField` | False / True | `` |  | Shipment tracking information |
| `invoice_number` | `models.CharField` | False / True | `` |  | Reference number for associated invoice |
| `link` | `InvenTreeURLField` | False / True | `` |  | Link to external page |

### Model: `SalesOrderExtraLine`

**Description:** Model for a single ExtraLine in a SalesOrder.

Attributes:
    order: Link to the SalesOrder that this line belongs to

**Bases:** OrderExtraLine

**Database Table:** "order_salesorderextraline" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `SalesOrder` | Sales Order |

### Model: `SalesOrderAllocation`

**Description:** This model is used to 'allocate' stock items to a SalesOrder. Items that are "allocated" to a SalesOrder are not yet "attached" to the order, but they will be once the order is fulfilled.

Attributes:
    line: SalesOrderLineItem reference
    shipment: SalesOrderShipment reference
    item: StockItem reference
    quantity: Quantity to take from the StockItem

**Bases:** models.Model

**Database Table:** "order_salesorderallocation" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `line` | `models.ForeignKey` | False / False | `` | `SalesOrderLineItem` |  |
| `shipment` | `models.ForeignKey` | True / True | `` | `SalesOrderShipment` | Sales order shipment reference |
| `item` | `models.ForeignKey` | False / False | `` | `stock.StockItem` | Select stock item to allocate |
| `quantity` | `RoundingDecimalField` | False / False | `1` |  | Enter stock allocation quantity |

### Model: `ReturnOrder`

**Description:** A ReturnOrder represents goods returned from a customer, e.g. an RMA or warranty.

Attributes:
    customer: Reference to the customer
    sales_order: Reference to an existing SalesOrder (optional)
    status: The status of the order (refer to status_codes.ReturnOrderStatus)

**Bases:** TotalPriceMixin, Order

**Database Table:** "order_returnorder" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `reference` | `models.CharField` | False / False | `order.validators.generate_next_return_order_reference` |  | Return Order reference |
| `customer` | `models.ForeignKey` | True / False | `` | `Company` | Company from which items are being returned |
| `status` | `InvenTreeCustomStatusModelField` | False / False | `ReturnOrderStatus.PENDING.value` |  | Return order status |
| `customer_reference` | `models.CharField` | False / True | `` |  | Customer order reference code |
| `complete_date` | `models.DateField` | True / True | `` |  | Date order was completed |

### Model: `ReturnOrderLineItem`

**Description:** Model for a single LineItem in a ReturnOrder.

**Bases:** StatusCodeMixin, OrderLineItem

**Database Table:** "order_returnorderlineitem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `ReturnOrder` | Return Order |
| `item` | `models.ForeignKey` | False / False | `` | `stock.models.StockItem` | Select item to return from customer |
| `quantity` | `models.DecimalField` | False / False | `1` |  | Quantity to return |
| `received_date` | `models.DateField` | True / True | `` |  | The date this return item was received |
| `outcome` | `InvenTreeCustomStatusModelField` | False / False | `ReturnOrderLineStatus.PENDING.value` |  | Outcome for this line item |
| `price` | `InvenTreeModelMoneyField` | True / True | `` |  | Cost associated with return or repair for this line item |

### Model: `ReturnOrderExtraLine`

**Description:** Model for a single ExtraLine in a ReturnOrder.

**Bases:** OrderExtraLine

**Database Table:** "order_returnorderextraline" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `ReturnOrder` | Return Order |

### Model: `TransferOrder`

**Description:** A Transfer Order represents a request to transfer stock from one location to another. It provides a place to queue and review changes before execution.

Attributes:
    take_from: The stock location to source items from (or null to )
    destination: The stock location to move items to
    consume: Rather than move the stock, "consume" it. Helpful if you want to queue up removing stock from inventory

**Bases:** Order

**Database Table:** "order_transferorder" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `reference` | `models.CharField` | False / False | `order.validators.generate_next_transfer_order_reference` |  | Transfer Order Reference |
| `status` | `InvenTreeCustomStatusModelField` | False / False | `TransferOrderStatus.PENDING.value` |  | Transfer order status |
| `take_from` | `models.ForeignKey` | True / True | `` | `stock.StockLocation` | Source for transferred items |
| `destination` | `models.ForeignKey` | True / True | `` | `stock.StockLocation` | Destination for transferred items |
| `consume` | `models.BooleanField` | False / False | `False` |  | Rather than transfer the stock to the destination, "consume" it, by removing transferred quantity from the allocated stock item |
| `complete_date` | `models.DateField` | True / True | `` |  | Date order was completed |

### Model: `TransferOrderLineItem`

**Description:** Model for a single LineItem in a TransferOrder.

Attributes:
    order: Link to the TransferOrder that this line item belongs to
    part: Link to a Part object (may be null)
    transferred: The number of items which have actually transferred against this line item

**Bases:** OrderLineItem

**Database Table:** "order_transferorderlineitem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `order` | `models.ForeignKey` | False / False | `` | `TransferOrder` | Transfer Order |
| `part` | `models.ForeignKey` | True / False | `` | `part.Part` | Part |
| `transferred` | `RoundingDecimalField` | False / False | `0` |  | transferred quantity |

### Model: `TransferOrderAllocation`

**Description:** This model is used to 'allocate' stock items to a TransferOrder. Items that are "allocated" to a TransferOrder are not yet "attached" to the order, but they will be once the order is fulfilled.

Attributes:
    line: TransferOrderLineItem reference
    item: StockItem reference
    quantity: Quantity to take from the StockItem

**Bases:** models.Model

**Database Table:** "order_transferorderallocation" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `line` | `models.ForeignKey` | False / False | `` | `TransferOrderLineItem` |  |
| `item` | `models.ForeignKey` | False / False | `` | `stock.StockItem` | Select stock item to allocate |
| `quantity` | `RoundingDecimalField` | False / False | `1` |  | Enter stock allocation quantity |

## App: `part` (backend/InvenTree/part/models.py)

### Model: `PartCategory`

**Description:** PartCategory provides hierarchical organization of Part objects.

Attributes:
    name: Name of this category
    parent: Parent category
    default_location: Default storage location for parts in this category or child categories
    default_keywords: Default keywords for parts created in this category

**Bases:** InvenTree.models.PluginValidationMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.MetadataMixin, InvenTree.models.PathStringMixin, InvenTree.models.InvenTreeTree

**Database Table:** "part_partcategory" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `default_location` | `TreeForeignKey` | True / True | `` | `stock.StockLocation` | Default location for parts in this category |
| `structural` | `models.BooleanField` | False / False | `False` |  | Parts may not be directly assigned to a structural category, but may be assigned to child categories. |
| `default_keywords` | `models.CharField` | True / True | `` |  | Default keywords for parts in this category |
| `_icon` | `models.CharField` | True / True | `` |  | Icon (optional) |

### Model: `PartCategoryParameterTemplate`

**Description:** A PartCategoryParameterTemplate creates a unique relationship between a PartCategory and a ParameterTemplate.

Multiple ParameterTemplate instances can be associated to a PartCategory to drive a default list of parameter templates attached to a Part instance upon creation.

Attributes:
    category: Reference to a single PartCategory object
    template: Reference to a single ParameterTemplate object
    default_value: The default value for the parameter in the context of the selected category

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "part_partcategoryparametertemplate" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `category` | `models.ForeignKey` | False / False | `` | `PartCategory` | Part Category |
| `template` | `models.ForeignKey` | False / False | `` | `common.models.ParameterTemplate` |  |
| `default_value` | `models.CharField` | False / True | `` |  | Default Parameter Value |

### Model: `Part`

**Description:** The Part object represents an abstract part, the 'concept' of an actual entity.

An actual physical instance of a Part is a StockItem which is treated separately.

Parts can be used to create other parts (as part of a Bill of Materials or BOM).

Attributes:
    name: Brief name for this part
    variant: Optional variant number for this part - Must be unique for the part name
    category: The PartCategory to which this part belongs
    description: Longer form description of the part
    keywords: Optional keywords for improving part search results
    IPN: Internal part number (optional)
    revision: Part revision
    is_template: If True, this part is a 'template' part
    link: Link to an external page with more information about this part (e.g. internal Wiki)
    image: Image of this part
    default_location: Where the item is normally stored (may be null)
    default_expiry: The default expiry duration for any StockItem instances of this part
    minimum_stock: Minimum preferred quantity to keep in stock
    maximum_stock: Maximum preferred quantity to keep in stock
    units: Units of measure for this part (default='pcs')
    salable: Can this part be sold to customers?
    assembly: Can this part be build from other parts?
    component: Can this part be used to make other parts?
    purchaseable: Can this part be purchased from suppliers?
    trackable: Trackable parts can have unique serial numbers assigned, etc, etc
    testable: Testable parts can have test results recorded against their stock items
    active: Is this part active? Parts are deactivated instead of being deleted
    locked: This part is locked and cannot be edited
    virtual: Is this part "virtual"? e.g. a software product or similar
    consumable: Is this part consumable, such as glue or a fastener?
    notes: Additional notes field for this part
    creation_date: Date that this part was added to the database
    creation_user: User who added this part to the database
    responsible_owner: Owner (either user or group) which is responsible for this part (optional)

BOM (Bill of Materials) related attributes:
    bom_checksum: Checksum for the BOM of this part
    bom_validated: Boolean field indicating if the BOM is valid (checksum matches)
    bom_checked_by: User who last checked the BOM for this part
    bom_checked_date: Date when the BOM was last checked

**Bases:** InvenTree.models.PluginValidationMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeTagsMixin, InvenTree.models.InvenTreeNotesMixin, report.mixins.InvenTreeReportMixin, InvenTree.models.InvenTreeImageMixin, InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeTree

**Database Table:** "part_part" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Part name |
| `is_template` | `models.BooleanField` | False / False | `part_settings.part_template_default` |  | Is this part a template part? |
| `variant_of` | `models.ForeignKey` | True / True | `` | `part.Part` | Is this part a variant of another part? |
| `description` | `models.CharField` | False / True | `` |  | Part description (optional) |
| `keywords` | `models.CharField` | True / True | `` |  | Part keywords to improve visibility in search results |
| `category` | `TreeForeignKey` | True / True | `` | `PartCategory` | Part category |
| `IPN` | `models.CharField` | True / True | `` |  | Internal Part Number |
| `revision` | `models.CharField` | True / True | `` |  | Part revision or version number |
| `revision_of` | `models.ForeignKey` | True / True | `` | `part.Part` | Is this part a revision of another part? |
| `link` | `InvenTreeURLField` | True / True | `` |  | Link to external URL |
| `default_location` | `TreeForeignKey` | True / True | `` | `stock.StockLocation` | Where is this item normally stored? |
| `default_expiry` | `models.PositiveIntegerField` | False / False | `0` |  | Expiry time (in days) for stock items of this part |
| `minimum_stock` | `models.DecimalField` | False / False | `0` |  | Minimum allowed stock level |
| `maximum_stock` | `models.DecimalField` | False / False | `0` |  | Maximum allowed stock level |
| `units` | `models.CharField` | True / True | `''` |  | Units of measure for this part |
| `assembly` | `models.BooleanField` | False / False | `part_settings.part_assembly_default` |  | Can this part be built from other parts? |
| `component` | `models.BooleanField` | False / False | `part_settings.part_component_default` |  | Can this part be used to build other parts? |
| `trackable` | `models.BooleanField` | False / False | `part_settings.part_trackable_default` |  | Does this part have tracking for unique items? |
| `testable` | `models.BooleanField` | False / False | `False` |  | Can this part have test results recorded against it? |
| `purchaseable` | `models.BooleanField` | False / False | `part_settings.part_purchaseable_default` |  | Can this part be purchased from external suppliers? |
| `salable` | `models.BooleanField` | False / False | `part_settings.part_salable_default` |  | Can this part be sold to customers? |
| `active` | `models.BooleanField` | False / False | `True` |  | Is this part active? |
| `locked` | `models.BooleanField` | False / False | `False` |  | Locked parts cannot be edited |
| `virtual` | `models.BooleanField` | False / False | `part_settings.part_virtual_default` |  | Is this a virtual part, such as a software product or license? |
| `consumable` | `models.BooleanField` | False / False | `False` |  | Is this part consumable, such as glue or a fastener? |
| `bom_validated` | `models.BooleanField` | False / False | `False` |  | Is the BOM for this part valid? |
| `bom_checksum` | `models.CharField` | False / True | `` |  | Stored BOM checksum |
| `bom_checked_by` | `models.ForeignKey` | True / True | `` | `User` |  |
| `bom_checked_date` | `models.DateField` | True / True | `` |  |  |
| `creation_date` | `models.DateField` | True / True | `` |  |  |
| `creation_user` | `models.ForeignKey` | True / True | `` | `User` |  |
| `responsible_owner` | `models.ForeignKey` | True / True | `` | `users.models.Owner` | Owner responsible for this part |
| `base_cost` | `models.DecimalField` | False / False | `0` |  | Minimum charge (e.g. stocking fee) |
| `multiple` | `models.PositiveIntegerField` | False / False | `1` |  | Sell multiple |

### Model: `PartPricing`

**Description:** Model for caching min/max pricing information for a particular Part.

It is prohibitively expensive to calculate min/max pricing for a part "on the fly".
As min/max pricing does not change very often, we pre-calculate and cache these values.

Whenever pricing is updated, these values are re-calculated and stored.

Pricing information is cached for:

- BOM cost (min / max cost of component items)
- Purchase cost (based on purchase history)
- Internal cost (based on user-specified InternalPriceBreak data)
- Supplier price (based on supplier part data)
- Variant price (min / max cost of any variants)
- Overall best / worst (based on the values listed above)
- Sale price break min / max values
- Historical sale pricing min / max values

Note that this pricing information does not take "quantity" into account:
- This provides a simple min / max pricing range, which is quite valuable in a lot of situations
- Quantity pricing still needs to be calculated
- Quantity pricing can be viewed from the part detail page
- Detailed pricing information is very context specific in any case

**Bases:** common.models.MetaMixin

**Database Table:** "part_partpricing" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `currency` | `models.CharField` | False / False | `currency_code_default` |  | Currency used to cache pricing calculations |
| `scheduled_for_update` | `models.BooleanField` | False / False | `False` |  |  |
| `part` | `models.OneToOneField` | False / False | `` | `Part` |  |
| `bom_cost_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Minimum cost of component parts |
| `bom_cost_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Maximum cost of component parts |
| `purchase_cost_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Minimum historical purchase cost |
| `purchase_cost_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Maximum historical purchase cost |
| `internal_cost_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Minimum cost based on internal price breaks |
| `internal_cost_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Maximum cost based on internal price breaks |
| `supplier_price_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Minimum price of part from external suppliers |
| `supplier_price_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Maximum price of part from external suppliers |
| `variant_cost_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Calculated minimum cost of variant parts |
| `variant_cost_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Calculated maximum cost of variant parts |
| `override_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Override minimum cost |
| `override_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Override maximum cost |
| `overall_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Calculated overall minimum cost |
| `overall_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Calculated overall maximum cost |
| `sale_price_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Minimum sale price based on price breaks |
| `sale_price_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Maximum sale price based on price breaks |
| `sale_history_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Minimum historical sale price |
| `sale_history_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Maximum historical sale price |

### Model: `PartStocktake`

**Description:** Model representing a 'stock history' entry for a particular Part.

A 'stocktake' is a representative count of available stock:
- Performed on a given date
- Records quantity of part in stock (across multiple stock items)
- Records estimated value of "stock on hand"

**Bases:** models.Model

**Database Table:** "part_partstocktake" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `Part` | Part for stocktake |
| `item_count` | `models.IntegerField` | False / False | `1` |  | Number of individual stock entries at time of stocktake |
| `quantity` | `models.DecimalField` | False / False | `` |  | Total available stock at time of stocktake |
| `date` | `models.DateField` | False / False | `` |  | Date stocktake was performed |
| `cost_min` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Estimated minimum cost of stock on hand |
| `cost_max` | `InvenTree.fields.InvenTreeModelMoneyField` | True / True | `` |  | Estimated maximum cost of stock on hand |

### Model: `PartSellPriceBreak`

**Description:** Represents a price break for selling this part.

**Bases:** common.models.PriceBreak

**Database Table:** "part_partsellpricebreak" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `Part` |  |

### Model: `PartInternalPriceBreak`

**Description:** Represents a price break for internally selling this part.

**Bases:** common.models.PriceBreak

**Database Table:** "part_partinternalpricebreak" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `Part` |  |

### Model: `PartStar`

**Description:** A PartStar object creates a subscription relationship between a User and a Part.

It is used to designate a Part as 'subscribed' for a given User.

Attributes:
    part: Link to a Part object
    user: Link to a User object

**Bases:** models.Model

**Database Table:** "part_partstar" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `Part` |  |
| `user` | `models.ForeignKey` | False / False | `` | `User` |  |

### Model: `PartCategoryStar`

**Description:** A PartCategoryStar creates a subscription relationship between a User and a PartCategory.

Attributes:
    category: Link to a PartCategory object
    user: Link to a User object

**Bases:** models.Model

**Database Table:** "part_partcategorystar" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `category` | `models.ForeignKey` | False / False | `` | `PartCategory` |  |
| `user` | `models.ForeignKey` | False / False | `` | `User` |  |

### Model: `PartTestTemplate`

**Description:** A PartTestTemplate defines a 'template' for a test which is required to be run against a StockItem (an instance of the Part).

The test template applies "recursively" to part variants, allowing tests to be
defined in a hierarchy.

Test names are simply strings, rather than enforcing any sort of structure or pattern.
It is up to the user to determine what tests are defined (and how they are run).

To enable generation of unique lookup-keys for each test, there are some validation tests
run on the model (refer to the validate_unique function).

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "part_parttesttemplate" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `Part` |  |
| `test_name` | `models.CharField` | False / False | `` |  | Enter a name for the test |
| `key` | `models.CharField` | False / True | `` |  | Simplified key for the test |
| `description` | `models.CharField` | True / False | `` |  | Enter description for this test |
| `enabled` | `models.BooleanField` | False / False | `True` |  | Is this test enabled? |
| `required` | `models.BooleanField` | False / False | `True` |  | Is this test required to pass? |
| `requires_value` | `models.BooleanField` | False / False | `False` |  | Does this test require a value when adding a test result? |
| `requires_attachment` | `models.BooleanField` | False / False | `False` |  | Does this test require a file attachment when adding a test result? |
| `choices` | `models.CharField` | False / True | `` |  | Valid choices for this test (comma-separated) |

### Model: `BomItem`

**Description:** A BomItem links a part to its component items.

A part can have a BOM (bill of materials) which defines
which parts are required (and in what quantity) to make it.

Attributes:
    part: Link to the parent part (the part that will be produced)
    sub_part: Link to the child part (the part that will be consumed)
    raw_amount: Raw amount of 'sub_part' consumed to produce one 'part' (can be fractional, or use an associated unit)
    quantity: Numerical quantity of 'sub_parts' consumed to produce one 'part'
    optional: Boolean field describing if this BomItem is optional
    consumable: Boolean field describing if this BomItem is considered a 'consumable'
    reference: BOM reference field (e.g. part designators)
    setup_quantity: Extra required quantity for a build, to account for setup losses
    attrition: Estimated losses for a Build, expressed as a percentage (e.g. '2%')
    rounding_multiple: Rounding quantity when calculating the required quantity for a build
    piece_count: Number of pieces required (for cut-to-length items like cables, tubing).
        Total material = quantity x piece_count.
    note: Note field for this BOM item
    checksum: Validation checksum for the particular BOM line item
    validated: Boolean field indicating if this BOM item is valid (checksum matches)
    inherited: This BomItem can be inherited by the BOMs of variant parts
    allow_variants: Stock for part variants can be substituted for this BomItem

**Bases:** InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeModel

**Database Table:** "part_bomitem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | `models.ForeignKey` | False / False | `` | `Part` | Select parent part |
| `sub_part` | `models.ForeignKey` | False / False | `` | `Part` | Select part to be used in BOM |
| `raw_amount` | `models.CharField` | False / False | `` |  | Amount of sub-part consumed to produce one part |
| `quantity` | `models.DecimalField` | False / False | `1.0` |  | BOM quantity for this BOM item |
| `optional` | `models.BooleanField` | False / False | `False` |  | This BOM item is optional |
| `consumable` | `models.BooleanField` | False / False | `False` |  | This BOM item is consumable (it is not tracked in build orders) |
| `setup_quantity` | `models.DecimalField` | False / False | `0` |  | Extra required quantity for a build, to account for setup losses |
| `attrition` | `models.DecimalField` | False / False | `0` |  | Estimated attrition for a build, expressed as a percentage (0-100) |
| `rounding_multiple` | `models.DecimalField` | True / True | `None` |  | Round up required production quantity to nearest multiple of this value |
| `piece_count` | `models.PositiveIntegerField` | False / False | `1` |  | Number of pieces required (for cut-to-length items). Total material = quantity x piece_count. |
| `reference` | `models.CharField` | False / True | `` |  | BOM item reference |
| `note` | `models.CharField` | False / True | `` |  | BOM item notes |
| `checksum` | `models.CharField` | False / True | `` |  | BOM line checksum |
| `validated` | `models.BooleanField` | False / False | `False` |  | This BOM item has been validated |
| `inherited` | `models.BooleanField` | False / False | `False` |  | This BOM item is inherited by BOMs for variant parts |
| `allow_variants` | `models.BooleanField` | False / False | `False` |  | Stock items for variant parts can be used for this BOM item |

### Model: `BomItemSubstitute`

**Description:** A BomItemSubstitute provides a specification for alternative parts, which can be used in a bill of materials.

Attributes:
    bom_item: Link to the parent BomItem instance
    part: The part which can be used as a substitute

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "part_bomitemsubstitute" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `bom_item` | `models.ForeignKey` | False / False | `` | `BomItem` | Parent BOM item |
| `part` | `models.ForeignKey` | False / False | `` | `Part` | Substitute part |

### Model: `PartRelated`

**Description:** Store and handle related parts (eg. mating connector, crimps, etc.).

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "part_partrelated" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `part_1` | `models.ForeignKey` | False / False | `` | `Part` |  |
| `part_2` | `models.ForeignKey` | False / False | `` | `Part` | Select Related Part |
| `note` | `models.CharField` | False / True | `` |  | Note for this relationship |

## App: `plugin` (backend/InvenTree/plugin/models.py)

### Model: `PluginConfig`

**Description:** A PluginConfig object holds settings for plugins.

Attributes:
    key: slug of the plugin (this must be unique across all installed plugins!)
    name: Name of the plugin - serves for a manual double check  if the right plugin is used
    active: Should the plugin be loaded?

**Bases:** InvenTree.models.MetadataMixin, models.Model

**Database Table:** "plugin_pluginconfig" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `key` | `models.CharField` | False / False | `` |  | Key of plugin |
| `name` | `models.CharField` | True / True | `` |  | Name of the plugin |
| `package_name` | `models.CharField` | True / True | `` |  | Name of the installed package, if the plugin was installed via PIP |
| `active` | `models.BooleanField` | False / False | `False` |  | Is the plugin active |

### Model: `PluginSetting`

**Description:** This model represents settings for individual plugins.

**Bases:** common.models.BaseInvenTreeSetting

**Database Table:** "plugin_pluginsetting" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `plugin` | `models.ForeignKey` | False / False | `` | `PluginConfig` |  |

### Model: `PluginUserSetting`

**Description:** This model represents user-specific settings for individual plugins.

In contrast with the PluginSetting model, which holds global settings for plugins,
this model allows for user-specific settings that can be defined by each user.

**Bases:** common.models.BaseInvenTreeSetting

**Database Table:** "plugin_pluginusersetting" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `plugin` | `models.ForeignKey` | False / False | `` | `PluginConfig` |  |
| `user` | `models.ForeignKey` | False / False | `` | `User` | User |

## App: `report` (backend/InvenTree/report/models.py)

### Model: `ReportTemplateBase`

**Description:** Base class for reports, labels.

**Bases:** MetadataMixin, UpdatedUserMixin, InvenTree.models.InvenTreeModel

**Database Table:** "report_reporttemplatebase" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Template name |
| `description` | `models.CharField` | False / False | `` |  | Template description |
| `revision` | `models.PositiveIntegerField` | False / False | `1` |  | Revision number (auto-increments) |
| `attach_to_model` | `models.BooleanField` | False / False | `False` |  | Save report output as an attachment against linked model instance when printing |
| `filename_pattern` | `models.CharField` | False / False | `'output.pdf'` |  | Pattern for generating filenames |
| `enabled` | `models.BooleanField` | False / False | `True` |  | Template is enabled |
| `model_type` | `models.CharField` | False / False | `` |  | Target model type for template |
| `filters` | `models.CharField` | False / True | `` |  | Template query filters (comma-separated list of key=value pairs) |

### Model: `ReportTemplate`

**Description:** Class representing the ReportTemplate database model.

**Bases:** TemplateUploadMixin, ReportTemplateBase

**Database Table:** "report_reporttemplate" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `template` | `models.FileField` | False / False | `` |  | Template file |
| `page_size` | `models.CharField` | False / False | `report.helpers.report_page_size_default` |  | Page size for PDF reports |
| `landscape` | `models.BooleanField` | False / False | `False` |  | Render report in landscape orientation |
| `merge` | `models.BooleanField` | False / False | `False` |  | Render a single report against selected items |

### Model: `LabelTemplate`

**Description:** Class representing the LabelTemplate database model.

**Bases:** TemplateUploadMixin, ReportTemplateBase

**Database Table:** "report_labeltemplate" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `template` | `models.FileField` | False / False | `` |  | Template file |
| `width` | `models.FloatField` | False / False | `50` |  | Label width, specified in mm |
| `height` | `models.FloatField` | False / False | `20` |  | Label height, specified in mm |

### Model: `ReportSnippet`

**Description:** Report template 'snippet' which can be used to make templates that can then be included in other reports.

Useful for 'common' template actions, sub-templates, etc

**Bases:** TemplateUploadMixin, models.Model

**Database Table:** "report_reportsnippet" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `snippet` | `models.FileField` | False / False | `` |  | Report snippet file |
| `description` | `models.CharField` | False / False | `` |  | Snippet file description |

### Model: `ReportAsset`

**Description:** Asset file for use in report templates.

For example, an image to use in a header file.
Uploaded asset files appear in MEDIA_ROOT/report/assets,
and can be loaded in a template using the {% report_asset <filename> %} tag.

**Bases:** TemplateUploadMixin, models.Model

**Database Table:** "report_reportasset" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `asset` | `models.FileField` | False / False | `` |  | Report asset file |
| `description` | `models.CharField` | False / False | `` |  | Asset file description |

## App: `stock` (backend/InvenTree/stock/models.py)

### Model: `StockLocationType`

**Description:** A type of stock location like Warehouse, room, shelf, drawer.

Attributes:
    name: brief name
    description: longer form description
    icon: icon class

**Bases:** InvenTree.models.MetadataMixin, models.Model

**Database Table:** "stock_stocklocationtype" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Name |
| `description` | `models.CharField` | False / True | `` |  | Description (optional) |
| `icon` | `models.CharField` | False / True | `` |  | Default icon for all locations that have no icon set (optional) |

### Model: `StockLocation`

**Description:** Organization tree for StockItem objects.

A "StockLocation" can be considered a warehouse, or storage location
Stock locations can be hierarchical as required

**Bases:** InvenTree.models.PluginValidationMixin, InvenTree.models.InvenTreeParameterMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeTagsMixin, report.mixins.InvenTreeReportMixin, InvenTree.models.PathStringMixin, InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeTree

**Database Table:** "stock_stocklocation" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `custom_icon` | `models.CharField` | True / True | `` |  | Icon (optional) |
| `owner` | `models.ForeignKey` | True / True | `` | `Owner` | Select Owner |
| `structural` | `models.BooleanField` | False / False | `False` |  | Stock items may not be directly located into a structural stock locations, but may be located to child locations. |
| `external` | `models.BooleanField` | False / False | `False` |  | This is an external stock location |
| `location_type` | `models.ForeignKey` | True / True | `` | `StockLocationType` | Stock location type of this location |

### Model: `StockItem`

**Description:** A StockItem object represents a quantity of physical instances of a part.

Attributes:
    parent: Link to another StockItem from which this StockItem was created
    part: Link to the master abstract part that this StockItem is an instance of
    supplier_part: Link to a specific SupplierPart (optional)
    location: Where this StockItem is located
    quantity: Number of stocked units
    batch: Batch number for this StockItem
    serial: Unique serial number for this StockItem
    link: Optional URL to link to external resource
    creation_date: Date that this stock item was created (auto)
    updated: Date that the quantity of this stock item was last updated (auto)
    expiry_date: Expiry date of the StockItem (optional)
    stocktake_date: Date of last stocktake for this item
    stocktake_user: User that performed the most recent stocktake
    delete_on_deplete: If True, StockItem will be deleted when the stock level gets to zero
    status: Status of this StockItem (ref: stock.status_codes.StockStatus)
    notes: Extra notes field
    build: Link to a Build (if this stock item was created from a build)
    is_building: Boolean field indicating if this stock item is currently being built (or is "in production")
    purchase_order: Link to a PurchaseOrder (if this stock item was created from a PurchaseOrder)
    sales_order: Link to a SalesOrder object (if the StockItem has been assigned to a SalesOrder)
    purchase_price: The unit purchase price for this StockItem - this is the unit price at time of purchase (if this item was purchased from an external supplier)
    packaging: Description of how the StockItem is packaged (e.g. "reel", "loose", "tape" etc)

**Bases:** InvenTree.models.InvenTreeAttachmentMixin, InvenTree.models.InvenTreeBarcodeMixin, InvenTree.models.InvenTreeNotesMixin, InvenTree.models.InvenTreeTagsMixin, StatusCodeMixin, report.mixins.InvenTreeReportMixin, common.models.MetaMixin, InvenTree.models.MetadataMixin, InvenTree.models.InvenTreeModel

**Database Table:** "stock_stockitem" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `parent` | `models.ForeignKey` | True / True | `` | `stock.StockItem` |  |
| `part` | `models.ForeignKey` | False / False | `` | `part.Part` | Base part |
| `supplier_part` | `models.ForeignKey` | True / True | `` | `company.SupplierPart` | Select a matching supplier part for this stock item |
| `location` | `TreeForeignKey` | True / True | `` | `StockLocation` | Where is this stock item located? |
| `packaging` | `models.CharField` | True / True | `` |  | Packaging this stock item is stored in |
| `belongs_to` | `models.ForeignKey` | True / True | `` | `self` | Is this item installed in another item? |
| `customer` | `models.ForeignKey` | True / True | `` | `CompanyModels.Company` | Customer |
| `serial` | `models.CharField` | True / True | `` |  | Serial number for this item |
| `serial_int` | `models.IntegerField` | False / False | `0` |  |  |
| `link` | `InvenTreeURLField` | False / True | `` |  | Link to external URL |
| `batch` | `models.CharField` | True / True | `generate_batch_code` |  | Batch code for this stock item |
| `quantity` | `models.DecimalField` | False / False | `1` |  |  |
| `build` | `models.ForeignKey` | True / True | `` | `build.Build` | Build for this stock item |
| `consumed_by` | `models.ForeignKey` | True / True | `` | `build.Build` | Build order which consumed this stock item |
| `is_building` | `models.BooleanField` | False / False | `False` |  |  |
| `purchase_order` | `models.ForeignKey` | True / True | `` | `order.PurchaseOrder` | Purchase order for this stock item |
| `sales_order` | `models.ForeignKey` | True / True | `` | `order.SalesOrder` |  |
| `expiry_date` | `models.DateField` | True / True | `` |  | Expiry date for stock item. Stock will be considered expired after this date |
| `stocktake_date` | `models.DateField` | True / True | `` |  |  |
| `stocktake_user` | `models.ForeignKey` | True / True | `` | `User` |  |
| `creation_date` | `models.DateTimeField` | True / True | `` |  | Date that this stock item was created |
| `delete_on_deplete` | `models.BooleanField` | False / False | `default_delete_on_deplete` |  | Delete this Stock Item when stock is depleted |
| `status` | `InvenTreeCustomStatusModelField` | False / False | `StockStatus.OK.value` |  |  |
| `purchase_price` | `InvenTreeModelMoneyField` | True / True | `` |  | Single unit purchase price at time of purchase |
| `owner` | `models.ForeignKey` | True / True | `` | `Owner` | Select Owner |

### Model: `StockItemTracking`

**Description:** Stock tracking entry - used for tracking history of a particular StockItem.

Attributes:
    item: ForeignKey reference to a particular StockItem
    part: ForeignKey reference to the Part associated with this StockItem
    date: Date that this tracking info was created
    tracking_type: The type of tracking information
    notes: Associated notes (input by user)
    user: The user associated with this tracking info
    deltas: The changes associated with this history item

Notes:
    If the underlying stock item is deleted, the "item" field will be set to null, but the tracking information will be retained.
    The tracking data will be removed if the associated part is deleted, as the tracking information is not relevant without the part context.

**Bases:** InvenTree.models.InvenTreeModel

**Database Table:** "stock_stockitemtracking" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `tracking_type` | `models.IntegerField` | False / False | `StockHistoryCode.LEGACY` |  |  |
| `item` | `models.ForeignKey` | True / False | `` | `StockItem` |  |
| `part` | `models.ForeignKey` | True / True | `` | `part.part` |  |
| `date` | `models.DateTimeField` | False / False | `` |  |  |
| `notes` | `models.CharField` | True / True | `` |  | Entry notes |
| `user` | `models.ForeignKey` | True / True | `` | `User` |  |
| `deltas` | `models.JSONField` | True / True | `` |  |  |

### Model: `StockItemTestResult`

**Description:** A StockItemTestResult records results of custom tests against individual StockItem objects.

This is useful for tracking unit acceptance tests, and particularly useful when integrated
with automated testing setups.

Multiple results can be recorded against any given test, allowing tests to be run many times.

Attributes:
    stock_item: Link to StockItem
    template: Link to TestTemplate
    result: Test result value (pass / fail / etc)
    value: Recorded test output value (optional)
    attachment: Link to StockItem attachment (optional)
    notes: Extra user notes related to the test (optional)
    test_station: the name of the test station where the test was performed
    started_datetime: Date when the test was started
    finished_datetime: Date when the test was finished
    user: User who uploaded the test result
    date: Date the test result was recorded

**Bases:** InvenTree.models.InvenTreeMetadataModel

**Database Table:** "stock_stockitemtestresult" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `stock_item` | `models.ForeignKey` | False / False | `` | `StockItem` |  |
| `template` | `models.ForeignKey` | False / False | `` | `part.parttesttemplate` |  |
| `result` | `models.BooleanField` | False / False | `False` |  | Test result |
| `value` | `models.CharField` | False / True | `` |  | Test output value |
| `attachment` | `models.FileField` | True / True | `` |  | Test result attachment |
| `notes` | `models.CharField` | False / True | `` |  | Test notes |
| `user` | `models.ForeignKey` | True / True | `` | `User` |  |
| `test_station` | `models.CharField` | False / True | `` |  | The identifier of the test station where the test was performed |
| `started_datetime` | `models.DateTimeField` | True / True | `` |  | The timestamp of the test start |
| `finished_datetime` | `models.DateTimeField` | True / True | `` |  | The timestamp of the test finish |
| `date` | `models.DateTimeField` | False / False | `InvenTree.helpers.current_time` |  |  |

## App: `users` (backend/InvenTree/users/models.py)

### Model: `ApiToken`

**Description:** Extends the default token model provided by djangorestframework.authtoken.

Extensions:
- Adds an 'expiry' date - tokens can be set to expire after a certain date
- Adds a 'name' field - tokens can be given a custom name (in addition to the user information)

**Bases:** AuthToken, InvenTree.models.MetadataMixin

**Database Table:** "users_apitoken" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `key` | `models.CharField` | False / False | `default_token` |  |  |
| `user` | `models.ForeignKey` | False / False | `` | `settings.AUTH_USER_MODEL` |  |
| `name` | `models.CharField` | False / True | `` |  | Custom token name |
| `expiry` | `models.DateField` | False / False | `default_token_expiry` |  | Token expiry date |
| `last_seen` | `models.DateField` | True / True | `` |  | Last time the token was used |
| `revoked` | `models.BooleanField` | False / False | `False` |  | Token has been revoked |

### Model: `RuleSet`

**Description:** A RuleSet is somewhat like a superset of the django permission class, in that in encapsulates a bunch of permissions.

There are *many* apps models used within InvenTree,
so it makes sense to group them into "roles".

These roles translate (roughly) to the menu options available.

Each role controls permissions for a number of database tables,
which are then handled using the normal django permissions approach.

**Bases:** models.Model

**Database Table:** "users_ruleset" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | `models.CharField` | False / False | `` |  | Permission set |
| `group` | `models.ForeignKey` | False / False | `` | `Group` | Group |
| `can_view` | `models.BooleanField` | False / False | `False` |  | Permission to view items |
| `can_add` | `models.BooleanField` | False / False | `False` |  | Permission to add items |
| `can_change` | `models.BooleanField` | False / False | `False` |  | Permissions to edit items |
| `can_delete` | `models.BooleanField` | False / False | `False` |  | Permission to delete items |

### Model: `Owner`

**Description:** The Owner class is a proxy for a Group or User instance.

Owner can be associated to any InvenTree model (part, stock, build, etc.)

owner_type: Model type (Group or User)
owner_id: Group or User instance primary key
owner: Returns the Group or User instance combining the owner_type and owner_id fields

**Bases:** models.Model

**Database Table:** "users_owner" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `owner_type` | `models.ForeignKey` | True / True | `` | `ContentType` |  |
| `owner_id` | `models.PositiveIntegerField` | True / True | `` |  |  |
| `owner` | `GenericForeignKey` | False / False | `` | `owner_type` |  |

### Model: `UserProfile`

**Description:** Model to store additional user profile information.

**Bases:** InvenTree.models.MetadataMixin

**Database Table:** "users_userprofile" (default)

| Field Name | Field Type | Null / Blank | Default | Relates To | Description |
| --- | --- | --- | --- | --- | --- |
| `user` | `models.OneToOneField` | False / False | `` | `User` |  |
| `language` | `models.CharField` | True / True | `` |  | Preferred language for the user |
| `theme` | `models.JSONField` | True / True | `` |  | Settings for the web UI as JSON - do not edit manually! |
| `widgets` | `models.JSONField` | True / True | `` |  | Settings for the dashboard widgets as JSON - do not edit manually! |
| `displayname` | `models.CharField` | True / True | `` |  | Chosen display name for the user |
| `position` | `models.CharField` | True / True | `` |  | Main job title or position |
| `status` | `models.CharField` | True / True | `` |  | User status message |
| `location` | `models.CharField` | True / True | `` |  | User location information |
| `active` | `models.BooleanField` | False / False | `True` |  | User is actively using the system |
| `contact` | `models.CharField` | True / True | `` |  | Preferred contact information for the user |
| `type` | `models.CharField` | False / False | `UserType.INTERNAL` |  | Which type of user is this? |
| `organisation` | `models.CharField` | True / True | `` |  | Users primary organisation/affiliation |
| `primary_group` | `models.ForeignKey` | True / True | `` | `Group` | Primary group for the user |

