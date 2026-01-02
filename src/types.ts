export type Assignment = {
  id: string;
  course?: string;
  title: string;
  dueISO: string;
  notes?: string;

  estimateMinutes?: number;
};
