import { Request, Response, NextFunction } from 'express';
import { runExplain } from './explain.service';
import { analyzePlan } from './ruleEngine';

/**
 * POST /api/explain
 *
 * Request body: { sql: string }
 *
 * Success (200):
 * {
 *   success: true,
 *   data: {
 *     rawPlan:     { ... },   // full EXPLAIN ANALYZE JSON tree
 *     findings:    { issues: [...], suggestedIndexes: [...] },
 *     explanation: null        // filled in by the Gemini layer in the next step
 *   }
 * }
 */
export async function explainController(
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

    const rawPlan = await runExplain(sql);
    const findings = analyzePlan(rawPlan);

    res.status(200).json({
      success: true,
      data: {
        rawPlan,
        findings,
        explanation: null,
      },
    });
  } catch (err) {
    next(err);
  }
}
