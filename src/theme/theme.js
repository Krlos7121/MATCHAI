import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  typography: {
    fontFamily: "Poppins, sans-serif",

    h1: {
      fontFamily: "Poppins, sans-serif",
      fontWeight: 700,
      fontSize: "60px",
    },

    h2: {
      fontFamily: "Poppins, sans-serif",
      fontWeight: 700,
      fontSize: "50px",
    },

    h3: {
      fontFamily: "Poppins, sans-serif",
      fontWeight: 700,
      fontSize: "40px",
    },

    h4: {
      fontFamily: "Poppins, sans-serif",
      fontWeight: 400,
      fontStyle: "italic",
      fontSize: 18,
    },
    p: {
      fontFamily: "Poppins, sans-serif",
      fontWeight: 400,
      fontSize: 18,
    },
  },

  palette: {
    primary: {
      main: "#6a734f",
    },
    background: {
      default: "#f5f5f5",
    },
  },

  shape: {
    borderRadius: 14,
  },
});

export default theme;
