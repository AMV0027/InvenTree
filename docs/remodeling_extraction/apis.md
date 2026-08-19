# InvenTree API Endpoints (Categorised by Modules)

This document lists the REST API endpoints grouped by their respective codebase modules.

## API Endpoints (`/api/*`)

### Module: `InvenTree`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/admin/` | `include(common.api.admin_api_urls)` | `` |
| `/api/search/` | `APISearchView` | `api-search` |
| `/api/generate/batch-code/` | `stock.api.GenerateBatchCode` | `api-generate-batch-code` |
| `/api/generate/serial-number/` | `stock.api.GenerateSerialNumber` | `api-generate-serial-number` |
| `/api/schema/` | `SpectacularAPIView` | `schema` |
| `/api/license/` | `LicenseView` | `api-license` |
| `/api/version-text` | `VersionTextView` | `api-version-text` |
| `/api/version/` | `VersionView` | `api-version` |
| `/api/` | `InfoView` | `api-inventree-info` |
| `/api/auth/login-redirect/` | `users.api.LoginRedirect` | `api-login-redirect` |
| `/api/auth/` | `allauth headless client` | `` |
| `/api/email/generate/` | `` | `sesame-generate` |
| `/api/email/login/` | `LoginView` | `sesame-login` |
| `/api/^.*$` | `NotFoundView` | `api-404` |

### Module: `build`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/build/line/<int:pk>/` | `BuildLineDetail` | `api-build-line-detail` |
| `/api/build/line/` | `BuildLineList` | `api-build-line-list` |
| `/api/build/item/<int:pk>/` | `BuildItemDetail` | `api-build-item-detail` |
| `/api/build/item/` | `BuildItemList` | `api-build-item-list` |
| `/api/build/<int:pk>/allocate/` | `BuildAllocate` | `api-build-allocate` |
| `/api/build/<int:pk>/consume/` | `BuildConsume` | `api-build-consume` |
| `/api/build/<int:pk>/auto-allocate/` | `BuildAutoAllocate` | `api-build-auto-allocate` |
| `/api/build/<int:pk>/complete/` | `BuildOutputComplete` | `api-build-output-complete` |
| `/api/build/<int:pk>/create-output/` | `BuildOutputCreate` | `api-build-output-create` |
| `/api/build/<int:pk>/delete-outputs/` | `BuildOutputDelete` | `api-build-output-delete` |
| `/api/build/<int:pk>/scrap-outputs/` | `BuildOutputScrap` | `api-build-output-scrap` |
| `/api/build/<int:pk>/issue/` | `BuildIssue` | `api-build-issue` |
| `/api/build/<int:pk>/hold/` | `BuildHold` | `api-build-hold` |
| `/api/build/<int:pk>/finish/` | `BuildFinish` | `api-build-finish` |
| `/api/build/<int:pk>/cancel/` | `BuildCancel` | `api-build-cancel` |
| `/api/build/<int:pk>/unallocate/` | `BuildUnallocate` | `api-build-unallocate` |
| `/api/build/<int:pk>/` | `BuildDetail` | `api-build-detail` |
| `/api/build/status/` | `StatusView` | `api-build-status-codes` |
| `/api/build/` | `BuildList` | `api-build-list` |

