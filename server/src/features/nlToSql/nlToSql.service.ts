import { geminiModel } from '../../config/gemini';
import { GeminiUnavailableError } from '../../middleware/errorHandler';

const GEMINI_TIMEOUT_MS = 10_000; // 10 seconds

// ---------------------------------------------------------------------------
// Schema context — hardcoded from docs/database.md so Gemini knows exactly
// what it is generating SQL against. Update this if the schema changes.
// ---------------------------------------------------------------------------
const SCHEMA_CONTEXT = `
Database: PostgreSQL e-commerce schema

Tables and columns:

users(
  id SERIAL PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMP
)

products(
  id SERIAL PRIMARY KEY,
  name TEXT,
  category TEXT,        -- values: 'Electronics', 'Home', 'Books', 'Clothing', 'Toys'
  price_cents INTEGER,  -- price in cents
  created_at TIMESTAMP
)

orders(
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER,
  total_cents INTEGER,  -- total price in cents
  status TEXT,          -- values: 'pending', 'completed', 'cancelled'
  ordered_at TIMESTAMP
)

payments(
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  amount_cents INTEGER,
  method TEXT,          -- values: 'card', 'upi', 'paypal'
  paid_at TIMESTAMP
)

reviews(
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  user_id INTEGER REFERENCES users(id),
  rating SMALLINT,      -- 1 to 5
  created_at TIMESTAMP
)
`.trim();

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
  const fullPrompt = buildPrompt(prompt);

  let rawResponse: string;
  try {
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

function buildPrompt(userPrompt: string): string {
  return `You are a PostgreSQL query generator. Generate a single valid PostgreSQL SELECT statement for the following database schema and user request.

SCHEMA:
${SCHEMA_CONTEXT}

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
