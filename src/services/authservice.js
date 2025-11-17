export async function loginUser(email, password) {
  const response = await fetch("https://tu-api-gateway.com/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || "Error en el servidor");
  }

  return response.json();
}