### Module: `common`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/settings/user/^(?P<key>\w+)/` | `UserSettingsDetail` | `api-user-setting-detail` |
| `/api/settings/user/` | `UserSettingsList` | `api-user-setting-list` |
| `/api/settings/global/^(?P<key>\w+)/` | `GlobalSettingsDetail` | `api-global-setting-detail` |
| `/api/settings/global/` | `GlobalSettingsList` | `api-global-setting-list` |
| `/api/webhook/<slug:endpoint>/` | `WebhookView` | `api-webhook` |
| `/api/notes-image-upload/` | `NotesImageList` | `api-notes-image-list` |
| `/api/background-task/pending/` | `PendingTaskList` | `api-pending-task-list` |
| `/api/background-task/scheduled/` | `ScheduledTaskList` | `api-scheduled-task-list` |
| `/api/background-task/failed/` | `FailedTaskList` | `api-failed-task-list` |
| `/api/background-task/<str:task_id>/` | `BackgroundTaskDetail` | `api-task-detail` |
| `/api/background-task/` | `BackgroundTaskOverview` | `api-task-overview` |
| `/api/attachment/<int:pk>/` | `AttachmentDetail` | `api-attachment-detail` |
| `/api/attachment/` | `AttachmentList` | `api-attachment-list` |
| `/api/parameter/template/<int:pk>/` | `ParameterTemplateDetail` | `api-parameter-template-detail` |
| `/api/parameter/template/` | `ParameterTemplateList` | `api-parameter-template-list` |
| `/api/parameter/<int:pk>/` | `ParameterDetail` | `api-parameter-detail` |
| `/api/parameter/` | `ParameterList` | `api-parameter-list` |
| `/api/metadata/<str:model>/<str:lookup_field>/<str:lookup_value>/` | `GenericMetadataView` | `api-generic-metadata` |
| `/api/metadata/<str:model>/<int:pk>/` | `SimpleGenericMetadataView` | `api-generic-metadata` |
| `/api/project-code/<int:pk>/` | `ProjectCodeDetail` | `api-project-code-detail` |
| `/api/project-code/` | `ProjectCodeList` | `api-project-code-list` |
| `/api/tag/<int:pk>/` | `TagDetail` | `api-tag-detail` |
| `/api/tag/` | `TagList` | `api-tag-list` |
| `/api/flags/<str:key>/` | `FlagDetail` | `api-flag-detail` |
| `/api/flags/` | `FlagList` | `api-flag-list` |
| `/api/generic/status/` | `include(generic_states_api_urls)` | `` |
| `/api/contenttype/<int:pk>/` | `ContentTypeDetail` | `api-contenttype-detail` |
| `/api/contenttype/model/<str:model>/` | `ContentTypeModelDetail` | `api-contenttype-detail-modelname` |
| `/api/contenttype/` | `ContentTypeList` | `api-contenttype-list` |
| `/api/icons/` | `IconList` | `api-icon-list` |
| `/api/selection/<int:pk>/entry/<int:entrypk>/` | `SelectionEntryDetail` | `api-selectionlistentry-detail` |
| `/api/selection/<int:pk>/entry/` | `SelectionEntryList` | `api-selectionlistentry-list` |
| `/api/selection/<int:pk>/` | `SelectionListDetail` | `api-selectionlist-detail` |
| `/api/selection/` | `SelectionListList` | `api-selectionlist-list` |
| `/api/system/health/` | `HealthCheckView` | `api-system-health` |
| `/api/system-internal/observability/end` | `ObservabilityEnd` | `api-system-observability` |
| `/api/` | `include(common_router.urls)` | `` |

### Module: `company`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/company/part/manufacturer/<int:pk>/` | `ManufacturerPartDetail` | `api-manufacturer-part-detail` |
| `/api/company/part/manufacturer/` | `ManufacturerPartList` | `api-manufacturer-part-list` |
| `/api/company/part/<int:pk>/` | `SupplierPartDetail` | `api-supplier-part-detail` |
| `/api/company/part/` | `SupplierPartList` | `api-supplier-part-list` |
| `/api/company/price-break/<int:pk>/` | `SupplierPriceBreakDetail` | `api-part-supplier-price-detail` |
| `/api/company/price-break/` | `SupplierPriceBreakList` | `api-part-supplier-price-list` |
| `/api/company/<int:pk>/` | `CompanyDetail` | `api-company-detail` |
| `/api/company/contact/<int:pk>/` | `ContactDetail` | `api-contact-detail` |
| `/api/company/contact/` | `ContactList` | `api-contact-list` |
| `/api/company/address/<int:pk>/` | `AddressDetail` | `api-address-detail` |
| `/api/company/address/` | `AddressList` | `api-address-list` |
| `/api/company/` | `CompanyList` | `api-company-list` |

