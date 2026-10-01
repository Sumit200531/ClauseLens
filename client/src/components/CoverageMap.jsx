import { motion } from 'framer-motion';

const KIND = {
  waiting: 'Waiting period',
  exclusion: 'Not covered',
  limit: 'Limit',
  copay: 'Co-payment',
  claim: 'Claim rule',
  benefit: 'Covered',
};
const ORDER = ['waiting', 'exclusion', 'limit', 'copay', 'claim', 'benefit'];

export default function CoverageMap({ doc, onAsk, disabled }) {
  const cov = doc.coverage || {};
  const items = [...(cov.highlights || [])].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return (
    <aside className="coverage">
      <h2>Coverage map</h2>
      {cov.sumInsured && (
        <div className="sum">
          <span className="sum-value">{cov.sumInsured}</span>
          <span className="sum-label">sum insured{cov.planName ? `, ${cov.planName}` : ''}</span>
        </div>
      )}
      {cov.summary && <p className="cov-summary">{cov.summary}</p>}

      <p className="cov-hint">The rules most likely to affect a claim. Select one to have it explained.</p>
      <ul className="rules">
        {items.map((h, i) => (
          <motion.li
            key={`${h.label}-${i}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <button className={`rule rule-${h.kind}`} disabled={disabled} onClick={() => onAsk(`Explain the "${h.label}" rule and how it could affect my claim.`)}>
              <span className="rule-kind">{KIND[h.kind]}{h.page ? `, page ${h.page}` : ''}</span>
              <span className="rule-label">{h.label}</span>
              <span className="rule-value">{h.value}</span>
            </button>
          </motion.li>
        ))}
      </ul>
    </aside>
  );
}
