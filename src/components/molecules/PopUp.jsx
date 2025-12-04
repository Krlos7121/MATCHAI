import PropTypes from "prop-types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from "@mui/material";

const PopUp = ({
  open = false,
  title = "",
  content = "",
  onClose = () => {},
  onConfirm = () => {},
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  children = null,
  fullWidth = true,
  maxWidth = "sm",
  hideActions = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth={fullWidth}
      maxWidth={maxWidth}>
      {title && <DialogTitle>{title}</DialogTitle>}
      <DialogContent>
        <Box sx={{ py: 2 }}>{children || content}</Box>
      </DialogContent>
      {!hideActions && (
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={onClose} variant="outlined">
            {cancelText}
          </Button>
          <Button onClick={onConfirm} variant="contained">
            {confirmText}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

PopUp.propTypes = {
  open: PropTypes.bool,
  title: PropTypes.string,
  content: PropTypes.string,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  children: PropTypes.node,
  fullWidth: PropTypes.bool,
  maxWidth: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
  hideActions: PropTypes.bool,
};

export default PopUp;
