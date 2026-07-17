import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './env';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Pre-configured Gemini 2.5 Flash model instance.
 * Import and call .generateContent() directly — no re-initialization needed.
 */
export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
