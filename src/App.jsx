import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UploadPage from "./components/pages/UploadPage";
import ResultsPage from "./components/pages/ResultsPage"; // Nueva página para mostrar resultados

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
