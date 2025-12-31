import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";

export type StatusFilter = "ALL" | "UPCOMING" | "OVERDUE" | "DUESOON";
export type SortOrder = "DUE_ASC" | "DUE_DESC";

type Props = {
  query: string;
  setQuery: (v: string) => void;

  courseFilter: string;
  setCourseFilter: (v: string) => void;

  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;

  sortOrder: SortOrder;
  setSortOrder: (v: SortOrder) => void;

  courseOptions: string[];
  filtersActive: boolean;
  clearFilters: () => void;
};

export default function AssignmentFilters(props: Props) {
  const {
    query,
    setQuery,
    courseFilter,
    setCourseFilter,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    courseOptions,
    filtersActive,
    clearFilters,
  } = props;

  return (
    <Stack spacing={1.5}>
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

      <Stack spacing={1.5}>
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
    </Stack>
  );
}
