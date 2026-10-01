import { useState } from 'react';
import { motion } from 'framer-motion';

const GENERIC = [
  'What is not covered by this policy?',
  'What are the waiting periods?',
  'Will I have to pay part of the bill myself?',
  'What is the deadline to tell the insurer about a hospital stay?',
];
const SAMPLE = [
  'Is knee replacement covered if I buy this policy today?',
  'I want a private room. Will that reduce my claim?',
  'Is dental treatment covered?',
  'How quickly must I inform the insurer after an emergency admission?',
];

export default function AskBox({ onAsk, disabled, showSuggestions, sample }) {
  const [q, setQ] = useState('');

  const submit = (text) => {
    const v = (text ?? q).trim();
    if (v.length < 3 || disabled) return;
    onAsk(v);
    setQ('');
  };

  return (
    <div className="askbox-wrap">
      {showSuggestions && (
        <div className="suggestions">
          {(sample ? SAMPLE : GENERIC).map((s, i) => (
            <motion.button
              key={s}
              className="suggestion"
              onClick={() => submit(s)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.07 }}
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}
      <form className="askbox" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea
          rows={1}
          value={q}
          placeholder="Ask about a treatment, a cost or a deadline"
          aria-label="Your question"
          maxLength={500}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className="btn btn-lamp" disabled={disabled || q.trim().length < 3}>{disabled ? 'Answering…' : 'Ask'}</button>
      </form>
    </div>
  );
}