### Module: `importer`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/importer/models/` | `DataImporterModelList` | `api-importer-model-list` |
| `/api/importer/session/<int:pk>/accept_fields/` | `DataImportSessionAcceptFields` | `api-import-session-accept-fields` |
| `/api/importer/session/<int:pk>/accept_rows/` | `DataImportSessionAcceptRows` | `api-import-session-accept-rows` |
| `/api/importer/session/<int:pk>/` | `DataImportSessionDetail` | `api-import-session-detail` |
| `/api/importer/session/` | `DataImportSessionList` | `api-importer-session-list` |
| `/api/importer/column-mapping/<int:pk>/` | `DataImportColumnMappingDetail` | `api-importer-mapping-detail` |
| `/api/importer/column-mapping/` | `DataImportColumnMappingList` | `api-importer-mapping-list` |
| `/api/importer/row/<int:pk>/` | `DataImportRowDetail` | `api-importer-row-detail` |
| `/api/importer/row/` | `DataImportRowList` | `api-importer-row-list` |

### Module: `machine`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/machine/types/` | `MachineTypesList` | `api-machine-types` |
| `/api/machine/drivers/` | `MachineDriverList` | `api-machine-drivers` |
| `/api/machine/status/` | `RegistryStatusView` | `api-machine-registry-status` |
| `/api/machine/<uuid:pk>/settings/^(?P<config_type>M|D)/(?P<key>\w+)/` | `MachineSettingDetail` | `api-machine-settings-detail` |
| `/api/machine/<uuid:pk>/settings/` | `MachineSettingList` | `api-machine-settings` |
| `/api/machine/<uuid:pk>/restart/` | `MachineRestart` | `api-machine-restart` |
| `/api/machine/<uuid:pk>/` | `MachineDetail` | `api-machine-detail` |
| `/api/machine/` | `MachineList` | `api-machine-list` |

