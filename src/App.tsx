import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { DateTime } from "luxon";

import type { Assignment } from "./types";
import { loadAssignments, saveAssignments } from "./lib/storage";
import { buildICS, downloadICS } from "./lib/ics";

const TZ = "America/Toronto";

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

// Google Calendar “Create event” link (works well on mobile + desktop)
function toGoogleCalendarUrl(a: Assignment) {
  const title = `${a.course ? `[${a.course}] ` : ""}${a.title}`.trim();

  // Google expects UTC timestamps in YYYYMMDDTHHMMSSZ
  const toGCalUTC = (iso: string) => {
    // dueISO is stored with offset; new Date(iso) will represent the correct instant
    return new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  };

  const start = toGCalUTC(a.dueISO);
  // End = +5 minutes (Google prefers start/end to exist)
  const end = toGCalUTC(new Date(new Date(a.dueISO).getTime() + 5 * 60 * 1000).toISOString());

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details: a.notes ?? "",
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export default function App() {
  const isMobile = useMediaQuery("(max-width:600px)");

  const [items, setItems] = useState<Assignment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // form state
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DateTime | null>(DateTime.now().setZone(TZ));
  const [notes, setNotes] = useState("");

  // load/save
  useEffect(() => setItems(loadAssignments()), []);
  useEffect(() => saveAssignments(items), [items]);

  const sorted = useMemo(() => {
    return [...items].sort(
      (a, b) => new Date(a.dueISO).getTime() - new Date(b.dueISO).getTime()
    );
  }, [items]);

  const now = DateTime.now().setZone(TZ);

  function resetForm() {
    setEditingId(null);
    setCourse("");
    setTitle("");
    setDue(DateTime.now().setZone(TZ));
    setNotes("");
  }

  function onSubmit() {
    if (!title.trim()) return;
    if (!due) return;

    const dueISO = due.setZone(TZ).toISO(); // store ISO
    if (!dueISO) return;

    if (editingId) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === editingId
            ? { ...x, course: course.trim(), title: title.trim(), dueISO, notes: notes.trim() }
            : x
        )
      );
    } else {
      const newItem: Assignment = {
        id: uid(),
        course: course.trim(),
        title: title.trim(),
        dueISO,
        notes: notes.trim(),
      };
      setItems((prev) => [newItem, ...prev]);
    }

    resetForm();
  }

  function startEdit(a: Assignment) {
    setEditingId(a.id);
    setCourse(a.course ?? "");
    setTitle(a.title ?? "");
    setDue(DateTime.fromISO(a.dueISO).setZone(TZ));
    setNotes(a.notes ?? "");
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) resetForm();
  }

  function exportICS() {
    const ics = buildICS(items);
    downloadICS("assignments.ics", ics);
  }

  function dueChip(dueISO: string) {
    const d = DateTime.fromISO(dueISO).setZone(TZ);
    const diffHours = d.diff(now, "hours").hours;

    if (diffHours < 0) return <Chip size="small" label="Overdue" color="error" />;
    if (diffHours <= 48) return <Chip size="small" label="Due soon" color="warning" />;
    return <Chip size="small" label="Upcoming" variant="outlined" />;
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Assignment Tracker
          </Typography>

          <Button
            color="inherit"
            startIcon={<DownloadIcon />}
            onClick={exportICS}
            disabled={items.length === 0}
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
          >
            Export .ics
          </Button>

          {/* On mobile: keep a compact export button */}
          <Button
            color="inherit"
            onClick={exportICS}
            disabled={items.length === 0}
            sx={{ display: { xs: "inline-flex", sm: "none" }, minWidth: 0, px: 1.25 }}
          >
            <DownloadIcon />
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        {/* Form card centered */}
        <Paper
          sx={{
            p: { xs: 2, sm: 3 },
            mx: "auto",
            maxWidth: 720,
            borderRadius: 3,
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                {editingId ? "Edit assignment" : "Add assignment"}
              </Typography>
              {items.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {items.length} item{items.length === 1 ? "" : "s"}
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
                fullWidth
                required
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
                disabled={items.length === 0}
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

        <Box sx={{ height: { xs: 14, sm: 20 } }} />

        {/* Assignments list */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Assignments</Typography>
          </Stack>
          <Divider sx={{ my: 1.5 }} />

          {sorted.length === 0 ? (
            <Typography color="text.secondary">No assignments yet.</Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {sorted.map((a) => {
                const dueLocal = DateTime.fromISO(a.dueISO).setZone(TZ);
                return (
                  <Card key={a.id} variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="start">
                        <Box sx={{ pr: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {a.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {a.course || "No course"}
                          </Typography>
                        </Box>
                        {dueChip(a.dueISO)}
                      </Stack>

                      <Typography sx={{ mt: 1 }} variant="body2">
                        <strong>Due:</strong> {dueLocal.toFormat("ccc, LLL d · h:mm a")}
                      </Typography>

                      {a.notes ? (
                        <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">
                          {a.notes}
                        </Typography>
                      ) : null}
                    </CardContent>

                    <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 1.5 }}>
                      <Button
                        size="small"
                        endIcon={<OpenInNewIcon />}
                        onClick={() => window.open(toGoogleCalendarUrl(a), "_blank", "noopener,noreferrer")}
                      >
                        Add to Google
                      </Button>

                      <Box>
                        <IconButton aria-label="edit" onClick={() => startEdit(a)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton aria-label="delete" onClick={() => remove(a.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </CardActions>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Due (Toronto)</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {sorted.map((a) => {
                  const dueLocal = DateTime.fromISO(a.dueISO).setZone(TZ);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{a.course || "-"}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">{a.title}</Typography>
                          {dueChip(a.dueISO)}
                        </Stack>
                      </TableCell>
                      <TableCell>{dueLocal.toFormat("ccc, LLL d, yyyy · h:mm a")}</TableCell>
                      <TableCell
                        sx={{
                          maxWidth: 320,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={a.notes || ""}
                      >
                        {a.notes || "-"}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          onClick={() => window.open(toGoogleCalendarUrl(a), "_blank", "noopener,noreferrer")}
                          sx={{ mr: 1 }}
                        >
                          Add to Google
                        </Button>
                        <IconButton aria-label="edit" onClick={() => startEdit(a)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton aria-label="delete" onClick={() => remove(a.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
