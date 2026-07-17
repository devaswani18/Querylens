import { Request, Response, NextFunction } from 'express';
import { applyIndex } from './applyIndex.service';

/**
 * POST /api/apply-index
 *
 * Request body: { statement: string }
 *
 * Success (200):
 * { "success": true, "data": { "applied": true, "statement": "CREATE INDEX ..." } }
 *
 * Failure: statement not in the known-suggestions store → 403, INDEX_STATEMENT_MISMATCH
 */
export async function applyIndexController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { statement } = req.body as { statement?: unknown };

    if (typeof statement !== 'string' || statement.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Request body must contain a non-empty "statement" string.',
        },
      });
      return;
    }

    await applyIndex(statement);

    res.status(200).json({
      success: true,
      data: {
        applied: true,
        statement,
      },
    });
  } catch (err) {
    next(err);
  }
}
