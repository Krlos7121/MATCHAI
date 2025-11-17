import Button from "@mui/material/Button";

export default function MuiButton({ children, ...props }) {
  return (
    <Button
      variant="contained"
      fullWidth
      sx={{
        padding: "14px",
        fontWeight: "bold",
        fontSize: "1rem",
        backgroundColor: "#484F31",
      }}
      {...props}>
      {children}
    </Button>
  );
}
