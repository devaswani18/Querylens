import { geminiModel } from '../../config/gemini';
import { GeminiUnavailableError } from '../../middleware/errorHandler';
import { getTables, getTableDetails } from '../schema/schema.service';

const GEMINI_TIMEOUT_MS = 10_000; // 10 seconds

// ---------------------------------------------------------------------------
// Dynamic schema context — built at request time from the live database,
// then cached with a 60-second TTL so a burst of requests doesn't re-run
// full schema introspection every single time.
//
// This makes the endpoint agnostic to which database is connected: the prompt
// always reflects the real, live schema rather than a hardcoded assumption.
// ---------------------------------------------------------------------------

const SCHEMA_CACHE_TTL_MS = 60_000; // 60 seconds

let schemaCache: {
  context: string;
  builtAt: number; // Date.now() timestamp
} | null = null;

/**
 * Returns a human-readable schema description built from the live database.
 * Uses a module-level cache with a 60-second TTL.
 */
async function getSchemaContext(): Promise<string> {
  const now = Date.now();

  if (schemaCache && now - schemaCache.builtAt < SCHEMA_CACHE_TTL_MS) {
    return schemaCache.context;
  }

  const context = await buildSchemaContext();
  schemaCache = { context, builtAt: now };
  return context;
}

/**
 * Fetches every table's details via the schema service and formats them
 * into a text block matching the style Gemini was prompted with before.
 */
async function buildSchemaContext(): Promise<string> {
  const tableNames = await getTables();

  // Fetch all table details in parallel — safe since readonlyPool is a
  // connection pool and these are lightweight information_schema queries.
  const tableDetails = await Promise.all(
    tableNames.map((name) => getTableDetails(name)),
  );

  const lines: string[] = ['Database: PostgreSQL', '', 'Tables and columns:', ''];

  for (const details of tableDetails) {
    lines.push(`${details.table}(`);

    for (const col of details.columns) {
      const annotations: string[] = [];

      if (col.isPrimaryKey) annotations.push('PRIMARY KEY');
      if (col.isForeignKey && col.referencesTable && col.referencesColumn) {
        annotations.push(`REFERENCES ${col.referencesTable}(${col.referencesColumn})`);
      }

      const suffix = annotations.length > 0 ? `  -- ${annotations.join(', ')}` : '';
      lines.push(`  ${col.name} ${col.type.toUpperCase()}${suffix}`);
    }

    lines.push(')');
    lines.push('');
  }

  return lines.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Markdown code-fence stripper
// LLMs often wrap output in ```sql ... ``` despite instructions not to.
// ---------------------------------------------------------------------------
function stripCodeFences(text: string): string {
  // Remove opening fence: ```sql or ``` (with optional language tag)
  let result = text.replace(/^```[a-z]*\s*/i, '');
  // Remove closing fence
  result = result.replace(/\s*```\s*$/, '');
  return result.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a natural-language prompt to Gemini and returns a validated
 * PostgreSQL SELECT statement.
 *
 * Throws GeminiUnavailableError on any API failure — unlike explanation.service.ts,
 * this endpoint's entire purpose is SQL generation, so failure here is a real error.
 */
export async function generateSql(prompt: string): Promise<string> {
  let rawResponse: string;
  try {
    // buildPrompt awaits getSchemaContext() which queries the database.
    // Keeping it inside the try block means a DB failure is caught and
    // converted to GeminiUnavailableError below — same "try again" outcome
    // for the client regardless of whether the DB or Gemini is the cause.
    const fullPrompt = await buildPrompt(prompt);

    const result = await Promise.race([
      geminiModel.generateContent(fullPrompt),
      timeout(GEMINI_TIMEOUT_MS),
    ]);
    rawResponse = result.response.text();
  } catch (err) {
    console.error('[QueryLens] Gemini SQL generation failed:', err);
    throw new GeminiUnavailableError(
      'The AI SQL generation service is temporarily unavailable. Please try again.',
    );
  }

  return stripCodeFences(rawResponse);
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

async function buildPrompt(userPrompt: string): Promise<string> {
  const schemaContext = await getSchemaContext();

  return `You are a PostgreSQL query generator. Generate a single valid PostgreSQL SELECT statement for the following database schema and user request.

SCHEMA:
${schemaContext}

RULES — follow these exactly:
1. Output ONLY the raw SQL query. No explanation, no commentary, no markdown code fences (no backticks).
2. The output must be a single SELECT statement. Never output INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, or any other DDL or DML.
3. Do not add a trailing semicolon.
4. Use only the tables and columns defined in the schema above — do not invent columns or tables.

USER REQUEST:
${userPrompt}

SQL:`;
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini call timed out after ${ms}ms`)), ms),
  );
}
