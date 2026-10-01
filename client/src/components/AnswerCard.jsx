import { Fragment, useEffect, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import VerdictStamp from './VerdictStamp.jsx';
import SourceCards from './SourceCards.jsx';

function withCitations(text, sources, onCite) {
  return text.split(/(\[\d{1,2}\])/g).map((part, i) => {
    const m = part.match(/^\[(\d{1,2})\]$/);
    if (!m) return <Fragment key={i}>{part}</Fragment>;
    const s = sources.find((x) => x.n === Number(m[1]));
    return s ? (
      <button key={i} className="cite" onClick={() => onCite(s)} aria-label={`Open clause ${m[1]}, page ${s.page}`}>
        {m[1]}
      </button>
    ) : null;
  });
}

export default function AnswerCard({ item, onOpenSource }) {
  const controls = useAnimationControls();
  const [live] = useState(!item.done); // only animate answers that stream in now

  // A small jolt when the stamp lands.
  useEffect(() => {
    if (item.verdict && live) {
      controls.start({ x: [0, -5, 4, -2, 0], transition: { delay: 0.12, duration: 0.35 } });
    }
  }, [item.verdict, live, controls]);

  const open = (source) => onOpenSource({ source, question: item.question });
  const paragraphs = (item.answer || '').split(/\n{2,}/).filter(Boolean);

  return (
    <motion.article className="qa" initial={live ? { opacity: 0, y: 24 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h3 className="question">{item.question}</h3>

      {!item.sources?.length && !item.error && (
        <p className="searching"><span className="scan-bar" />Searching every clause</p>
      )}
      {item.sources?.length > 0 && (
        <SourceCards sources={item.sources} used={item.used} done={item.done} onOpen={open} animate={live} />
      )}

      <motion.div className="answer" animate={controls}>
        {item.verdict && <VerdictStamp verdict={item.verdict} animate={live} />}
        {paragraphs.map((p, i) => (
          <p key={i}>
            {withCitations(p, item.sources || [], open)}
            {!item.done && i === paragraphs.length - 1 && <span className="caret" />}
          </p>
        ))}
        {item.error && <p className="error">{item.error}</p>}
      </motion.div>

      {item.done && !item.error && (
        <p className="qa-meta">
          Based on {item.used?.length || 0} of {item.sources?.length || 0} retrieved clauses
          {item.latencyMs ? `, answered in ${(item.latencyMs / 1000).toFixed(1)} s` : ''}. Check the clauses before you rely on it.
        </p>
      )}
    </motion.article>
  );
}
