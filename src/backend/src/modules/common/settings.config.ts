// Auto-generated settings definition
export const SYSTEM_SETTINGS: Record<string, { type: 'string' | 'number' | 'boolean', default: any }> = {
  "SERVER_RESTART_REQUIRED": {
    "type": "boolean",
    "default": false
  },
  "_PENDING_MIGRATIONS": {
    "type": "number",
    "default": "0"
  },
  "INVENTREE_INSTANCE_ID": {
    "type": "string",
    "default": "default_uuid4"
  },
  "INVENTREE_ANNOUNCE_ID": {
    "type": "boolean",
    "default": false
  },
  "INVENTREE_INSTANCE": {
    "type": "string",
    "default": "InvenTree"
  },
  "INVENTREE_INSTANCE_TITLE": {
    "type": "boolean",
    "default": false
  },
  "INVENTREE_RESTRICT_ABOUT": {
    "type": "boolean",
    "default": false
  },
  "INVENTREE_SHOW_SUPERUSER_BANNER": {
    "type": "boolean",
    "default": true
  },
  "INVENTREE_SHOW_ADMIN_BANNER": {
    "type": "boolean",
    "default": false
  },
  "INVENTREE_COMPANY_NAME": {
    "type": "string",
    "default": "My company name"
  },
  "INVENTREE_BASE_URL": {
    "type": "string",
    "default": ""
  },
  "INVENTREE_DEFAULT_CURRENCY": {
    "type": "string",
    "default": "USD"
  },
  "CURRENCY_CODES": {
    "type": "string",
    "default": "common.currency.currency_codes_default_list()"
  },
  "CURRENCY_UPDATE_INTERVAL": {
    "type": "string",
    "default": "1"
  },
  "CURRENCY_UPDATE_PLUGIN": {
    "type": "string",
    "default": "inventreecurrencyexchange"
  },
  "INVENTREE_UPLOAD_MAX_SIZE": {
    "type": "string",
    "default": "10"
  },
  "INVENTREE_STRICT_URLS": {
    "type": "boolean",
    "default": true
  },
  "INVENTREE_UPDATE_CHECK_INTERVAL": {
    "type": "string",
    "default": "7"
  },
  "INVENTREE_BACKUP_ENABLE": {
    "type": "boolean",
    "default": false
  },
  "INVENTREE_BACKUP_DAYS": {
    "type": "string",
    "default": "1"
  },
  "INVENTREE_DELETE_TASKS_DAYS": {
    "type": "string",
    "default": "30"
  },
  "INVENTREE_DELETE_ERRORS_DAYS": {
    "type": "string",
    "default": "30"
  },
  "INVENTREE_DELETE_NOTIFICATIONS_DAYS": {
    "type": "string",
    "default": "30"
  },
  "INVENTREE_DELETE_EMAIL_DAYS": {
    "type": "string",
    "default": "30"
  },
  "INVENTREE_PROTECT_EMAIL_LOG": {
    "type": "boolean",
    "default": false
  },
  "BARCODE_ENABLE": {
    "type": "boolean",
    "default": true
  },
  "BARCODE_STORE_RESULTS": {
    "type": "boolean",
    "default": false
  },
  "BARCODE_RESULTS_MAX_NUM": {
    "type": "string",
    "default": "100"
  },
  "BARCODE_INPUT_DELAY": {
    "type": "string",
    "default": "50"
  },
  "BARCODE_WEBCAM_SUPPORT": {
    "type": "boolean",
    "default": true
  },
  "BARCODE_SHOW_TEXT": {
    "type": "boolean",
    "default": false
  },
  "BARCODE_GENERATION_PLUGIN": {
    "type": "string",
    "default": "inventreebarcode"
  },
  "PART_ENABLE_LOCKING": {
    "type": "boolean",
    "default": true
  },
  "PART_ENABLE_REVISION": {
    "type": "boolean",
    "default": true
  },
  "PART_REVISION_ASSEMBLY_ONLY": {
    "type": "boolean",
    "default": false
  },
  "PART_ALLOW_DELETE_FROM_ASSEMBLY": {
    "type": "boolean",
    "default": false
  },
  "PART_IPN_REGEX": {
    "type": "string",
    "default": ""
  },
  "PART_ALLOW_DUPLICATE_IPN": {
    "type": "boolean",
    "default": true
  },
  "PART_ALLOW_EDIT_IPN": {
    "type": "boolean",
    "default": true
  },
  "PART_COPY_BOM": {
    "type": "boolean",
    "default": true
  },
  "PART_COPY_PARAMETERS": {
    "type": "boolean",
    "default": true
  },
  "PART_COPY_TESTS": {
    "type": "boolean",
    "default": true
  },
  "PART_CATEGORY_PARAMETERS": {
    "type": "boolean",
    "default": true
  },
  "PART_TEMPLATE": {
    "type": "boolean",
    "default": false
  },
  "PART_ASSEMBLY": {
    "type": "boolean",
    "default": false
  },
  "PART_COMPONENT": {
    "type": "boolean",
    "default": true
  },
  "PART_PURCHASEABLE": {
    "type": "boolean",
    "default": true
  },
  "PART_SALABLE": {
    "type": "boolean",
    "default": false
  },
  "PART_TRACKABLE": {
    "type": "boolean",
    "default": false
  },
  "PART_VIRTUAL": {
    "type": "boolean",
    "default": false
  },
  "PART_SHOW_RELATED": {
    "type": "boolean",
    "default": true
  },
  "PART_CREATE_INITIAL": {
    "type": "boolean",
    "default": false
  },
  "PART_CREATE_SUPPLIER": {
    "type": "boolean",
    "default": true
  },
  "PART_NAME_FORMAT": {
    "type": "string",
    "default": "{{ part.IPN if part.IPN"
  },
  "PART_CATEGORY_DEFAULT_ICON": {
    "type": "string",
    "default": ""
  },
  "PRICING_DECIMAL_PLACES_MIN": {
    "type": "string",
    "default": "0"
  },
  "PRICING_DECIMAL_PLACES": {
    "type": "string",
    "default": "6"
  },
  "PRICING_USE_SUPPLIER_PRICING": {
    "type": "boolean",
    "default": true
  },
  "PRICING_PURCHASE_HISTORY_OVERRIDES_SUPPLIER": {
    "type": "boolean",
    "default": false
  },
  "PRICING_USE_STOCK_PRICING": {
    "type": "boolean",
    "default": true
  },
  "PRICING_STOCK_ITEM_AGE_DAYS": {
    "type": "string",
    "default": "0"
  },
  "PRICING_USE_VARIANT_PRICING": {
    "type": "boolean",
    "default": true
  },
  "PRICING_ACTIVE_VARIANTS": {
    "type": "boolean",
    "default": false
  },
  "PRICING_AUTO_UPDATE": {
    "type": "boolean",
    "default": true
  },
  "PRICING_UPDATE_DAYS": {
    "type": "string",
    "default": "30"
  },
  "PART_INTERNAL_PRICE": {
    "type": "boolean",
    "default": false
  },
  "PART_BOM_USE_INTERNAL_PRICE": {
    "type": "boolean",
    "default": false
  },
  "PART_BOM_ALLOW_ZERO_QUANTITY": {
    "type": "boolean",
    "default": false
  },
  "LABEL_ENABLE": {
    "type": "boolean",
    "default": true
  },
  "LABEL_DPI": {
    "type": "string",
    "default": "300"
  },
  "REPORT_ENABLE": {
    "type": "boolean",
    "default": false
  },
  "REPORT_DEBUG_MODE": {
    "type": "boolean",
    "default": false
  },
  "REPORT_FETCH_URLS": {
    "type": "boolean",
    "default": false
  },
  "REPORT_LOG_ERRORS": {
    "type": "boolean",
    "default": false
  },
  "REPORT_DEFAULT_PAGE_SIZE": {
    "type": "string",
    "default": "A4"
  },
  "PARAMETER_ENFORCE_UNITS": {
    "type": "boolean",
    "default": true
  },
  "SERIAL_NUMBER_GLOBALLY_UNIQUE": {
    "type": "boolean",
    "default": false
  },
  "STOCK_DELETE_DEPLETED_DEFAULT": {
    "type": "boolean",
    "default": true
  },
  "STOCK_ALLOW_EDIT_SERIAL": {
    "type": "boolean",
    "default": true
  },
  "STOCK_ALLOW_DELETE_SERIALIZED": {
    "type": "boolean",
    "default": true
  },
  "STOCK_BATCH_CODE_TEMPLATE": {
    "type": "string",
    "default": ""
  },
  "STOCK_ENABLE_EXPIRY": {
    "type": "boolean",
    "default": false
  },
  "STOCK_ALLOW_EXPIRED_SALE": {
    "type": "boolean",
    "default": false
  },
  "STOCK_STALE_DAYS": {
    "type": "string",
    "default": "0"
  },
  "STOCK_ALLOW_EXPIRED_BUILD": {
    "type": "boolean",
    "default": false
  },
  "STOCK_OWNERSHIP_CONTROL": {
    "type": "boolean",
    "default": false
  },
  "STOCK_LOCATION_DEFAULT_ICON": {
    "type": "string",
    "default": ""
  },
  "STOCK_SHOW_INSTALLED_ITEMS": {
    "type": "boolean",
    "default": false
  },
  "STOCK_ENFORCE_BOM_INSTALLATION": {
    "type": "boolean",
    "default": true
  },
  "STOCK_ALLOW_OUT_OF_STOCK_TRANSFER": {
    "type": "boolean",
    "default": false
  },
  "STOCK_MERGE_ON_TRANSFER": {
    "type": "boolean",
    "default": false
  },
  "BUILDORDER_REFERENCE_PATTERN": {
    "type": "string",
    "default": "BO-{ref:04d"
  },
  "BUILDORDER_REQUIRE_RESPONSIBLE": {
    "type": "boolean",
    "default": false
  },
  "BUILDORDER_REQUIRE_ACTIVE_PART": {
    "type": "boolean",
    "default": false
  },
  "BUILDORDER_REQUIRE_LOCKED_PART": {
    "type": "boolean",
    "default": false
  },
  "BUILDORDER_REQUIRE_VALID_BOM": {
    "type": "boolean",
    "default": false
  },
  "BUILDORDER_REQUIRE_CLOSED_CHILDS": {
    "type": "boolean",
    "default": false
  },
  "BUILDORDER_EXTERNAL_BUILDS": {
    "type": "boolean",
    "default": false
  },
  "BUILDORDER_EXTERNAL_REQUIRED": {
    "type": "boolean",
    "default": false
  },
  "PREVENT_BUILD_COMPLETION_HAVING_INCOMPLETED_TESTS": {
    "type": "boolean",
    "default": false
  },
  "RETURNORDER_ENABLED": {
    "type": "boolean",
    "default": false
  },
  "RETURNORDER_REFERENCE_PATTERN": {
    "type": "string",
    "default": "RMA-{ref:04d"
  },
  "RETURNORDER_REQUIRE_RESPONSIBLE": {
    "type": "boolean",
    "default": false
  },
  "RETURNORDER_EDIT_COMPLETED_ORDERS": {
    "type": "boolean",
    "default": false
  },
  "SALESORDER_REFERENCE_PATTERN": {
    "type": "string",
    "default": "SO-{ref:04d"
  },
  "SALESORDER_REQUIRE_RESPONSIBLE": {
    "type": "boolean",
    "default": false
  },
  "SALESORDER_DEFAULT_SHIPMENT": {
    "type": "boolean",
    "default": false
  },
  "SALESORDER_EDIT_COMPLETED_ORDERS": {
    "type": "boolean",
    "default": false
  },
  "SALESORDER_SHIPMENT_REQUIRES_CHECK": {
    "type": "boolean",
    "default": false
  },
  "SALESORDER_SHIP_COMPLETE": {
    "type": "boolean",
    "default": false
  },
  "TRANSFERORDER_ENABLED": {
    "type": "boolean",
    "default": false
  },
  "TRANSFERORDER_REFERENCE_PATTERN": {
    "type": "string",
    "default": "TO-{ref:04d"
  },
  "TRANSFERORDER_REQUIRE_RESPONSIBLE": {
    "type": "boolean",
    "default": false
  },
  "TRANSFERORDER_EDIT_COMPLETED_ORDERS": {
    "type": "boolean",
    "default": false
  },
  "SALESORDER_BLOCK_INCOMPLETE_ITEM_TESTS": {
    "type": "boolean",
    "default": false
  },
  "PURCHASEORDER_REFERENCE_PATTERN": {
    "type": "string",
    "default": "PO-{ref:04d"
  },
  "PURCHASEORDER_REQUIRE_RESPONSIBLE": {
    "type": "boolean",
    "default": false
  },
  "PURCHASEORDER_EDIT_COMPLETED_ORDERS": {
    "type": "boolean",
    "default": false
  },
  "PURCHASEORDER_CONVERT_CURRENCY": {
    "type": "boolean",
    "default": false
  },
  "PURCHASEORDER_AUTO_COMPLETE": {
    "type": "boolean",
    "default": true
  },
  "PURCHASEORDER_MERGE_LINE_ITEMS": {
    "type": "boolean",
    "default": true
  },
  "LOGIN_ENABLE_PWD_FORGOT": {
    "type": "boolean",
    "default": true
  },
  "LOGIN_ENABLE_REG": {
    "type": "boolean",
    "default": false
  },
  "LOGIN_ENABLE_SSO": {
    "type": "boolean",
    "default": false
  },
  "LOGIN_ENABLE_SSO_REG": {
    "type": "boolean",
    "default": false
  },
  "LOGIN_ENABLE_SSO_GROUP_SYNC": {
    "type": "boolean",
    "default": false
  },
  "SSO_GROUP_KEY": {
    "type": "string",
    "default": "groups"
  },
  "SSO_GROUP_MAP": {
    "type": "string",
    "default": "{"
  },
  "SSO_REMOVE_GROUPS": {
    "type": "boolean",
    "default": true
  },
  "LOGIN_MAIL_REQUIRED": {
    "type": "boolean",
    "default": false
  },
  "LOGIN_SIGNUP_SSO_AUTO": {
    "type": "boolean",
    "default": true
  },
  "LOGIN_SIGNUP_MAIL_TWICE": {
    "type": "boolean",
    "default": false
  },
  "LOGIN_SIGNUP_PWD_TWICE": {
    "type": "boolean",
    "default": true
  },
  "LOGIN_SIGNUP_MAIL_RESTRICTION": {
    "type": "string",
    "default": ""
  },
  "SIGNUP_GROUP": {
    "type": "string",
    "default": ""
  },
  "LOGIN_ENFORCE_MFA": {
    "type": "boolean",
    "default": false
  },
  "PLUGIN_ON_STARTUP": {
    "type": "boolean",
    "default": "str(os.getenv('INVENTREE_DOCKER'"
  },
  "PLUGIN_UPDATE_CHECK": {
    "type": "boolean",
    "default": true
  },
  "ENABLE_PLUGINS_URL": {
    "type": "boolean",
    "default": false
  },
  "ENABLE_PLUGINS_NAVIGATION": {
    "type": "boolean",
    "default": false
  },
  "ENABLE_PLUGINS_APP": {
    "type": "boolean",
    "default": false
  },
  "ENABLE_PLUGINS_SCHEDULE": {
    "type": "boolean",
    "default": false
  },
  "ENABLE_PLUGINS_EVENTS": {
    "type": "boolean",
    "default": false
  },
  "ENABLE_PLUGINS_INTERFACE": {
    "type": "boolean",
    "default": false
  },
  "ENABLE_PLUGINS_MAILS": {
    "type": "boolean",
    "default": false
  },
  "PROJECT_CODES_ENABLED": {
    "type": "boolean",
    "default": false
  },
  "STOCKTAKE_ENABLE": {
    "type": "boolean",
    "default": false
  },
  "STOCKTAKE_EXCLUDE_EXTERNAL": {
    "type": "boolean",
    "default": false
  },
  "STOCKTAKE_AUTO_DAYS": {
    "type": "string",
    "default": "7"
  },
  "STOCKTAKE_DELETE_OLD_ENTRIES": {
    "type": "boolean",
    "default": false
  },
  "STOCKTAKE_DELETE_DAYS": {
    "type": "string",
    "default": "365"
  },
  "STOCK_TRACKING_DELETE_OLD_ENTRIES": {
    "type": "boolean",
    "default": false
  },
  "STOCK_TRACKING_DELETE_DAYS": {
    "type": "string",
    "default": "365"
  },
  "DISPLAY_FULL_NAMES": {
    "type": "boolean",
    "default": false
  },
  "DISPLAY_PROFILE_INFO": {
    "type": "boolean",
    "default": true
  },
  "WEEK_STARTS_ON": {
    "type": "string",
    "default": "1"
  },
  "CALENDAR_HORIZON_MONTHS": {
    "type": "string",
    "default": "12"
  },
  "TEST_STATION_DATA": {
    "type": "boolean",
    "default": false
  },
  "MACHINE_PING_ENABLED": {
    "type": "boolean",
    "default": true
  }
};
export const USER_SETTINGS: Record<string, { type: 'string' | 'number' | 'boolean', default: any }> = {
  "LABEL_INLINE": {
    "type": "boolean",
    "default": true
  },
  "LABEL_DEFAULT_PRINTER": {
    "type": "string",
    "default": ""
  },
  "REPORT_INLINE": {
    "type": "boolean",
    "default": false
  },
  "BARCODE_IN_FORM_FIELDS": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_PREVIEW_SHOW_PARTS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_SHOW_SUPPLIER_PARTS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_SHOW_MANUFACTURER_PARTS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_HIDE_INACTIVE_PARTS": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_PREVIEW_SHOW_CATEGORIES": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_PREVIEW_SHOW_STOCK": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_HIDE_UNAVAILABLE_STOCK": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_PREVIEW_SHOW_LOCATIONS": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_PREVIEW_SHOW_COMPANIES": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_SHOW_BUILD_ORDERS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_SHOW_PURCHASE_ORDERS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_EXCLUDE_INACTIVE_PURCHASE_ORDERS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_SHOW_SALES_ORDERS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_EXCLUDE_INACTIVE_SALES_ORDERS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_SHOW_SALES_ORDER_SHIPMENTS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_SHOW_RETURN_ORDERS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_EXCLUDE_INACTIVE_RETURN_ORDERS": {
    "type": "boolean",
    "default": true
  },
  "SEARCH_PREVIEW_RESULTS": {
    "type": "string",
    "default": "10"
  },
  "SEARCH_RESULTS_PREVIEW_PANEL": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_REGEX": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_WHOLE": {
    "type": "boolean",
    "default": false
  },
  "SEARCH_NOTES": {
    "type": "boolean",
    "default": false
  },
  "FORMS_CLOSE_USING_ESCAPE": {
    "type": "boolean",
    "default": false
  },
  "STICKY_HEADER": {
    "type": "boolean",
    "default": false
  },
  "STICKY_TABLE_HEADER": {
    "type": "boolean",
    "default": false
  },
  "SHOW_SPOTLIGHT": {
    "type": "boolean",
    "default": true
  },
  "ICONS_IN_NAVBAR": {
    "type": "boolean",
    "default": false
  },
  "DATE_DISPLAY_FORMAT": {
    "type": "string",
    "default": "YYYY-MM-DD"
  },
  "ENABLE_PREVIEW_PANEL": {
    "type": "boolean",
    "default": false
  },
  "DISPLAY_STOCKTAKE_TAB": {
    "type": "boolean",
    "default": true
  },
  "ENABLE_LAST_BREADCRUMB": {
    "type": "boolean",
    "default": false
  },
  "SHOW_EXTRA_MODEL_INFO": {
    "type": "boolean",
    "default": false
  },
  "SHOW_FULL_LOCATION_IN_TABLES": {
    "type": "boolean",
    "default": false
  },
  "SHOW_FULL_CATEGORY_IN_TABLES": {
    "type": "boolean",
    "default": false
  },
  "SHOW_BOM_SUBASSEMBLY_LEVELS": {
    "type": "boolean",
    "default": true
  },
  "NOTIFICATION_ERROR_REPORT": {
    "type": "boolean",
    "default": true
  },
  "LAST_USED_PRINTING_MACHINES": {
    "type": "string",
    "default": ""
  },
  "DISPLAY_ITEMS_FINAL_LEVEL": {
    "type": "boolean",
    "default": false
  }
};
