import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[QueryLens] Missing required environment variable: ${name}\n` +
        `Ensure your .env file is present and contains ${name}=<value>`,
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

// All three DATABASE_URL variants are required at runtime:
// DATABASE_URL             — superuser connection, used by adminPool for CREATE INDEX execution
// DATABASE_URL_READONLY    — read-only role, used by /api/query/execute and /api/explain
// DATABASE_URL_INDEX_MANAGER — retained for potential future use
const config = {
  databaseUrl: requireEnv('DATABASE_URL'),
  databaseUrlReadonly: requireEnv('DATABASE_URL_READONLY'),
  databaseUrlIndexManager: requireEnv('DATABASE_URL_INDEX_MANAGER'),
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
} as const;

export type Config = typeof config;
export default config;
