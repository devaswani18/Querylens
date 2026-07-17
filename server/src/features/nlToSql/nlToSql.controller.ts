import { Request, Response, NextFunction } from 'express';
import { generateSql } from './nlToSql.service';
import { validateQuery } from '../query/query.validator';
import { QueryRejectedError } from '../../middleware/errorHandler';

/**
 * POST /api/nl-to-sql
 *
 * Request body: { prompt: string }
 *
 * Success (200):
 * { "success": true, "data": { "sql": "SELECT ..." } }
 *
 * The generated SQL is run through validateQuery before being returned —
 * Gemini output is never trusted without the same validation applied to
 * direct user input.
 */
export async function nlToSqlController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { prompt } = req.body as { prompt?: unknown };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Request body must contain a non-empty "prompt" string.',
        },
      });
      return;
    }

    const sql = await generateSql(prompt);

    // Validate the generated SQL through the same allowlist as direct user input.
    // If Gemini produced DDL/DML despite instructions, reject it before it ever
    // reaches the frontend.
    const validation = validateQuery(sql);
    if (!validation.allowed) {
      // Log server-side so we can see when the model misbehaves
      console.error(
        '[QueryLens] Gemini generated invalid SQL that failed validation:',
        sql,
        '| Reason:',
        validation.reason,
      );
      throw new QueryRejectedError(
        'The AI generated a SQL statement that is not permitted. Please rephrase your request.',
      );
    }

    res.status(200).json({
      success: true,
      data: { sql },
    });
  } catch (err) {
    next(err);
  }
}
