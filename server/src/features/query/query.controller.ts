import { Request, Response, NextFunction } from 'express';
import { validateQuery } from './query.validator';
import { executeQuery } from './query.service';
import { QueryRejectedError } from '../../middleware/errorHandler';

/**
 * POST /api/query/execute
 *
 * Request body: { sql: string }
 *
 * Success response (200):
 * {
 *   success: true,
 *   data: { rows, rowCount, executionTimeMs, truncated }
 * }
 *
 * Failure responses are handled by errorHandler middleware.
 */
export async function executeQueryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sql } = req.body as { sql?: unknown };

    if (typeof sql !== 'string' || sql.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Request body must contain a non-empty "sql" string.',
        },
      });
      return;
    }

    const validation = validateQuery(sql);
    if (!validation.allowed) {
      throw new QueryRejectedError(validation.reason ?? 'Query rejected.');
    }

    const result = await executeQuery(sql);

    res.status(200).json({
      success: true,
      data: {
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
        truncated: result.truncated,
      },
    });
  } catch (err) {
    next(err);
  }
}
