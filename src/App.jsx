import {
  HashRouter, // 👈 en lugar de BrowserRouter
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import UploadPage from "./components/pages/UploadPage";
import ResultsPage from "./components/pages/ResultsPage";

console.log("APP REAL SE IMPORTÓ");

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
