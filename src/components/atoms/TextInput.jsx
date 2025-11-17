import TextField from "@mui/material/TextField";

export default function TextInput({ ...props }) {
  return (
    <TextField
      variant="outlined"
      fullWidth
      size="medium"
      sx={{
        backgroundColor: "white",
      }}
      {...props}
    />
  );
}