### Module: `order`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/order/po/<int:pk>/cancel/` | `PurchaseOrderCancel` | `api-po-cancel` |
| `/api/order/po/<int:pk>/hold/` | `PurchaseOrderHold` | `api-po-hold` |
| `/api/order/po/<int:pk>/complete/` | `PurchaseOrderComplete` | `api-po-complete` |
| `/api/order/po/<int:pk>/issue/` | `PurchaseOrderIssue` | `api-po-issue` |
| `/api/order/po/<int:pk>/receive/` | `PurchaseOrderReceive` | `api-po-receive` |
| `/api/order/po/<int:pk>/` | `PurchaseOrderDetail` | `api-po-detail` |
| `/api/order/po/status/` | `StatusView` | `api-po-status-codes` |
| `/api/order/po/` | `PurchaseOrderList` | `api-po-list` |
| `/api/order/po-line/<int:pk>/` | `PurchaseOrderLineItemDetail` | `api-po-line-detail` |
| `/api/order/po-line/` | `PurchaseOrderLineItemList` | `api-po-line-list` |
| `/api/order/po-extra-line/<int:pk>/` | `PurchaseOrderExtraLineDetail` | `api-po-extra-line-detail` |
| `/api/order/po-extra-line/` | `PurchaseOrderExtraLineList` | `api-po-extra-line-list` |
| `/api/order/so/shipment/<int:pk>/ship/` | `SalesOrderShipmentComplete` | `api-so-shipment-ship` |
| `/api/order/so/shipment/<int:pk>/` | `SalesOrderShipmentDetail` | `api-so-shipment-detail` |
| `/api/order/so/shipment/` | `SalesOrderShipmentList` | `api-so-shipment-list` |
| `/api/order/so/<int:pk>/allocate/` | `SalesOrderAllocate` | `api-so-allocate` |
| `/api/order/so/<int:pk>/allocate-serials/` | `SalesOrderAllocateSerials` | `api-so-allocate-serials` |
| `/api/order/so/<int:pk>/auto-allocate/` | `SalesOrderAutoAllocate` | `api-so-auto-allocate` |
| `/api/order/so/<int:pk>/hold/` | `SalesOrderHold` | `api-so-hold` |
| `/api/order/so/<int:pk>/cancel/` | `SalesOrderCancel` | `api-so-cancel` |
| `/api/order/so/<int:pk>/issue/` | `SalesOrderIssue` | `api-so-issue` |
| `/api/order/so/<int:pk>/complete/` | `SalesOrderComplete` | `api-so-complete` |
| `/api/order/so/<int:pk>/` | `SalesOrderDetail` | `api-so-detail` |
| `/api/order/so/status/` | `StatusView` | `api-so-status-codes` |
| `/api/order/so/` | `SalesOrderList` | `api-so-list` |
| `/api/order/so-line/<int:pk>/` | `SalesOrderLineItemDetail` | `api-so-line-detail` |
| `/api/order/so-line/` | `SalesOrderLineItemList` | `api-so-line-list` |
| `/api/order/so-extra-line/<int:pk>/` | `SalesOrderExtraLineDetail` | `api-so-extra-line-detail` |
| `/api/order/so-extra-line/` | `SalesOrderExtraLineList` | `api-so-extra-line-list` |
| `/api/order/so-allocation/<int:pk>/` | `SalesOrderAllocationDetail` | `api-so-allocation-detail` |
| `/api/order/so-allocation/` | `SalesOrderAllocationList` | `api-so-allocation-list` |
| `/api/order/ro/<int:pk>/cancel/` | `ReturnOrderCancel` | `api-return-order-cancel` |
| `/api/order/ro/<int:pk>/hold/` | `ReturnOrderHold` | `api-ro-hold` |
| `/api/order/ro/<int:pk>/complete/` | `ReturnOrderComplete` | `api-return-order-complete` |
| `/api/order/ro/<int:pk>/issue/` | `ReturnOrderIssue` | `api-return-order-issue` |
| `/api/order/ro/<int:pk>/receive/` | `ReturnOrderReceive` | `api-return-order-receive` |
| `/api/order/ro/<int:pk>/` | `ReturnOrderDetail` | `api-return-order-detail` |
| `/api/order/ro/status/` | `StatusView` | `api-return-order-status-codes` |
| `/api/order/ro/` | `ReturnOrderList` | `api-return-order-list` |
| `/api/order/ro-line/<int:pk>/` | `ReturnOrderLineItemDetail` | `api-return-order-line-detail` |
| `/api/order/ro-line/status/` | `StatusView` | `api-return-order-line-status-codes` |
| `/api/order/ro-line/` | `ReturnOrderLineItemList` | `api-return-order-line-list` |
| `/api/order/ro-extra-line/<int:pk>/` | `ReturnOrderExtraLineDetail` | `api-return-order-extra-line-detail` |
| `/api/order/ro-extra-line/` | `ReturnOrderExtraLineList` | `api-return-order-extra-line-list` |
| `/api/order/transfer-order/<int:pk>/allocate/` | `TransferOrderAllocate` | `api-transfer-order-allocate` |
| `/api/order/transfer-order/<int:pk>/allocate-serials/` | `TransferOrderAllocateSerials` | `api-transfer-order-allocate-serials` |
| `/api/order/transfer-order/<int:pk>/cancel/` | `TransferOrderCancel` | `api-transfer-order-cancel` |
| `/api/order/transfer-order/<int:pk>/hold/` | `TransferOrderHold` | `api-transfer-order-hold` |
| `/api/order/transfer-order/<int:pk>/complete/` | `TransferOrderComplete` | `api-transfer-order-complete` |
| `/api/order/transfer-order/<int:pk>/issue/` | `TransferOrderIssue` | `api-transfer-order-issue` |
| `/api/order/transfer-order/<int:pk>/` | `TransferOrderDetail` | `api-transfer-order-detail` |
| `/api/order/transfer-order/` | `TransferOrderList` | `api-transfer-order-list` |
| `/api/order/transfer-order-line/<int:pk>/` | `TransferOrderLineItemDetail` | `api-transfer-order-line-detail` |
| `/api/order/transfer-order-line/` | `TransferOrderLineItemList` | `api-transfer-order-line-list` |
| `/api/order/transfer-order-allocation/<int:pk>/` | `TransferOrderAllocationDetail` | `api-transfer-order-allocation-detail` |
| `/api/order/transfer-order-allocation/` | `TransferOrderAllocationList` | `api-transfer-order-allocation-list` |
| `/api/order/^calendar/(?P<ordertype>purchase-order|sales-order|return-order|transfer-order)/calendar.ics` | `` | `api-po-so-calendar` |

