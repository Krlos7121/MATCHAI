import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import LoginPage from "./components/pages/LoginPage";
import UploadPage from "./components/pages/UploadPage";
import theme from "./theme/theme";
// import Dashboard from "./components/pages/Dashboard"; // ejemplo

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          {/* Página inicial */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
