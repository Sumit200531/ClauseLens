import { motion } from 'framer-motion';

const STAGES = [
  ['parsing', 'Reading the pages'],
  ['chunking', 'Splitting it into clauses'],
  ['embedding', 'Indexing what each clause means'],
  ['mapping', 'Mapping the rules that decide claims'],
];

export default function IngestStatus({ doc, onBack }) {
  const current = STAGES.findIndex(([s]) => s === doc.status);

  if (doc.status === 'failed') {
    return (
      <div className="ingest-panel">
        <h1>This policy could not be read.</h1>
        <p className="error">{doc.error || 'Something went wrong while reading the file.'}</p>
        <button className="btn btn-lamp" onClick={onBack}>Try another file</button>
      </div>
    );
  }

  return (
    <motion.div className="ingest-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
      <p className="ingest-title">{doc.title}</p>
      <h1>Reading every clause, so you don't have to.</h1>
      <ol className="stages">
        {STAGES.map(([key, label], i) => (
          <li key={key} className={i < current ? 'done' : i === current ? 'now' : ''}>
            <span className="dot" />
            {label}
            {key === 'chunking' && doc.chunkCount > 0 && i < current && <em>{doc.chunkCount} clauses</em>}
          </li>
        ))}
      </ol>
      <div className="meter" role="progressbar" aria-valuenow={doc.progress} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="meter-fill" animate={{ width: `${doc.progress}%` }} transition={{ ease: 'easeOut', duration: 0.6 }} />
      </div>
    </motion.div>
  );
}
