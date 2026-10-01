import { useEffect } from 'react';
import { motion } from 'framer-motion';

const STOP = new Set(['the', 'and', 'for', 'are', 'what', 'will', 'does', 'this', 'that', 'with', 'from', 'have', 'covered', 'policy', 'my', 'is', 'if', 'it', 'how', 'explain', 'rule', 'could', 'affect', 'claim']);

function highlight(text, question) {
  const terms = [...new Set((question.toLowerCase().match(/[a-z]{4,}/g) || []).filter((t) => !STOP.has(t)))];
  if (!terms.length) return text;
  // Match each term's stem plus any ending: "replacement" also hits "replacements".
  const re = new RegExp(`\\b((?:${terms.map((t) => t.replace(/s$/, '')).join('|')})\\w*)`, 'gi');
  // split() with one capture group returns [text, match, text, match, ...]
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export default function SourceDrawer({ source, question, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside
        className="drawer"
        role="dialog"
        aria-label={`Clause on page ${source.page}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      >
        <button className="link-btn drawer-close" onClick={onClose}>Close</button>
        <p className="drawer-where">Page {source.page}</p>
        <h2>{source.section || 'Clause'}</h2>
        <blockquote className="clause-text">{highlight(source.text, question)}</blockquote>
        <p className="fine">This is the exact text from your policy that the answer was based on. Words from your question are highlighted.</p>
      </motion.aside>
    </>
  );
}
