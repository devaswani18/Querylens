import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Named error classes — throw these from route handlers / services so that
// errorHandler can map them to the correct HTTP status and error code.
// ---------------------------------------------------------------------------

export class QueryRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryRejectedError';
  }
}

export class QueryTimeoutError extends Error {
  constructor(message = 'Query exceeded the 10-second execution limit.') {
    super(message);
    this.name = 'QueryTimeoutError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class IndexStatementMismatchError extends Error {
  constructor(message = 'The provided statement does not match any index suggestion generated in this session.') {
    super(message);
    this.name = 'IndexStatementMismatchError';
  }
}

export class GeminiUnavailableError extends Error {
  constructor(message = 'The AI explanation service is temporarily unavailable. Please try again.') {
    super(message);
    this.name = 'GeminiUnavailableError';
  }
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

// ---------------------------------------------------------------------------
// pg error codes we treat specially
// ---------------------------------------------------------------------------
const PG_STATEMENT_TIMEOUT = '57014'; // query_canceled / statement_timeout

interface PgError extends Error {
  code?: string;
}

// ---------------------------------------------------------------------------
// Central error-handling middleware (must be registered LAST in app.ts)
// ---------------------------------------------------------------------------
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // --- QueryRejectedError -------------------------------------------------
  if (err instanceof QueryRejectedError) {
    res.status(400).json({
      success: false,
      error: { code: 'QUERY_REJECTED', message: err.message },
    });
    return;
  }

  // --- InvalidInputError --------------------------------------------------
  if (err instanceof InvalidInputError) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: err.message },
    });
    return;
  }

  // --- QueryTimeoutError (explicit) or pg statement_timeout ---------------
  if (err instanceof QueryTimeoutError) {
    res.status(408).json({
      success: false,
      error: { code: 'QUERY_TIMEOUT', message: err.message },
    });
    return;
  }

  if (isPgError(err) && err.code === PG_STATEMENT_TIMEOUT) {
    res.status(408).json({
      success: false,
      error: {
        code: 'QUERY_TIMEOUT',
        message: 'Query exceeded the 10-second execution limit.',
      },
    });
    return;
  }

  // --- NotFoundError ------------------------------------------------------
  if (err instanceof NotFoundError) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: err.message },
    });
    return;
  }

  // --- IndexStatementMismatchError ----------------------------------------
  if (err instanceof IndexStatementMismatchError) {
    res.status(403).json({
      success: false,
      error: { code: 'INDEX_STATEMENT_MISMATCH', message: err.message },
    });
    return;
  }

  // --- GeminiUnavailableError ---------------------------------------------
  if (err instanceof GeminiUnavailableError) {
    res.status(502).json({
      success: false,
      error: { code: 'GEMINI_UNAVAILABLE', message: err.message },
    });
    return;
  }

  // --- Other pg/DB errors -------------------------------------------------
  if (isPgError(err)) {
    // Sanitize: never return raw SQL error text, pg error code, or file paths.
    console.error('[QueryLens] DB error:', err.message, '| pg code:', err.code);
    res.status(500).json({
      success: false,
      error: {
        code: 'DB_ERROR',
        message: 'An unexpected database error occurred.',
      },
    });
    return;
  }

  // --- Fallback: unknown error --------------------------------------------
  // Log internally, return a safe generic message.
  console.error('[QueryLens] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'DB_ERROR',
      message: 'An unexpected server error occurred.',
    },
  });
}

// ---------------------------------------------------------------------------
// Type guard for pg errors (they carry a `.code` property)
// ---------------------------------------------------------------------------
function isPgError(err: unknown): err is PgError {
  return err instanceof Error && 'code' in err;
}
