import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { DateTime } from "luxon";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { Assignment } from "../types";

const TZ = "America/Toronto";
const PLAN_KEY = "assignment_plan_day_overrides_v1";

// Day plan settings
const CHUNK_MINUTES = 30; // each “task chunk” is ~30m (last chunk can be smaller)
const MIN_LAST_CHUNK = 10; // don’t create silly 1–5 minute chunks

type ChunkOverride = {
  done?: boolean;
  dayISO?: string; // YYYY-MM-DD override (user moves chunk to another day)
};

type OverridesByChunkKey = Record<string, ChunkOverride>;

/** deterministic so overrides survive refresh: `${assignmentId}|${chunkIndex}` */
function chunkKey(assignmentId: string, index: number) {
  return `${assignmentId}|${index}`;
}

function loadOverrides(): OverridesByChunkKey {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OverridesByChunkKey;
  } catch {
    return {};
  }
}

function saveOverrides(state: OverridesByChunkKey) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(state));
}

type PlanChunk = {
  key: string;
  assignmentId: string;
  course?: string;
  title: string;
  dueISO: string;

  dayISO: string; // YYYY-MM-DD (planned day)
  minutes: number;
  done: boolean;
};

function formatDayLabel(dayISO: string) {
  const today = DateTime.now().setZone(TZ).startOf("day");
  const d = DateTime.fromISO(dayISO).setZone(TZ).startOf("day");
  const diff = d.diff(today, "days").days;

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toFormat("ccc, LLL d");
}

function dueStatusChip(dueISO: string) {
  const now = DateTime.now().setZone(TZ);
  const due = DateTime.fromISO(dueISO).setZone(TZ);
  const diffHours = due.diff(now, "hours").hours;

  if (diffHours < 0) return <Chip size="small" label="Overdue" color="error" />;
  if (diffHours <= 48) return <Chip size="small" label="Due soon" color="warning" />;
  return <Chip size="small" label="Upcoming" variant="outlined" />;
}

function clampToView(dayISO: string, viewStartISO: string, viewEndISO: string) {
  if (dayISO < viewStartISO) return viewStartISO;
  if (dayISO > viewEndISO) return viewEndISO;
  return dayISO;
}

/**
 * Build day-based chunks:
 * - total minutes = assignment.estimateMinutes (default 60)
 * - split into 30m chunks (last chunk can be smaller, to match exact estimate)
 * - spread chunks across days from today to min(due day, today+6)
 * - allow overrides: done + dayISO
 */
function buildDayPlan(items: Assignment[], overrides: OverridesByChunkKey): PlanChunk[] {
  const now = DateTime.now().setZone(TZ);
  const viewStart = now.startOf("day");
  const viewEnd = viewStart.plus({ days: 6 }); // 7 days inclusive: today..today+6

  const viewStartISO = viewStart.toISODate()!;
  const viewEndISO = viewEnd.toISODate()!;

  const chunks: PlanChunk[] = [];

  const sorted = [...items].sort(
    (a, b) => new Date(a.dueISO).getTime() - new Date(b.dueISO).getTime()
  );

  for (const a of sorted) {
    const due = DateTime.fromISO(a.dueISO).setZone(TZ);
    const dueDay = due.startOf("day");

    // only plan items that matter near-term (optional, keep as you had it)
    if (due < viewStart.minus({ days: 30 })) continue;

    const totalMinutes = Math.max(30, a.estimateMinutes ?? 60);

    // split into chunks but match exact estimate
    const chunkCount = Math.max(1, Math.ceil(totalMinutes / CHUNK_MINUTES));
    const chunkMinutes: number[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const remaining = totalMinutes - i * CHUNK_MINUTES;
      const mins = Math.min(CHUNK_MINUTES, remaining);

      // merge tiny tail into previous chunk
      if (mins < MIN_LAST_CHUNK && chunkMinutes.length > 0) {
        chunkMinutes[chunkMinutes.length - 1] += mins;
        break;
      }
      chunkMinutes.push(mins);
    }

    // determine planning window days: today..min(dueDay, viewEnd)
    const lastDay = DateTime.min(dueDay, viewEnd);
    const windowDays = Math.max(0, Math.floor(lastDay.diff(viewStart, "days").days));
    const windowLen = windowDays + 1; // number of days in window

    // create list of dayISOs in window
    const days: string[] = [];
    for (let d = 0; d < windowLen; d++) {
      days.push(viewStart.plus({ days: d }).toISODate()!);
    }

    // spread chunks across window (even spread, naturally front-loads when window is small)
    for (let i = 0; i < chunkMinutes.length; i++) {
      const key = chunkKey(a.id, i);
      const ov = overrides[key] ?? {};

      // default day index (even spread)
      const ratio = chunkMinutes.length === 1 ? 0 : i / (chunkMinutes.length - 1);
      const dayIndex = windowLen === 1 ? 0 : Math.round(ratio * (windowLen - 1));
      const defaultDayISO = days[dayIndex];

      const plannedDayISO = clampToView(
        ov.dayISO ?? defaultDayISO,
        viewStartISO,
        viewEndISO
      );

      chunks.push({
        key,
        assignmentId: a.id,
        course: a.course,
        title: a.title,
        dueISO: a.dueISO,
        dayISO: plannedDayISO,
        minutes: chunkMinutes[i],
        done: !!ov.done,
      });
    }
  }

  // sort by day then due
  chunks.sort((x, y) => {
    if (x.dayISO !== y.dayISO) return x.dayISO < y.dayISO ? -1 : 1;
    return new Date(x.dueISO).getTime() - new Date(y.dueISO).getTime();
  });

  return chunks;
}

