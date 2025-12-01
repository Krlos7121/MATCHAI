import {
  HashRouter,   // usamos HashRouter para que funcione en Electron
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import UploadPage from "./components/pages/UploadPage";
import ResultsPage from "./components/pages/ResultsPage";
import { AnimatePresence, motion } from "framer-motion";

console.log("APP REAL SE IMPORTÓ");

function AppContent() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <UploadPage />
            </motion.div>
          }
        />
        <Route
          path="/results"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ResultsPage />
            </motion.div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;
