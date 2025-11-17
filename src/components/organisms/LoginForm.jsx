import { useState } from "react";
import LabeledInput from "../molecules/LabeledInput";
import MuiButton from "../atoms/MuiButton";
import Logo from "../atoms/Logo";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";

import { loginUser } from "../../services/authService";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Completa todos los campos.");
      return;
    }

    try {
      setLoading(true);
      const result = await loginUser(email, password);
      console.log("LOGIN OK:", result);

      // → Aquí envías al Dashboard
    } catch (err) {
      setError(err.message || "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: 600,
        padding: 10,
        borderRadius: 6,
        backgroundColor: "white",
        boxShadow: "0 10px 35px rgba(0,0,0,0.2)",
        position: "relative",
      }}>
      {/* Logo superior */}
      <Box sx={{ position: "absolute", top: 25, left: 35 }}>
        <Logo />
      </Box>

      <Typography
        variant="h3"
        sx={{
          color: "#6a734f",
          mt: 5,
          mb: 1,
          letterSpacing: 2,
          textAlign: "center",
          textShadow: "2px 2px #36363671",
        }}>
        COWLYTICS
      </Typography>

      <Typography
        variant="h4"
        sx={{
          color: "#6a734f",
          opacity: 0.8,
          mb: 3,
          textAlign: "center",
        }}>
        Detector de problemas vacunos
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <LabeledInput
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <LabeledInput
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <MuiButton type="submit" disabled={loading}>
          {loading ? (
            <CircularProgress size={26} color="inherit" />
          ) : (
            "INICIAR SESIÓN"
          )}
        </MuiButton>
      </form>
    </Box>
  );
}
