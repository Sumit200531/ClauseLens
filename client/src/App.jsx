import { lazy, Suspense } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Landing from './pages/Landing.jsx';

const Workspace = lazy(() => import('./pages/Workspace.jsx'));

export default function App() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(6px)' }}
        transition={{ duration: 0.45 }}
      >
        <Suspense fallback={<div className="loading-screen" />}>
          <Routes location={location}>
            <Route path="/" element={<Landing />} />
            <Route path="/doc/:id" element={<Workspace />} />
            <Route path="*" element={<p className="empty page-pad">This page does not exist. <Link to="/">Go home</Link>.</p>} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