### Module: `part`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/bom/substitute/<int:pk>/` | `BomItemSubstituteDetail` | `api-bom-substitute-detail` |
| `/api/bom/substitute/` | `BomItemSubstituteList` | `api-bom-substitute-list` |
| `/api/bom/<int:pk>/validate/` | `BomItemValidate` | `api-bom-item-validate` |
| `/api/bom/<int:pk>/` | `BomDetail` | `api-bom-item-detail` |
| `/api/bom/` | `BomList` | `api-bom-list` |
| `/api/part/category/tree/` | `CategoryTree` | `api-part-category-tree` |
| `/api/part/category/parameters/<int:pk>/` | `CategoryParameterDetail` | `api-part-category-parameter-detail` |
| `/api/part/category/parameters/` | `CategoryParameterList` | `api-part-category-parameter-list` |
| `/api/part/category/<int:pk>/` | `CategoryDetail` | `api-part-category-detail` |
| `/api/part/category/` | `CategoryList` | `api-part-category-list` |
| `/api/part/test-template/<int:pk>/` | `PartTestTemplateDetail` | `api-part-test-template-detail` |
| `/api/part/test-template/` | `PartTestTemplateList` | `api-part-test-template-list` |
| `/api/part/sale-price/<int:pk>/` | `PartSalePriceDetail` | `api-part-sale-price-detail` |
| `/api/part/sale-price/` | `PartSalePriceList` | `api-part-sale-price-list` |
| `/api/part/internal-price/<int:pk>/` | `PartInternalPriceDetail` | `api-part-internal-price-detail` |
| `/api/part/internal-price/` | `PartInternalPriceList` | `api-part-internal-price-list` |
| `/api/part/related/<int:pk>/` | `PartRelatedDetail` | `api-part-related-detail` |
| `/api/part/related/` | `PartRelatedList` | `api-part-related-list` |
| `/api/part/stocktake/<int:pk>/` | `PartStocktakeDetail` | `api-part-stocktake-detail` |
| `/api/part/stocktake/generate/` | `PartStocktakeGenerate` | `api-part-stocktake-generate` |
| `/api/part/stocktake/` | `PartStocktakeList` | `api-part-stocktake-list` |
| `/api/part/thumbs/` | `PartThumbs` | `api-part-thumbs` |
| `/api/part/thumbs/<int:pk>/` | `PartThumbsUpdate` | `api-part-thumbs-update` |
| `/api/part/<int:pk>/serial-numbers/` | `PartSerialNumberDetail` | `api-part-serial-number-detail` |
| `/api/part/<int:pk>/requirements/` | `PartRequirements` | `api-part-requirements` |
| `/api/part/<int:pk>/bom-copy/` | `PartCopyBOM` | `api-part-bom-copy` |
| `/api/part/<int:pk>/bom-validate/` | `PartValidateBOM` | `api-part-bom-validate` |
| `/api/part/<int:pk>/pricing/` | `PartPricingDetail` | `api-part-pricing` |
| `/api/part/<int:pk>/` | `PartDetail` | `api-part-detail` |
| `/api/part/` | `PartList` | `api-part-list` |

