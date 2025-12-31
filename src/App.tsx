import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ClearIcon from "@mui/icons-material/Clear";

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
  const toGCalUTC = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const start = toGCalUTC(a.dueISO);
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

  // validation + snackbar
  const [titleTouched, setTitleTouched] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  function showError(message: string) {
    setSnack({ open: true, message });
  }

  // filters
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UPCOMING" | "OVERDUE" | "DUESOON">(
    "ALL"
  );
  const [sortOrder, setSortOrder] = useState<"DUE_ASC" | "DUE_DESC">("DUE_ASC");

  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const c = (i.course ?? "").trim();
      if (c) set.add(c);
    });
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtersActive =
    query.trim() !== "" ||
    courseFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    sortOrder !== "DUE_ASC";

  function clearFilters() {
    setQuery("");
    setCourseFilter("ALL");
    setStatusFilter("ALL");
    setSortOrder("DUE_ASC");
  }

  // load/save
  useEffect(() => setItems(loadAssignments()), []);
  useEffect(() => saveAssignments(items), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = DateTime.now().setZone(TZ);

    const matchesQuery = (a: Assignment) => {
      if (!q) return true;
      const hay = `${a.title} ${a.course ?? ""} ${a.notes ?? ""}`.toLowerCase();
      return hay.includes(q);
    };

    const matchesCourse = (a: Assignment) => {
      if (courseFilter === "ALL") return true;
      return (a.course ?? "").trim() === courseFilter;
    };

    const matchesStatus = (a: Assignment) => {
      if (statusFilter === "ALL") return true;
      const dueLocal = DateTime.fromISO(a.dueISO).setZone(TZ);
      const diffHours = dueLocal.diff(now, "hours").hours;

      if (statusFilter === "OVERDUE") return diffHours < 0;
      if (statusFilter === "DUESOON") return diffHours >= 0 && diffHours <= 48;
      if (statusFilter === "UPCOMING") return diffHours > 48;
      return true;
    };

    return items
      .filter(matchesQuery)
      .filter(matchesCourse)
      .filter(matchesStatus)
      .sort((a, b) => {
        const tA = new Date(a.dueISO).getTime();
        const tB = new Date(b.dueISO).getTime();
        return sortOrder === "DUE_ASC" ? tA - tB : tB - tA;
      });
  }, [items, query, courseFilter, statusFilter, sortOrder]);

  const now = DateTime.now().setZone(TZ);

  function resetForm() {
    setEditingId(null);
    setCourse("");
    setTitle("");
    setDue(DateTime.now().setZone(TZ));
    setNotes("");
    setTitleTouched(false);
  }

  function onSubmit() {
    // Mark touched so field-level error shows
    setTitleTouched(true);

    if (!title.trim()) {
      showError("Please enter a title.");
      return;
    }
    if (!due) {
      showError("Please choose a due date and time.");
      return;
    }

    const dueISO = due.setZone(TZ).toISO();
    if (!dueISO) {
      showError("Invalid due date. Please pick again.");
      return;
    }

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
    setTitleTouched(false);
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
        {/* Form */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mx: "auto", maxWidth: 720, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">{editingId ? "Edit assignment" : "Add assignment"}</Typography>
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

        {/* List */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="h6">Assignments</Typography>

            {filtersActive && (
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                sx={{ alignSelf: { xs: "flex-start", sm: "auto" } }}
              >
                Clear filters
              </Button>
            )}
          </Stack>

          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Search title/course/notes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel>Course</InputLabel>
                <Select
                  label="Course"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(String(e.target.value))}
                >
                  {courseOptions.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c === "ALL" ? "All courses" : c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <ToggleButtonGroup
                value={statusFilter}
                exclusive
                onChange={(_, v) => v && setStatusFilter(v)}
                size="small"
              >
                <ToggleButton value="ALL">All</ToggleButton>
                <ToggleButton value="OVERDUE">Overdue</ToggleButton>
                <ToggleButton value="DUESOON">Due soon</ToggleButton>
                <ToggleButton value="UPCOMING">Upcoming</ToggleButton>
              </ToggleButtonGroup>

              <ToggleButtonGroup
                value={sortOrder}
                exclusive
                onChange={(_, v) => v && setSortOrder(v)}
                size="small"
                sx={{ ml: { sm: "auto" } }}
              >
                <ToggleButton value="DUE_ASC">Soonest</ToggleButton>
                <ToggleButton value="DUE_DESC">Latest</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {items.length === 0 ? (
            <Typography color="text.secondary">No assignments yet.</Typography>
          ) : filtered.length === 0 ? (
            <Typography color="text.secondary">
              No results. Try clearing filters or changing your search.
            </Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {filtered.map((a) => {
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
                        onClick={() =>
                          window.open(toGoogleCalendarUrl(a), "_blank", "noopener,noreferrer")
                        }
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
                {filtered.map((a) => {
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
                          onClick={() =>
                            window.open(toGoogleCalendarUrl(a), "_blank", "noopener,noreferrer")
                          }
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

      {/* Error popup */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
