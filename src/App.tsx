import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Snackbar,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { DateTime } from "luxon";

import type { Assignment } from "./types";
import { loadAssignments, saveAssignments } from "./lib/storage";
import { buildICS, downloadICS } from "./lib/ics";

import AssignmentForm from "./components/AssignmentForm";
import AssignmentFilters from "./components/AssignmentFilters";
import type { SortOrder, StatusFilter } from "./components/AssignmentFilters";
import AssignmentList from "./components/AssignmentList";

const TZ = "America/Toronto";

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function toGoogleCalendarUrl(a: Assignment) {
  const title = `${a.course ? `[${a.course}] ` : ""}${a.title}`.trim();

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

  const [items, setItems] = useState<Assignment[]>(() => loadAssignments());
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("DUE_ASC");

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
        <AssignmentForm
          isMobile={isMobile}
          itemsCount={items.length}
          editingId={editingId}
          course={course}
          setCourse={setCourse}
          title={title}
          setTitle={setTitle}
          due={due}
          setDue={setDue}
          notes={notes}
          setNotes={setNotes}
          titleTouched={titleTouched}
          setTitleTouched={setTitleTouched}
          onSubmit={onSubmit}
          resetForm={resetForm}
          exportICS={exportICS}
          exportDisabled={items.length === 0}
        />

        <Box sx={{ height: { xs: 14, sm: 20 } }} />

        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
          <AssignmentFilters
            query={query}
            setQuery={setQuery}
            courseFilter={courseFilter}
            setCourseFilter={setCourseFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            courseOptions={courseOptions}
            filtersActive={filtersActive}
            clearFilters={clearFilters}
          />

          <Divider sx={{ my: 1.5 }} />

          <AssignmentList
            itemsCount={items.length}
            filtered={filtered}
            isMobile={isMobile}
            dueChip={dueChip}
            onEdit={startEdit}
            onDelete={remove}
            toGoogleCalendarUrl={toGoogleCalendarUrl}
          />
        </Paper>
      </Container>

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
