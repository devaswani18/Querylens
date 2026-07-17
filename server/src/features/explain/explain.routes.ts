import { Router } from 'express';
import { explainController } from './explain.controller';

const router = Router();

// POST /api/explain
router.post('/', explainController);

export default router;
