import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Checkbox,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DateTime } from "luxon";
import type { Assignment } from "../types";

const TZ = "America/Toronto";
const PLAN_KEY = "assignment_plan_v1";

type PlanCheckState = Record<string, boolean>;

function loadPlanChecks(): PlanCheckState {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PlanCheckState;
  } catch {
    return {};
  }
}

function savePlanChecks(state: PlanCheckState) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(state));
}

type PlanSession = {
  id: string; // stable-ish id
  assignmentId: string;
  title: string;
  course?: string;
  dueISO: string;
  scheduledISO: string; // when the session is planned for
  minutes: number;
};

function formatDayLabel(dt: DateTime) {
  const today = DateTime.now().setZone(TZ).startOf("day");
  const d = dt.startOf("day");
  const diff = d.diff(today, "days").days;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toFormat("ccc, LLL d");
}

/**
 * Simple heuristic:
 * - due <= 24h: 1 session
 * - due <= 72h: 2 sessions
 * - due <= 7 days: 3 sessions
 * Sessions get placed on earlier days (spread out).
 */
function buildSuggestedSessions(items: Assignment[]): PlanSession[] {
  const now = DateTime.now().setZone(TZ);
  const end = now.plus({ days: 7 }).endOf("day");

  const upcoming = items
    .map((a) => ({ a, due: DateTime.fromISO(a.dueISO).setZone(TZ) }))
    .filter(({ due }) => due <= end) // within 7 days (includes overdue)
    .sort((x, y) => x.due.toMillis() - y.due.toMillis());

  const sessions: PlanSession[] = [];

  for (const { a, due } of upcoming) {
    // skip far overdue items from session gen? (keep them but only schedule today)
    const hoursToDue = due.diff(now, "hours").hours;

    let count = 0;
    if (hoursToDue <= 24) count = 1;
    else if (hoursToDue <= 72) count = 2;
    else if (hoursToDue <= 24 * 7) count = 3;
    else count = 0;

    if (count === 0) continue;

    // choose days to place sessions
    // Always start from "today", then spread: today, +1, +3 (clamped)
    const offsets = count === 1 ? [0] : count === 2 ? [0, 1] : [0, 1, 3];

    for (let i = 0; i < count; i++) {
      const day = now.plus({ days: offsets[i] }).startOf("day");

      // pick a default time slot:
      // - if due is soon, place earlier in the day; else evening is fine
      const scheduled = hoursToDue <= 24
        ? day.plus({ hours: 10 }) // 10:00 AM
        : day.plus({ hours: 19 }); // 7:00 PM

      const minutes = count === 1 ? 90 : 60;

      // ID ties to assignment + session index + scheduled day (so edits don’t fully break)
      const id = `${a.id}|${scheduled.toISODate()}|${i}`;

      sessions.push({
        id,
        assignmentId: a.id,
        title: a.title,
        course: a.course,
        dueISO: a.dueISO,
        scheduledISO: scheduled.toISO() ?? scheduled.toString(),
        minutes,
      });
    }
  }

  // keep only sessions that land within next 7 days
  return sessions
    .map((s) => ({ ...s, scheduled: DateTime.fromISO(s.scheduledISO).setZone(TZ) }))
    .filter((s) => s.scheduled >= now.startOf("day") && s.scheduled <= end)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((x: any, y: any) => DateTime.fromISO(x.scheduledISO).toMillis() - DateTime.fromISO(y.scheduledISO).toMillis())
    // remove the temporary field if needed
    .map(({ scheduled, ...rest }) => rest as PlanSession);
}

function dueStatusChip(dueISO: string) {
  const now = DateTime.now().setZone(TZ);
  const due = DateTime.fromISO(dueISO).setZone(TZ);
  const diffHours = due.diff(now, "hours").hours;

  if (diffHours < 0) return <Chip size="small" label="Overdue" color="error" />;
  if (diffHours <= 48) return <Chip size="small" label="Due soon" color="warning" />;
  return <Chip size="small" label="Upcoming" variant="outlined" />;
}

export default function PlanView({ items }: { items: Assignment[] }) {
  const [checks, setChecks] = useState<PlanCheckState>(() => loadPlanChecks());

  useEffect(() => {
    savePlanChecks(checks);
  }, [checks]);

  const sessions = useMemo(() => buildSuggestedSessions(items), [items]);

  // Group sessions by day label
  const grouped = useMemo(() => {
    const map = new Map<string, PlanSession[]>();
    for (const s of sessions) {
      const dt = DateTime.fromISO(s.scheduledISO).setZone(TZ);
      const key = dt.startOf("day").toISODate()!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([dateISO, list]) => ({
        dateISO,
        label: formatDayLabel(DateTime.fromISO(dateISO).setZone(TZ)),
        list,
      }));
  }, [sessions]);

  const doneCount = sessions.reduce((acc, s) => acc + (checks[s.id] ? 1 : 0), 0);

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Typography variant="h6">Plan (next 7 days)</Typography>
          <Typography variant="body2" color="text.secondary">
            {sessions.length === 0 ? "No upcoming work sessions." : `${doneCount}/${sessions.length} sessions done`}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          These are suggested work blocks. You can check them off; checkmarks are saved on this device.
        </Typography>

        <Divider />

        {sessions.length === 0 ? (
          <Typography color="text.secondary">Nothing due in the next 7 days.</Typography>
        ) : (
          <Stack spacing={2}>
            {grouped.map((g) => (
              <Box key={g.dateISO}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {g.label}
                </Typography>

                <List dense disablePadding>
                  {g.list.map((s) => {
                    const dt = DateTime.fromISO(s.scheduledISO).setZone(TZ);
                    const time = dt.toFormat("h:mm a");
                    const title = `${s.course ? `[${s.course}] ` : ""}${s.title}`;
                    const checked = !!checks[s.id];

                    return (
                      <ListItem key={s.id} disablePadding sx={{ borderRadius: 2, overflow: "hidden" }}>
                        <ListItemButton
                          onClick={() => setChecks((prev) => ({ ...prev, [s.id]: !checked }))}
                        >
                          <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple />
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {time} · {s.minutes}m
                                </Typography>
                                {dueStatusChip(s.dueISO)}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {title} — due{" "}
                                {DateTime.fromISO(s.dueISO).setZone(TZ).toFormat("ccc, LLL d · h:mm a")}
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
    </Paper>
  );
}
