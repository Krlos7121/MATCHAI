import logo from "../assets/logo.png";

export default function AppLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src={logo} alt="logo" style={{ width: 100 }} />
    </div>
  );
}
