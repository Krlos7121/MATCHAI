import Box from "@mui/material/Box";
import Label from "./Label";

export default function ResultsBox({ children, sx, ...props }) {
  return (
    <Box
      {...props}
      sx={{
        width: "100%",
        minHeight: 100,
        border: "none",
        borderRadius: "20px",
        backgroundColor: "transparent",
        transition: "0.15s ease-in-out",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        p: 2,
        position: "relative",
        boxShadow: "none",
        ...sx,
      }}>
      {children}
    </Box>
  );
}