### Module: `plugin`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/action/` | `ActionPluginView` | `api-action-plugin` |
| `/api/barcode/history/<int:pk>/` | `BarcodeScanResultDetail` | `api-barcode-scan-result-detail` |
| `/api/barcode/history/` | `BarcodeScanResultList` | `api-barcode-scan-result-list` |
| `/api/barcode/generate/` | `BarcodeGenerate` | `api-barcode-generate` |
| `/api/barcode/link/` | `BarcodeAssign` | `api-barcode-link` |
| `/api/barcode/unlink/` | `BarcodeUnassign` | `api-barcode-unlink` |
| `/api/barcode/po-receive/` | `BarcodePOReceive` | `api-barcode-po-receive` |
| `/api/barcode/po-allocate/` | `BarcodePOAllocate` | `api-barcode-po-allocate` |
| `/api/barcode/so-allocate/` | `BarcodeSOAllocate` | `api-barcode-so-allocate` |
| `/api/barcode/` | `BarcodeScan` | `api-barcode-scan` |
| `/api/locate/` | `LocatePluginView` | `api-locate-plugin` |
| `/api/plugins/ui/features/<str:feature>/` | `PluginUIFeatureList` | `api-plugin-ui-feature-list` |
| `/api/plugins/reload/` | `PluginReload` | `api-plugin-reload` |
| `/api/plugins/install/` | `PluginInstall` | `api-plugin-install` |
| `/api/plugins/status/` | `RegistryStatusView` | `api-plugin-registry-status` |
| `/api/plugins/settings/` | `PluginSettingList` | `api-plugin-setting-list` |
| `/api/plugins/<str:plugin>/user-settings/^(?P<key>\w+)/` | `PluginUserSettingDetail` | `api-plugin-user-setting-detail` |
| `/api/plugins/<str:plugin>/user-settings/` | `PluginUserSettingList` | `api-plugin-user-setting-list` |
| `/api/plugins/<str:plugin>/settings/^(?P<key>\w+)/` | `PluginSettingDetail` | `api-plugin-setting-detail` |
| `/api/plugins/<str:plugin>/settings/` | `PluginAllSettingList` | `api-plugin-settings` |
| `/api/plugins/<str:plugin>/activate/` | `PluginActivate` | `api-plugin-detail-activate` |
| `/api/plugins/<str:plugin>/uninstall/` | `PluginUninstall` | `api-plugin-uninstall` |
| `/api/plugins/<str:plugin>/admin/` | `PluginAdminDetail` | `api-plugin-admin` |
| `/api/plugins/<str:plugin>/` | `PluginDetail` | `api-plugin-detail` |
| `/api/plugins/` | `PluginList` | `api-plugin-list` |
| `/api/supplier/list/` | `ListSupplier` | `api-supplier-list` |
| `/api/supplier/search/` | `SearchPart` | `api-supplier-search` |
| `/api/supplier/import/` | `ImportPart` | `api-supplier-import` |

### Module: `report`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/label/print/` | `LabelPrint` | `api-label-print` |
| `/api/label/template/<int:pk>/` | `LabelTemplateDetail` | `api-label-template-detail` |
| `/api/label/template/` | `LabelTemplateList` | `api-label-template-list` |
| `/api/report/print/` | `ReportPrint` | `api-report-print` |
| `/api/report/template/<int:pk>/` | `ReportTemplateDetail` | `api-report-template-detail` |
| `/api/report/template/` | `ReportTemplateList` | `api-report-template-list` |
| `/api/report/asset/<int:pk>/` | `ReportAssetDetail` | `api-report-asset-detail` |
| `/api/report/asset/` | `ReportAssetList` | `api-report-asset-list` |
| `/api/report/snippet/<int:pk>/` | `ReportSnippetDetail` | `api-report-snippet-detail` |
| `/api/report/snippet/` | `ReportSnippetList` | `api-report-snippet-list` |

