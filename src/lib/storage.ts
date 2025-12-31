import type { Assignment } from "../types";

const KEY = "assignment_tracker_v1";

export function loadAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Assignment[]) : [];
  } catch {
    return [];
  }
}

export function saveAssignments(items: Assignment[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}
