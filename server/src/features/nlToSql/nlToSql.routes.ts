import { Router } from 'express';
import { nlToSqlController } from './nlToSql.controller';

const router = Router();

// POST /api/nl-to-sql
router.post('/', nlToSqlController);

export default router;
