import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Question from '../models/Question.js';
import { config } from '../config.js';
import { getProvider } from '../ai/index.js';
import { extractPdfPages } from '../rag/pdf.js';
import { ANSWER_SYSTEM, answerPrompt } from '../rag/prompts.js';
import { createVerdictParser, citedNumbers } from '../rag/verdict.js';
import { ingest } from '../services/ingest.js';
import { retrieve, invalidate } from '../services/retrieve.js';
import { SAMPLE_PAGES, SAMPLE_TITLE } from '../sample/policy.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(Object.assign(new Error('Upload a PDF file.'), { status: 400 })),
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });

// Anonymous workspaces: the browser keeps a random id, documents are scoped to it.
router.use((req, _res, next) => {
  const ws = req.get('x-workspace');
  if (!ws || !/^[a-zA-Z0-9-]{8,64}$/.test(ws)) return next(fail(400, 'Missing workspace id.'));
  req.workspace = ws;
  next();
});

async function findDoc(req) {
  const doc = await Document.findOne({ _id: req.params.id, workspace: req.workspace });
  if (!doc) throw fail(404, 'Document not found.');
  return doc;
}

router.get('/', wrap(async (req, res) => {
  const documents = await Document.find({ workspace: req.workspace }).sort({ createdAt: -1 }).select('-coverage').lean();
  res.json({ documents });
}));

router.post('/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw fail(400, 'Choose a PDF to upload.');
  const title = (req.body.title || req.file.originalname.replace(/\.pdf$/i, '')).slice(0, 200);
  const doc = await Document.create({ workspace: req.workspace, title, progress: 5 });
  res.status(202).json({ document: doc });

  // Continue in the background; the client polls status.
  try {
    const pages = await extractPdfPages(req.file.buffer);
    const chars = pages.reduce((n, p) => n + p.text.length, 0);
    if (chars < 200) throw new Error('This PDF has no text layer (it may be a scan). Upload a text-based PDF.');
    await ingest(doc._id, pages);
  } catch (err) {
    await Document.updateOne({ _id: doc._id }, { $set: { status: 'failed', error: err.message.slice(0, 300) } });
  }
}));

router.post('/sample', wrap(async (req, res) => {
  const doc = await Document.create({ workspace: req.workspace, title: SAMPLE_TITLE, progress: 5 });
  res.status(202).json({ document: doc });
  ingest(doc._id, SAMPLE_PAGES.map((text, i) => ({ page: i + 1, text })));
}));

router.get('/:id', wrap(async (req, res) => {
  res.json({ document: await findDoc(req) });
}));

router.get('/:id/chunks/:idx', wrap(async (req, res) => {
  const doc = await findDoc(req);
  const chunk = await Chunk.findOne({ doc: doc._id, idx: Number(req.params.idx) }).lean();
  if (!chunk) throw fail(404, 'Clause not found.');
  res.json({ chunk });
}));

router.get('/:id/questions', wrap(async (req, res) => {
  const doc = await findDoc(req);
  res.json({ questions: await Question.find({ doc: doc._id }).sort({ createdAt: 1 }).lean() });
}));

router.delete('/:id', wrap(async (req, res) => {
  const doc = await findDoc(req);
  await Promise.all([Chunk.deleteMany({ doc: doc._id }), Question.deleteMany({ doc: doc._id }), doc.deleteOne()]);
  invalidate(doc._id);
  res.json({ ok: true });
}));

/**
 * Ask a question. Streams Server-Sent Events:
 *   stage   { stage: 'retrieving' | 'answering' }
 *   sources [ { n, idx, page, section, text, via } ]
 *   verdict { verdict }
 *   token   { t }
 *   done    { id, used: [n], latencyMs }
 *   error   { message }
 */
router.post('/:id/ask', rateLimit({ windowMs: 60_000, limit: 15 }), wrap(async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (question.length < 3 || question.length > 500) throw fail(400, 'Ask a question between 3 and 500 characters.');
  const doc = await findDoc(req);
  if (doc.status !== 'ready') throw fail(409, 'This policy is still being read. Try again in a moment.');

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  let closed = false;
  req.on('close', () => (closed = true));
  const send = (event, data) => !closed && res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const t0 = Date.now();

  try {
    send('stage', { stage: 'retrieving' });
    const sources = await retrieve(doc, question);
    send('sources', sources);

    const history = (await Question.find({ doc: doc._id }).sort({ createdAt: -1 }).limit(2).lean()).reverse();
    send('stage', { stage: 'answering' });

    const parser = createVerdictParser();
    let verdict = 'UNCLEAR';
    let answer = '';
    const handle = (r) => {
      if (r.verdict) send('verdict', { verdict: (verdict = r.verdict) });
      if (r.text) {
        answer += r.text;
        send('token', { t: r.text });
      }
    };
    await getProvider().stream({
      system: ANSWER_SYSTEM,
      prompt: answerPrompt(question, sources, history),
      question,
      sources,
      onToken: (t) => handle(parser.push(t)),
    });
    handle(parser.end());

    const used = citedNumbers(answer);
    const saved = await Question.create({
      doc: doc._id,
      question,
      answer: answer.trim(),
      verdict,
      sources: sources.map((s) => ({ ...s, used: used.includes(s.n) })),
      latencyMs: Date.now() - t0,
    });
    send('done', { id: saved._id, used, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.error('[ask]', err.message);
    send('error', { message: err.status === 429 ? 'The AI provider is rate limiting requests. Wait a minute and ask again.' : 'Could not answer this question. Check the server logs and your API key.' });
  }
  res.end();
}));

export default router;
