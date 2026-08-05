import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import SearchCircularLoader from "@/components/common/SearchCircularLoader";
import DateRangePicker, {
  type DateRange,
} from "@/components/ui/date-range-picker";

type Props = {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  searchLoading: boolean;
  typeOptions: string[];
  filterType: string;
  onFilterTypeChange: (v: string) => void;
  visiblePropertyOptions: string[];
  filterProperty: string;
  onFilterPropertyChange: (v: string) => void;
  deptAll: boolean;
  deptFilter: string[];
  visibleDeptOptions: string[];
  onDeptToggleAll: (on: boolean) => void;
  onDeptToggle: (d: string, checked: boolean) => void;
  sortBy: string;
  onSortChange: (v: string) => void;
  range: DateRange | undefined;
  onRangeChange: (r: DateRange | undefined) => void;
  savedView: string;
  onSavedViewChange: (v: string) => void;
};

export default function AssetFiltersBar({
  searchTerm,
  onSearchChange,
  searchLoading,
  typeOptions,
  filterType,
  onFilterTypeChange,
  visiblePropertyOptions,
  filterProperty,
  onFilterPropertyChange,
  deptAll,
  deptFilter,
  visibleDeptOptions,
  onDeptToggleAll,
  onDeptToggle,
  sortBy,
  onSortChange,
  range,
  onRangeChange,
  savedView,
  onSavedViewChange,
}: Props) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <CardHeader className="space-y-1 border-b border-border/60 bg-muted/30 px-6 py-5">
        <div className="flex items-center gap-2">
          <div>
            <CardTitle className="text-lg font-semibold">
              Asset Inventory
            </CardTitle>
            <CardDescription>
              Search, segment, and sort your asset catalogue
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets by name or ID..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-background"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <SearchCircularLoader size={18} />
              </div>
            )}
          </div>

          <Select value={filterType} onValueChange={onFilterTypeChange}>
            <SelectTrigger className="w-full md:w-48 bg-background">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {typeOptions.filter(Boolean).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProperty} onValueChange={onFilterPropertyChange}>
            <SelectTrigger className="w-full md:w-48 bg-background">
              <SelectValue placeholder="Filter by property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {visiblePropertyOptions.filter(Boolean).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department multi-select filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full md:w-56 justify-between bg-background"
              >
                <span>
                  Departments
                  {deptAll
                    ? " (All)"
                    : deptFilter.length
                      ? ` (${deptFilter.length})`
                      : ""}
                </span>
                <ArrowUpDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
              {/* All toggle */}
              <DropdownMenuCheckboxItem
                checked={deptAll}
                onCheckedChange={(checked) => {
                  onDeptToggleAll(!!checked);
                }}
              >
                All Departments
              </DropdownMenuCheckboxItem>
              {/* Build options, restricting to allowedDepts for non-admins if present */}
              {visibleDeptOptions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  No departments
                </div>
              ) : (
                visibleDeptOptions.map((d) => (
                  <DropdownMenuCheckboxItem
                    key={d}
                    checked={deptAll || deptFilter.includes(d)}
                    onCheckedChange={(checked) => {
                      onDeptToggle(d, !!checked);
                    }}
                  >
                    {d}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="id-asc">ID ↑</SelectItem>
              <SelectItem value="id-desc">ID ↓</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="qty">Quantity</SelectItem>
              <SelectItem value="department">Department</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick toggle for sorting by Asset ID */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onSortChange(sortBy === "id-asc" ? "id-desc" : "id-asc")
            }
            className="shrink-0"
            aria-label="Toggle sort by Asset ID"
            title="Sort by Asset ID"
          >
            <span className="mr-2">Asset ID</span>
            {sortBy === "id-asc" ? (
              <ArrowUp className="h-4 w-4" />
            ) : sortBy === "id-desc" ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <ArrowUpDown className="h-4 w-4" />
            )}
          </Button>

          <DateRangePicker
            className="w-full sm:w-auto min-w-[16rem] shrink-0"
            value={range}
            onChange={onRangeChange}
          />
          {/* Saved Views */}
          <Select value={savedView} onValueChange={onSavedViewChange}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Saved view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assets</SelectItem>
              <SelectItem value="needing-audit">Needing audit</SelectItem>
              <SelectItem value="expiring-30">Expiring in 30 days</SelectItem>
              <SelectItem value="expiring-90">Expiring in 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
