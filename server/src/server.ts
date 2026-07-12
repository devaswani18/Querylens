import app from './app';
import config from './config/env';

// config is imported first — this triggers dotenv.config() and validates all
// required env vars at startup, throwing immediately if any are missing.

const server = app.listen(config.port, () => {
  console.log(`[QueryLens] Server running on port ${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown: release the pg pools when the process exits.
process.on('SIGTERM', () => {
  console.log('[QueryLens] SIGTERM received — shutting down gracefully...');
  server.close(() => {
    console.log('[QueryLens] HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[QueryLens] SIGINT received — shutting down gracefully...');
  server.close(() => {
    console.log('[QueryLens] HTTP server closed.');
    process.exit(0);
  });
});
