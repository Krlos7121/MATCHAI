import Box from "@mui/material/Box";

export default function DropzoneBox({ dragging, success, children, ...props }) {
  return (
    <Box
      {...props}
      sx={{
        width: "100%",
        minHeight: 280,
        border: success
          ? "3px solid rgba(76,175,80,0.8)" // verde
          : dragging
          ? "3px dashed rgba(0,0,0,0.7)"
          : "3px dashed rgba(0,0,0,0.4)",
        borderRadius: "20px",
        backgroundColor: success
          ? "rgba(76,175,80,0.1)" // verde clarito
          : dragging
          ? "#e9e9e9"
          : "#eeeeee",
        transition: "0.15s ease-in-out",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        cursor: "pointer",
        p: 2,
        position: "relative",
      }}>
      {children}
    </Box>
  );
}
