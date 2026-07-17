import { Router } from 'express';
import { applyIndexController } from './applyIndex.controller';

const router = Router();

// POST /api/apply-index
router.post('/', applyIndexController);

export default router;
