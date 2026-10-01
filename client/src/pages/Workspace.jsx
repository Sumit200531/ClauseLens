import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, askStream } from '../api';
import CoverageMap from '../components/CoverageMap.jsx';
import AnswerCard from '../components/AnswerCard.jsx';
import SourceDrawer from '../components/SourceDrawer.jsx';
import AskBox from '../components/AskBox.jsx';
import IngestStatus from '../components/IngestStatus.jsx';

const HeroScene = lazy(() => import('../three/HeroScene.jsx'));

export default function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [items, setItems] = useState([]);
  const [asking, setAsking] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [error, setError] = useState('');
  const endRef = useRef();

  // Poll while the policy is being read.
  useEffect(() => {
    let timer;
    let alive = true;
    const load = async () => {
      try {
        const { document } = await api.get(id);
        if (!alive) return;
        setDoc(document);
        if (!['ready', 'failed'].includes(document.status)) timer = setTimeout(load, 700);
        else if (document.status === 'ready') {
          const { questions } = await api.questions(id);
          if (alive) setItems(questions.map((q) => ({ ...q, done: true, used: q.sources.filter((s) => s.used).map((s) => s.n) })));
        }
      } catch (e) {
        setError(e.message);
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [id]);

  const patchLast = (fn) => setItems((list) => list.map((it, i) => (i === list.length - 1 ? { ...it, ...fn(it) } : it)));

  const ask = useCallback(async (question) => {
    setAsking(true);
    setItems((list) => [...list, { _id: `tmp-${Date.now()}`, question, stage: 'retrieving', sources: [], answer: '', verdict: null, done: false }]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    try {
      await askStream(id, question, {
        stage: ({ stage }) => patchLast(() => ({ stage })),
        sources: (sources) => patchLast(() => ({ sources })),
        verdict: ({ verdict }) => patchLast(() => ({ verdict })),
        token: ({ t }) => patchLast((it) => ({ answer: it.answer + t })),
        done: ({ used, latencyMs }) => patchLast(() => ({ done: true, used, latencyMs })),
        error: ({ message }) => patchLast(() => ({ done: true, error: message })),
      });
    } catch (e) {
      patchLast(() => ({ done: true, error: e.message }));
    } finally {
      setAsking(false);
    }
  }, [id]);

  if (error) return <p className="error page-pad">{error} <Link to="/">Go home</Link></p>;
  if (!doc) return <div className="loading-screen" />;

  if (doc.status !== 'ready') {
    return (
      <div className="ingest">
        <Suspense fallback={null}><HeroScene mode="scan" /></Suspense>
        <div className="hero-vignette" />
        <IngestStatus doc={doc} onBack={() => navigate('/')} />
      </div>
    );
  }

  const remove = async () => {
    await api.remove(id).catch(() => {});
    navigate('/');
  };

  return (
    <div className="workspace">
      <header className="ws-top">
        <Link to="/" className="wordmark">ClauseLens</Link>
        <span className="ws-title" title={doc.title}>{doc.title}</span>
        <button className="link-btn" onClick={remove}>Remove policy</button>
      </header>

      <div className="ws-body">
        <CoverageMap doc={doc} onAsk={ask} disabled={asking} />

        <main className="conversation">
          {!items.length && (
            <motion.div className="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <h1>What do you want to know before you claim?</h1>
              <p>Ask in your own words. ClauseLens searches all {doc.chunkCount} clauses of this {doc.pageCount}-page policy and answers only from them.</p>
            </motion.div>
          )}
          {items.map((it, i) => (
            <div key={it._id} ref={i === items.length - 1 ? endRef : undefined}>
              <AnswerCard item={it} onOpenSource={setDrawer} />
            </div>
          ))}
          <AskBox onAsk={ask} disabled={asking} showSuggestions={!items.length} sample={/sample/i.test(doc.title)} />
        </main>
      </div>

      <AnimatePresence>
        {drawer && <SourceDrawer source={drawer.source} question={drawer.question} onClose={() => setDrawer(null)} />}
      </AnimatePresence>
    </div>
  );
}
