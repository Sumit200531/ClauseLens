import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api';

const HeroScene = lazy(() => import('../three/HeroScene.jsx'));

const line = {
  hidden: { y: '110%' },
  show: (i) => ({ y: 0, transition: { delay: 0.9 + i * 0.14, duration: 0.9, ease: [0.16, 1, 0.3, 1] } }),
};

const STEPS = [
  ['Add your policy', 'Upload the policy wording PDF your insurer sent you, or try our sample policy.'],
  ['It reads every clause', 'The policy is split into clauses, indexed by meaning and by exact wording, and mapped into the rules that decide claims.'],
  ['Ask before you claim', 'Ask in your own words. You get a verdict and a plain answer, and every sentence points to the clause it came from.'],
];

export default function Landing() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.list().then((d) => setDocs(d.documents)).catch(() => {});
  }, []);

  const start = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const { document } = await fn();
      navigate(`/doc/${document._id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const onFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') return setError('Choose a PDF file. Policy wordings are usually PDFs.');
    start(() => api.upload(file));
  };

  return (
    <div
      className="landing"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
    >
      <section className="hero">
        <Suspense fallback={null}>
          <HeroScene mode="hero" />
        </Suspense>
        <div className="hero-vignette" />

        <header className="nav">
          <Link to="/" className="wordmark">ClauseLens</Link>
          <a href="https://github.com/" className="nav-link" target="_blank" rel="noreferrer">Source code</a>
        </header>

        <div className="hero-copy">
          <h1>
            {['Ask your insurance', 'policy anything.'].map((t, i) => (
              <span className="mask" key={t}>
                <motion.span className="mask-line" variants={line} initial="hidden" animate="show" custom={i}>{t}</motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="lede"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.35, duration: 0.8 }}
          >
            Find out whether a treatment is covered, what you will pay yourself, and which deadline could sink your claim. Every answer points to the exact clause.
          </motion.p>
          <motion.div className="cta-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.8 }}>
            <button className="btn btn-lamp" disabled={busy} onClick={() => fileRef.current.click()}>
              {busy ? 'Opening…' : 'Upload policy PDF'}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => start(api.sample)}>
              Try a sample policy
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => onFile(e.target.files[0])} />
          </motion.div>
          {error && <p className="error">{error}</p>}
          <motion.p className="fine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }}>
            Or drop a PDF anywhere on this page. ClauseLens explains your policy; it does not replace your insurer's decision.
          </motion.p>
        </div>
      </section>

      <section className="steps page-pad">
        <ol>
          {STEPS.map(([title, body], i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
            >
              <span className="step-n">{i + 1}</span>
              <h2>{title}</h2>
              <p>{body}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      {docs.length > 0 && (
        <section className="library page-pad">
          <h2>Your policies</h2>
          <ul>
            {docs.map((d) => (
              <li key={d._id}>
                <Link to={`/doc/${d._id}`}>{d.title}</Link>
                <span>{d.status === 'ready' ? `${d.pageCount} pages, ${d.chunkCount} clauses` : d.status === 'failed' ? 'Could not be read' : 'Reading…'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dragging && <div className="drop-overlay">Drop your policy PDF to read it</div>}
    </div>
  );
}
