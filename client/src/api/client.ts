import axios from 'axios';

/**
 * Single configured Axios instance for all API calls.
 *
 * baseURL is read from VITE_API_BASE_URL (set in client/.env).
 * Timeout is 15 seconds — explain and nl-to-sql calls involve Gemini
 * and can take longer than typical REST requests.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;
