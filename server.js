import app from "./backend/app.js";

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});
