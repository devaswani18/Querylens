import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config/env';
import queryRoutes from './features/query/query.routes';
import schemaRoutes from './features/schema/schema.routes';
import explainRoutes from './features/explain/explain.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ---------------------------------------------------------------------------
// Security & parsing middleware
// ---------------------------------------------------------------------------
app.use(helmet());

const allowedOrigins =
  config.nodeEnv === 'development'
    ? [/^http:\/\/localhost(:\d+)?$/]   // allow any localhost port in dev
    : [process.env['FRONTEND_ORIGIN']].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
);

app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/query', queryRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/explain', explainRoutes);

// (nlToSql, applyIndex routes will be mounted here in later steps)

// ---------------------------------------------------------------------------
// Central error handler — MUST be last
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
