import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { getProvider } from './ai/index.js';
import documentRoutes from './routes/documents.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, provider: getProvider().name }));
app.use('/api/documents', documentRoutes);

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `PDF must be under ${config.maxUploadMb} MB.` });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id.' });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  if (res.headersSent) return res.end();
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
});

getProvider(); // fail fast on a missing API key
mongoose
  .connect(config.mongoUri)
  .then(() => app.listen(config.port, () => console.log(`ClauseLens API on http://localhost:${config.port} (AI: ${getProvider().name})`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
