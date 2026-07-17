import { geminiModel } from '../../config/gemini';
import { RuleEngineFindings } from './ruleEngine';

const GEMINI_TIMEOUT_MS = 10_000; // 10 seconds

const NO_ISSUES_MESSAGE =
  'No performance issues detected. This query appears to be running efficiently.';

/**
 * Sends the rule engine's structured findings to Gemini and returns a
 * plain-English explanation for developers.
 *
 * - Returns a static string immediately if there are no issues (no API call).
 * - Returns null on any Gemini failure (network error, rate limit, API error).
 *   The caller (explain.controller.ts) is responsible for deciding how to
 *   surface a null explanation — per docs/api.md, rawPlan and findings are
 *   still returned even when explanation is unavailable.
 * - Never throws. All errors are caught, logged server-side, and swallowed.
 */
export async function explainFindings(
  findings: RuleEngineFindings,
): Promise<string | null> {
  // Fast path — no Gemini call needed
  if (findings.issues.length === 0) {
    return NO_ISSUES_MESSAGE;
  }

  const prompt = buildPrompt(findings);

  try {
    const result = await Promise.race([
      geminiModel.generateContent(prompt),
      timeout(GEMINI_TIMEOUT_MS),
    ]);

    const text = result.response.text().trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.error('[QueryLens] Gemini explanation failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(findings: RuleEngineFindings): string {
  return `You are a PostgreSQL performance assistant. A deterministic rule engine has already analyzed a query execution plan and identified the following performance findings:

${JSON.stringify(findings, null, 2)}

Your task is ONLY to explain these specific findings in plain English for a developer. Do NOT analyze raw SQL, do NOT invent additional issues, and do NOT suggest anything beyond what the findings already contain.

Write a concise explanation of 2 to 4 sentences that:
- Describes what performance problem was found and why it is slow
- Explains why the suggested index (if present) would help
- Is written for a developer audience
- Uses no markdown formatting, no bullet points, no code blocks, and no headings — plain prose only`;
}

// ---------------------------------------------------------------------------
// Timeout helper — rejects after ms milliseconds
// ---------------------------------------------------------------------------

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini call timed out after ${ms}ms`)), ms),
  );
}
