import { DateTime } from "luxon";
import type { Assignment } from "../types";

const TZ = "America/Toronto";

function escapeICS(text: string) {
  return (text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// YYYYMMDDTHHMMSS (no Z) for TZID events
function toTZIDLocal(dtISO: string) {
  const dt = DateTime.fromISO(dtISO).setZone(TZ);
  return dt.toFormat("yyyyLLdd'T'HHmmss");
}

// UTC stamp: YYYYMMDDTHHMMSSZ
function toUTCStamp(dt: Date) {
  const z = DateTime.fromJSDate(dt).toUTC();
  return z.toFormat("yyyyLLdd'T'HHmmss'Z'");
}

export function buildICS(assignments: Assignment[]) {
  const dtstamp = toUTCStamp(new Date());

  const events = assignments
    .slice()
    .sort((a, b) => new Date(a.dueISO).getTime() - new Date(b.dueISO).getTime())
    .map((a) => {
      const start = toTZIDLocal(a.dueISO);
      const summary = escapeICS(`${a.course ? `[${a.course}] ` : ""}${a.title}`);
      const description = escapeICS(a.notes ?? "");

      return [
        "BEGIN:VEVENT",
        `UID:${a.id}@assignment-tracker`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=${TZ}:${start}`,
        `DTEND;TZID=${TZ}:${start}`,
        `SUMMARY:${summary}`,
        description ? `DESCRIPTION:${description}` : "",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Assignment Tracker//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadICS(filename: string, icsContent: string) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
