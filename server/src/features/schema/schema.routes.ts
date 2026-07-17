import { Router } from 'express';
import { getTablesController, getTableDetailsController } from './schema.controller';

const router = Router();

// GET /api/schema/tables
router.get('/tables', getTablesController);

// GET /api/schema/tables/:name
router.get('/tables/:name', getTableDetailsController);

export default router;
