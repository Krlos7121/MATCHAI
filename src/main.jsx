import React from "react";

import { createRoot } from "react-dom/client";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import theme from "./theme/theme";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/900.css";

// createRoot(document.getElementById("root")).render(<App />);

ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme} defaultMode="light">
    <CssBaseline />
    <App />
  </ThemeProvider>
);
