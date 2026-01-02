import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { DateTime } from "luxon";
import type { ReactNode } from "react";

import type { Assignment } from "../types";

const TZ = "America/Toronto";

type Props = {
  itemsCount: number;
  filtered: Assignment[];
  isMobile: boolean;

  dueChip: (dueISO: string) => ReactNode;

  onEdit: (a: Assignment) => void;
  onDelete: (id: string) => void;

  toGoogleCalendarUrl: (a: Assignment) => string;
};

export default function AssignmentList(props: Props) {
  const { itemsCount, filtered, isMobile, dueChip, onEdit, onDelete, toGoogleCalendarUrl } = props;

  if (itemsCount === 0) {
    return <Typography color="text.secondary">No assignments yet.</Typography>;
  }

  if (filtered.length === 0) {
    return (
      <Typography color="text.secondary">
        No results. Try clearing filters or changing your search.
      </Typography>
    );
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {filtered.map((a) => {
          const dueLocal = DateTime.fromISO(a.dueISO).setZone(TZ);
          const estHrs = ((a.estimateMinutes ?? 60) / 60).toFixed(1).replace(/\.0$/, "");

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

                <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center" flexWrap="wrap">
                    <Chip size="small" label={`Due ${dueLocal.toFormat("LLL d · h:mm a")}`} variant="outlined" />
                    <Chip size="small" label={`${estHrs}h`} variant="outlined" />
                </Stack>

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
                  <IconButton aria-label="edit" onClick={() => onEdit(a)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton aria-label="delete" onClick={() => onDelete(a.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardActions>
            </Card>
          );
        })}
      </Stack>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Course</TableCell>
          <TableCell>Title</TableCell>
          <TableCell>Due (Toronto)</TableCell>
          <TableCell>Notes</TableCell>
          <TableCell align="center">Actions</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {filtered.map((a) => {
          const dueLocal = DateTime.fromISO(a.dueISO).setZone(TZ);
          const estHrs = ((a.estimateMinutes ?? 60) / 60).toFixed(2).replace(/\.0$/, "");
          return (
            <TableRow key={a.id}>
              <TableCell>{a.course || "-"}</TableCell>
              <TableCell sx={{ maxWidth: 380 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flexWrap: "nowrap" }}>
                    <Typography
                    variant="body2"
                    sx={{
                        minWidth: 0,
                        maxWidth: 180,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                    title={a.title}
                    >
                    {a.title}
                    </Typography>

                    {dueChip(a.dueISO)}
                    <Chip size="small" label={`${estHrs}h`} variant="outlined" />
                </Stack>
              </TableCell>

              <TableCell>{dueLocal.toFormat("ccc, LLL d, yyyy · h:mm a")}</TableCell>
              <TableCell
                sx={{
                  maxWidth: 220,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={a.notes || ""}
              >
                {a.notes || "-"}
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                    <Button
                    size="small"
                    endIcon={<OpenInNewIcon />}
                    onClick={() => window.open(toGoogleCalendarUrl(a), "_blank", "noopener,noreferrer")}
                    >
                    Add to Google
                    </Button>

                    <IconButton aria-label="edit" onClick={() => onEdit(a)}>
                    <EditIcon />
                    </IconButton>

                    <IconButton aria-label="delete" onClick={() => onDelete(a.id)}>
                    <DeleteIcon />
                    </IconButton>
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
