export default function Label({ children, style, ...props }) {
  const baseStyle = {
    display: "inline-block",
    width: "100%",
    padding: "14px",
    fontWeight: "bold",
    fontSize: "1rem",
    color: "#000000ff",
    textAlign: "center",
    borderRadius: 4,
    cursor: "default",
  };

  return (
    <label style={{ ...baseStyle, ...style }} {...props}>
      {children}
    </label>
  );
}
