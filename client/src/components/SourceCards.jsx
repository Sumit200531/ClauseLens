import { motion } from 'framer-motion';

const via = (v) =>
  v.length > 1 ? 'Matched by meaning and wording' : v[0] === 'meaning' ? 'Matched by meaning' : 'Matched by wording';

/** Retrieved clauses fly in from depth, so you can watch the search happen. */
export default function SourceCards({ sources, used, done, onOpen, animate }) {
  return (
    <ul className="sources" style={{ perspective: 900 }}>
      {sources.map((s, i) => {
        const isUsed = used?.includes(s.n);
        return (
          <motion.li
            key={s.n}
            initial={animate ? { opacity: 0, z: -400, rotateX: 35, y: 60, filter: 'blur(10px)' } : false}
            animate={{ opacity: done && !isUsed ? 0.45 : 1, z: 0, rotateX: 0, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: animate ? i * 0.09 : 0, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <button className={`source ${isUsed ? 'used' : ''}`} onClick={() => onOpen(s)}>
              <span className="source-n">{s.n}</span>
              <span className="source-where">Page {s.page}</span>
              <span className="source-section">{s.section || 'Untitled clause'}</span>
              <span className="source-via">{via(s.via || [])}</span>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}