export default function PlanView({ items }: { items: Assignment[] }) {
  const [overrides, setOverrides] = useState<OverridesByChunkKey>(() => loadOverrides());

  // move-day dialog state
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [movingDate, setMovingDate] = useState<DateTime | null>(null);

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  const plan = useMemo(() => buildDayPlan(items, overrides), [items, overrides]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlanChunk[]>();
    for (const c of plan) {
      if (!map.has(c.dayISO)) map.set(c.dayISO, []);
      map.get(c.dayISO)!.push(c);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([dayISO, list]) => ({
        dayISO,
        label: formatDayLabel(dayISO),
        total: list.reduce((acc, x) => acc + x.minutes, 0),
        list,
      }));
  }, [plan]);

  const doneCount = plan.reduce((acc, c) => acc + (c.done ? 1 : 0), 0);
  const totalMinutes = plan.reduce((acc, c) => acc + c.minutes, 0);
  const remainingMinutes = plan.reduce((acc, c) => acc + (c.done ? 0 : c.minutes), 0);

  function toggleDone(key: string) {
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), done: !(prev[key]?.done ?? false) },
    }));
  }

  function openMoveDay(chunk: PlanChunk) {
    setMovingKey(chunk.key);
    setMovingDate(DateTime.fromISO(chunk.dayISO).setZone(TZ));
  }

  function saveMoveDay() {
    if (!movingKey || !movingDate) {
      setMovingKey(null);
      return;
    }
    const dayISO = movingDate.setZone(TZ).toISODate();
    if (!dayISO) {
      setMovingKey(null);
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [movingKey]: { ...(prev[movingKey] ?? {}), dayISO },
    }));
    setMovingKey(null);
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Typography variant="h6">Plan (next 7 days)</Typography>
          <Typography variant="body2" color="text.secondary">
            {plan.length === 0
              ? "No plan items."
              : `${doneCount}/${plan.length} done · ${Math.round(remainingMinutes / 60)}h left`}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          This plan is day-based (no times). It suggests how many minutes to work each day based on your
          estimated hours. You can check chunks off or move them to another day.
        </Typography>

        {plan.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Planned: {Math.round(totalMinutes / 60)}h · Remaining: {Math.round(remainingMinutes / 60)}h
          </Typography>
        )}

        <Divider />

        {plan.length === 0 ? (
          <Typography color="text.secondary">
            Add estimates + due dates to see a 7-day plan.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {grouped.map((g) => (
              <Box key={g.dayISO}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2">{g.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {g.total}m
                  </Typography>
                </Stack>

                <List dense disablePadding>
                  {g.list.map((c) => {
                    const title = `${c.course ? `[${c.course}] ` : ""}${c.title}`;
                    const dueFmt = DateTime.fromISO(c.dueISO)
                      .setZone(TZ)
                      .toFormat("ccc, LLL d · h:mm a");

                    return (
                      <ListItem
                        key={c.key}
                        disablePadding
                        secondaryAction={
                          <IconButton edge="end" aria-label="move day" onClick={() => openMoveDay(c)}>
                            <EditIcon />
                          </IconButton>
                        }
                        sx={{ borderRadius: 2, overflow: "hidden" }}
                      >
                        <ListItemButton onClick={() => toggleDone(c.key)}>
                          <Checkbox edge="start" checked={c.done} tabIndex={-1} disableRipple />
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {c.minutes}m
                                </Typography>
                                {dueStatusChip(c.dueISO)}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {title} — due {dueFmt}
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>

      {/* Move-day dialog (date only) */}
      <Dialog open={!!movingKey} onClose={() => setMovingKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>Move to another day</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <DatePicker
              label="Day (Toronto)"
              value={movingDate}
              onChange={(v) => setMovingDate(v)}
              sx={{ width: "100%" }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Tip: this only changes the plan view; it doesn't change the assignment's due date.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMovingKey(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveMoveDay} disabled={!movingDate}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
