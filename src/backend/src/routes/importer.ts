import { Hono } from 'hono';

export const importerRouter = new Hono();

// Target: DataImporterModelList
// Name: api-importer-model-list
importerRouter.get('/api/importer/models', (c) => c.json({
  message: 'GET endpoint for DataImporterModelList',
  route: '/api/importer/models/'
}));

// Target: DataImporterModelList
// Name: api-importer-model-list
importerRouter.post('/api/importer/models', (c) => c.json({
  message: 'POST endpoint for DataImporterModelList',
  route: '/api/importer/models/'
}));

// Target: DataImportSessionAcceptFields
// Name: api-import-session-accept-fields
importerRouter.get('/api/importer/session/:pk/accept_fields', (c) => c.json({
  message: 'GET endpoint for DataImportSessionAcceptFields',
  route: '/api/importer/session/<int:pk>/accept_fields/'
}));

// Target: DataImportSessionAcceptRows
// Name: api-import-session-accept-rows
importerRouter.get('/api/importer/session/:pk/accept_rows', (c) => c.json({
  message: 'GET endpoint for DataImportSessionAcceptRows',
  route: '/api/importer/session/<int:pk>/accept_rows/'
}));

// Target: DataImportSessionDetail
// Name: api-import-session-detail
importerRouter.get('/api/importer/session/:pk', (c) => c.json({
  message: 'GET endpoint for DataImportSessionDetail',
  route: '/api/importer/session/<int:pk>/'
}));

// Target: DataImportSessionDetail
// Name: api-import-session-detail
importerRouter.put('/api/importer/session/:pk', (c) => c.json({
  message: 'PUT endpoint for DataImportSessionDetail',
  route: '/api/importer/session/<int:pk>/'
}));

// Target: DataImportSessionDetail
// Name: api-import-session-detail
importerRouter.delete('/api/importer/session/:pk', (c) => c.json({
  message: 'DELETE endpoint for DataImportSessionDetail',
  route: '/api/importer/session/<int:pk>/'
}));

// Target: DataImportSessionList
// Name: api-importer-session-list
importerRouter.get('/api/importer/session', (c) => c.json({
  message: 'GET endpoint for DataImportSessionList',
  route: '/api/importer/session/'
}));

// Target: DataImportSessionList
// Name: api-importer-session-list
importerRouter.post('/api/importer/session', (c) => c.json({
  message: 'POST endpoint for DataImportSessionList',
  route: '/api/importer/session/'
}));

// Target: DataImportColumnMappingDetail
// Name: api-importer-mapping-detail
importerRouter.get('/api/importer/column-mapping/:pk', (c) => c.json({
  message: 'GET endpoint for DataImportColumnMappingDetail',
  route: '/api/importer/column-mapping/<int:pk>/'
}));

// Target: DataImportColumnMappingDetail
// Name: api-importer-mapping-detail
importerRouter.put('/api/importer/column-mapping/:pk', (c) => c.json({
  message: 'PUT endpoint for DataImportColumnMappingDetail',
  route: '/api/importer/column-mapping/<int:pk>/'
}));

// Target: DataImportColumnMappingDetail
// Name: api-importer-mapping-detail
importerRouter.delete('/api/importer/column-mapping/:pk', (c) => c.json({
  message: 'DELETE endpoint for DataImportColumnMappingDetail',
  route: '/api/importer/column-mapping/<int:pk>/'
}));

// Target: DataImportColumnMappingList
// Name: api-importer-mapping-list
importerRouter.get('/api/importer/column-mapping', (c) => c.json({
  message: 'GET endpoint for DataImportColumnMappingList',
  route: '/api/importer/column-mapping/'
}));

// Target: DataImportColumnMappingList
// Name: api-importer-mapping-list
importerRouter.post('/api/importer/column-mapping', (c) => c.json({
  message: 'POST endpoint for DataImportColumnMappingList',
  route: '/api/importer/column-mapping/'
}));

// Target: DataImportRowDetail
// Name: api-importer-row-detail
importerRouter.get('/api/importer/row/:pk', (c) => c.json({
  message: 'GET endpoint for DataImportRowDetail',
  route: '/api/importer/row/<int:pk>/'
}));

// Target: DataImportRowDetail
// Name: api-importer-row-detail
importerRouter.put('/api/importer/row/:pk', (c) => c.json({
  message: 'PUT endpoint for DataImportRowDetail',
  route: '/api/importer/row/<int:pk>/'
}));

// Target: DataImportRowDetail
// Name: api-importer-row-detail
importerRouter.delete('/api/importer/row/:pk', (c) => c.json({
  message: 'DELETE endpoint for DataImportRowDetail',
  route: '/api/importer/row/<int:pk>/'
}));

// Target: DataImportRowList
// Name: api-importer-row-list
importerRouter.get('/api/importer/row', (c) => c.json({
  message: 'GET endpoint for DataImportRowList',
  route: '/api/importer/row/'
}));

// Target: DataImportRowList
// Name: api-importer-row-list
importerRouter.post('/api/importer/row', (c) => c.json({
  message: 'POST endpoint for DataImportRowList',
  route: '/api/importer/row/'
}));
