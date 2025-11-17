import Typography from "@mui/material/Typography";
import TextInput from "../atoms/Textinput";

export default function LabeledInput({ label, ...props }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <Typography sx={{ color: "#6a734f", mb: 1 }}>{label}</Typography>
      <TextInput {...props} />
    </div>
  );
}
