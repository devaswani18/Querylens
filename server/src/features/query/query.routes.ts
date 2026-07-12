import { Router } from 'express';
import { executeQueryController } from './query.controller';

const router = Router();

// POST /api/query/execute
router.post('/execute', executeQueryController);

export default router;
