import { motion } from 'framer-motion';

export const VERDICT_TEXT = {
  COVERED: 'Covered',
  NOT_COVERED: 'Not covered',
  CONDITIONAL: 'Covered, with conditions',
  UNCLEAR: 'Not clear from the policy',
};

/** The rubber stamp that lands on the answer. */
export default function VerdictStamp({ verdict, animate = true }) {
  return (
    <motion.div
      className={`stamp stamp-${verdict.toLowerCase()}`}
      initial={animate ? { scale: 2.6, opacity: 0, rotate: -16 } : false}
      animate={{ scale: 1, opacity: 1, rotate: -3 }}
      transition={{ type: 'spring', stiffness: 520, damping: 17, mass: 0.9 }}
      role="status"
    >
      {VERDICT_TEXT[verdict]}
    </motion.div>
  );
}
