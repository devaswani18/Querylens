import { Request, Response, NextFunction } from 'express';
import { getTables, getTableDetails } from './schema.service';

/**
 * GET /api/schema/tables
 *
 * Success (200):
 * { "success": true, "data": { "tables": ["orders", "payments", ...] } }
 */
export async function getTablesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tables = await getTables();
    res.status(200).json({
      success: true,
      data: { tables },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/schema/tables/:name
 *
 * Success (200):
 * { "success": true, "data": { table, columns, indexes } }
 *
 * Failure: unknown table → 404, NOT_FOUND (thrown by schema.service, caught by errorHandler)
 */
export async function getTableDetailsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name } = req.params;

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Table name parameter cannot be empty.',
        },
      });
      return;
    }

    const details = await getTableDetails(name);
    res.status(200).json({
      success: true,
      data: details,
    });
  } catch (err) {
    next(err);
  }
}
