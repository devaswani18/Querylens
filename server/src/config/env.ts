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

// DATABASE_URL is intentionally optional at runtime — it is for setup scripts only (schema.sql / seed.sql).
// The app itself ONLY uses the two scoped connection strings below.
const config = {
  databaseUrl: process.env['DATABASE_URL'] ?? '', // setup scripts only — not used by the running app
  databaseUrlReadonly: requireEnv('DATABASE_URL_READONLY'),
  databaseUrlIndexManager: requireEnv('DATABASE_URL_INDEX_MANAGER'),
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
} as const;

export type Config = typeof config;
export default config;
