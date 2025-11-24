import Box from "@mui/material/Box";

export default function GraphBox({ success, active, children, sx, ...props }) {
  return (
    <Box
      {...props}
      sx={{
        width: "100%",
        minHeight: 280,
        border: success
          ? "3px solid rgba(76,175,80,0.8)"
          : active
          ? "3px solid rgba(0,0,0,0.7)"
          : "1px solid rgba(0,0,0,0.12)", // sin línea punteada
        borderRadius: "20px",
        backgroundColor: success ? "rgba(76,175,80,0.05)" : "#fafafa",
        transition: "0.15s ease-in-out, box-shadow 0.15s ease-in-out",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        p: 2,
        position: "relative",
        boxShadow: "none",
        ":hover": {
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        },
        ...sx,
      }}>
      {children}
    </Box>
  );
}