### Module: `stock`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/stock/location/tree/` | `StockLocationTree` | `api-location-tree` |
| `/api/stock/location/<int:pk>/` | `StockLocationDetail` | `api-location-detail` |
| `/api/stock/location/` | `StockLocationList` | `api-location-list` |
| `/api/stock/location-type/<int:pk>/` | `StockLocationTypeDetail` | `api-location-type-detail` |
| `/api/stock/location-type/` | `StockLocationTypeList` | `api-location-type-list` |
| `/api/stock/count/` | `StockCount` | `api-stock-count` |
| `/api/stock/add/` | `StockAdd` | `api-stock-add` |
| `/api/stock/remove/` | `StockRemove` | `api-stock-remove` |
| `/api/stock/transfer/` | `StockTransfer` | `api-stock-transfer` |
| `/api/stock/return/` | `StockReturn` | `api-stock-return` |
| `/api/stock/assign/` | `StockAssign` | `api-stock-assign` |
| `/api/stock/merge/` | `StockMerge` | `api-stock-merge` |
| `/api/stock/change_status/` | `StockChangeStatus` | `api-stock-change-status` |
| `/api/stock/test/<int:pk>/` | `StockItemTestResultDetail` | `api-stock-test-result-detail` |
| `/api/stock/test/` | `StockItemTestResultList` | `api-stock-test-result-list` |
| `/api/stock/track/<int:pk>/` | `StockTrackingDetail` | `api-stock-tracking-detail` |
| `/api/stock/track/status/` | `StatusView` | `api-stock-tracking-status-codes` |
| `/api/stock/track/` | `StockTrackingList` | `api-stock-tracking-list` |
| `/api/stock/<int:pk>/convert/` | `StockItemConvert` | `api-stock-item-convert` |
| `/api/stock/<int:pk>/disassemble/` | `StockItemDisassemble` | `api-stock-item-disassemble` |
| `/api/stock/<int:pk>/install/` | `StockItemInstall` | `api-stock-item-install` |
| `/api/stock/<int:pk>/serialize/` | `StockItemSerialize` | `api-stock-item-serialize` |
| `/api/stock/<int:pk>/uninstall/` | `StockItemUninstall` | `api-stock-item-uninstall` |
| `/api/stock/<int:pk>/serial-numbers/` | `StockItemSerialNumbers` | `api-stock-item-serial-numbers` |
| `/api/stock/<int:pk>/` | `StockDetail` | `api-stock-detail` |
| `/api/stock/status/` | `StatusView` | `api-stock-status-codes` |
| `/api/stock/` | `StockList` | `api-stock-list` |

### Module: `users`

| HTTP Endpoint | View Class / Target | URL Name |
| --- | --- | --- |
| `/api/user/roles/` | `` | `api-user-roles_legacy` |
| `/api/user/token/` | `` | `api-token_legacy` |
| `/api/user/profile/` | `` | `api-user-profile_legacy` |
| `/api/user/me/profile/` | `UserProfileDetail` | `api-user-profile` |
| `/api/user/me/roles/` | `RoleDetails` | `api-user-roles` |
| `/api/user/me/token/` | `` | `api-token` |
| `/api/user/me/` | `MeUserDetail` | `api-user-me` |
| `/api/user/tokens/<int:pk>/` | `TokenDetailView` | `api-token-detail` |
| `/api/user/tokens/` | `TokenListView` | `api-token-list` |
| `/api/user/owner/<int:pk>/` | `OwnerDetail` | `api-owner-detail` |
| `/api/user/owner/` | `OwnerList` | `api-owner-list` |
| `/api/user/group/<int:pk>/` | `GroupDetail` | `api-group-detail` |
| `/api/user/group/` | `GroupList` | `api-group-list` |
| `/api/user/ruleset/<int:pk>/` | `RuleSetDetail` | `api-ruleset-detail` |
| `/api/user/ruleset/` | `RuleSetList` | `api-ruleset-list` |
| `/api/user/<int:pk>/set-password/` | `UserDetailSetPassword` | `api-user-set-password` |
| `/api/user/<int:pk>/` | `UserDetail` | `api-user-detail` |
| `/api/user/` | `UserList` | `api-user-list` |

## General / Web Endpoints

