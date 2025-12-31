import { Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { DateTime } from "luxon";

type Props = {
  isMobile: boolean;
  itemsCount: number;
  editingId: string | null;

  course: string;
  setCourse: (v: string) => void;

  title: string;
  setTitle: (v: string) => void;

  due: DateTime | null;
  setDue: (v: DateTime | null) => void;

  notes: string;
  setNotes: (v: string) => void;

  titleTouched: boolean;
  setTitleTouched: (v: boolean) => void;

  onSubmit: () => void;
  resetForm: () => void;
  exportICS: () => void;
  exportDisabled: boolean;
};

const TZ = "America/Toronto";

export default function AssignmentForm(props: Props) {
  const {
    isMobile,
    itemsCount,
    editingId,
    course,
    setCourse,
    title,
    setTitle,
    due,
    setDue,
    notes,
    setNotes,
    titleTouched,
    setTitleTouched,
    onSubmit,
    resetForm,
    exportICS,
    exportDisabled,
  } = props;

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mx: "auto", maxWidth: 720, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{editingId ? "Edit assignment" : "Add assignment"}</Typography>
          {itemsCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {itemsCount} item{itemsCount === 1 ? "" : "s"}
            </Typography>
          )}
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Course (optional)"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            fullWidth
          />
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTitleTouched(true)}
            fullWidth
            required
            error={titleTouched && !title.trim()}
            helperText={titleTouched && !title.trim() ? "Title cannot be blank." : " "}
          />
        </Stack>

        <DateTimePicker
          label="Due date & time (Toronto)"
          value={due}
          onChange={(v) => setDue(v)}
          sx={{ width: "100%" }}
        />

        <TextField
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          multiline
          minRows={2}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button variant="contained" onClick={onSubmit} fullWidth={isMobile}>
            {editingId ? "Save changes" : "Add"}
          </Button>
          <Button variant="outlined" onClick={resetForm} fullWidth={isMobile}>
            Clear
          </Button>
          <Button
            variant="text"
            startIcon={<DownloadIcon />}
            onClick={exportICS}
            disabled={exportDisabled}
            fullWidth={isMobile}
          >
            Export .ics
          </Button>
        </Stack>

        <Box sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Tip: On mobile, bulk .ics import can be limited (especially Google Calendar). Use
            “Add to Google” on each item for the smoothest mobile flow.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
