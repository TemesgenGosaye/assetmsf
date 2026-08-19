import { useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AssetActionsDropdown } from "@/components/assets/AssetActionsDropdown";
import { TablePagination } from "@/components/ui/table-pagination";
import { SearchLoadingSkeleton } from "@/components/ui/page-skeletons";
import StatusChip from "@/components/ui/status-chip";

type Props = {
  dense: boolean;
  isVisible: (key: string) => boolean;
  searchLoading: boolean;
  rows: any[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectAsset: (id: string, checked: boolean) => void;
  approvalsByAsset: Record<string, { status?: string } | undefined>;
  role: string;
  approverPropIds: Set<string>;
  propsById: Record<string, { id?: string; name?: string }>;
  propsByName: Record<string, { id?: string; name?: string }>;
  sortBy: string;
  onSortChange: (v: string) => void;
  onOpenAsset: (id: string) => void;
  onEdit: (asset: any) => void;
  onQR: (asset: any) => void;
  onTransfer: (asset: any) => void;
  onPrint: (asset: any) => void;
  onRequestEdit: (asset: any) => void;
  onDelete: (assetId: string) => void;
  error?: string | null;
  onRetry?: () => void;
  totalItems: number;
  currentPage: number;
  rowsPerPage: number;
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (rows: number) => void;
};

function propertyDisplayName(
  val: string,
  propsById: Props["propsById"],
  propsByName: Props["propsByName"],
) {
  if (propsById[val]) return propsById[val].name || val;
  const p = propsByName[val];
  return p ? p.name : val;
}

function propertyCode(
  val: string,
  propsById: Props["propsById"],
  propsByName: Props["propsByName"],
) {
  if (propsById[val]) return val;
  const p = propsByName[val];
  return p ? p.id : val;
}

const DEP_METHOD_LABELS: Record<string, string> = {
  straight_line: "Straight Line",
  reducing_balance: "Reducing Balance",
  no_depreciation: "No Depreciation",
};

function depMethodLabel(v?: string) {
  if (!v) return "-";
  return DEP_METHOD_LABELS[v] || v.replace(/_/g, " ");
}

function formatMoney(v: any) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNumber(v: any, suffix = "") {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `${n.toLocaleString(undefined)}${suffix}`;
}

function formatDateShort(v?: string | null) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function timeAgo(v?: string | null) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "-";
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 0) return "future";
    if (diff < 60) return `${diff}s`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d`;
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);
    if (years > 0) {
      const remMonths = months % 12;
      return remMonths > 0 ? `${years}y ${remMonths}m` : `${years}y`;
    }
    return `${months}m`;
  } catch {
    return "-";
  }
}

function conditionLabel(v?: string) {
  if (!v) return "-";
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ");
}

function conditionTone(v?: string): string {
  if (!v)
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  switch (v.toLowerCase()) {
    case "excellent":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "good":
      return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
    case "fair":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "poor":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    case "damaged":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
}

function ConditionChip({ value }: { value?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${conditionTone(value)}`}
    >
      {conditionLabel(value)}
    </span>
  );
}

function BoolChip({ value }: { value?: boolean | null }) {
  return value ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      No
    </span>
  );
}

function ApprovalCell({ approval }: { approval?: { status?: string } }) {
  const st = approval?.status;
  if (!st) return <span className="text-xs text-muted-foreground">-</span>;
  const pending =
    st === "pending_manager" || st === "pending_admin";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        pending
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {st === "pending_manager"
        ? "Pending Mgr"
        : st === "pending_admin"
          ? "Pending Admin"
          : st.replace(/_/g, " ")}
    </span>
  );
}

function MonoTag({ value, max = 18 }: { value?: string; max?: number }) {
  if (!value)
    return <span className="text-xs text-muted-foreground">-</span>;
  const s = String(value);
  const trimmed = s.length > max ? s.slice(0, max) + "…" : s;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] tracking-tight text-foreground/80">
            {trimmed}
          </span>
        </TooltipTrigger>
        {s.length > max && (
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-[360px] break-all font-mono text-[11px]"
          >
            {s}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function TextCell({
  value,
  max,
  className,
}: {
  value?: string;
  max?: number;
  className?: string;
}) {
  if (!value)
    return <span className="text-xs text-muted-foreground">-</span>;
  const s = String(value);
  if (max && s.length > max) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`truncate ${className || ""}`}>
              {s.slice(0, max)}…
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-[360px] whitespace-pre-wrap"
          >
            {s}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return <span className={className}>{s}</span>;
}

export default function AssetTable({
  dense,
  isVisible,
  searchLoading,
  rows,
  selectedIds,
  onSelectAll,
  onSelectAsset,
  approvalsByAsset,
  role,
  approverPropIds,
  propsById,
  propsByName,
  sortBy,
  onSortChange,
  onOpenAsset,
  onEdit,
  onQR,
  onTransfer,
  onPrint,
  onRequestEdit,
  onDelete,
  error,
  onRetry,
  totalItems,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: Props) {
  const colCount = useMemo(() => {
    const keys = [
      "select",
      "id",
      "name",
      "type",
      "category",
      "manufacturer",
      "model",
      "serial",
      "barcode",
      "property",
      "department",
      "location",
      "owner",
      "qty",
      "purchaseDate",
      "expiryDate",
      "purchaseCost",
      "currentValue",
      "salvageValue",
      "depreciationMethod",
      "usefulLifeYears",
      "depreciationRate",
      "accumulatedDepreciation",
      "annualDepreciation",
      "poNumber",
      "vendor",
      "invoiceNumber",
      "warrantyStartDate",
      "warrantyExpiry",
      "warrantyProvider",
      "warrantyNotes",
      "amcEnabled",
      "amcProvider",
      "amcStartDate",
      "amcEndDate",
      "amcCost",
      "condition",
      "status",
      "approval",
      "createdBy",
      "notes",
      "description",
      "addedDate",
      "updatedDate",
      "onAsset",
      "actions",
    ];
    return keys.filter((k) => isVisible(k)).length + 1;
  }, [isVisible]);

  const propName = (val: string) =>
    propertyDisplayName(val, propsById, propsByName);
  const propCode = (val: string) => propertyCode(val, propsById, propsByName);

  return (
    <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-1 border-b border-border/60 bg-muted/30 px-6 py-5">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Asset Records
            </CardTitle>
            <CardDescription>
              Every asset that matches the filters and scope above, one row per
              record
            </CardDescription>
          </div>
          <div className="border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 md:text-right dark:border-border dark:bg-muted dark:text-slate-300">
            {totalItems.toLocaleString()} record
            {totalItems === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {error && (
          <div className="mx-6 mt-4 flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <Table
            dense={dense}
            stickyHeader
            stickyFirstCol
            className="text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
          >
            <TableHeader className="bg-transparent">
              <TableRow className="border-b border-border/60 shadow-[inset_0_-1px_0_theme(colors.border/0.45)] hover:bg-transparent">
                {isVisible("select") && (
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      aria-label="Select all"
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size === totalItems
                      }
                      onCheckedChange={(checked) => onSelectAll(!!checked)}
                    />
                  </TableHead>
                )}
                {isVisible("id") && (
                  <TableHead className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange(
                          sortBy === "id-asc" ? "id-desc" : "id-asc",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-sm border border-transparent px-1 py-0 text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      aria-label="Sort by Asset ID"
                      title="Sort by Asset ID"
                    >
                      Asset ID
                      {sortBy === "id-asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : sortBy === "id-desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </TableHead>
                )}
                 {isVisible("name") && <TableHead>Name</TableHead>}
                 {isVisible("type") && <TableHead>Item Type</TableHead>}
                 {isVisible("category") && <TableHead>Category</TableHead>}
                 {isVisible("manufacturer") && (
                   <TableHead>Manufacturer</TableHead>
                 )}
                 {isVisible("model") && <TableHead>Model</TableHead>}
                 {isVisible("serial") && <TableHead>Serial No.</TableHead>}
                 {isVisible("barcode") && <TableHead>Barcode</TableHead>}
                 {isVisible("property") && <TableHead>Property</TableHead>}
                {isVisible("department") && (
                  <TableHead>Department</TableHead>
                )}
                {isVisible("location") && <TableHead>Location</TableHead>}
                {isVisible("owner") && <TableHead>Owner</TableHead>}
                {isVisible("qty") && (
                  <TableHead className="text-center">Qty</TableHead>
                )}
                {isVisible("purchaseDate") && (
                  <TableHead>Purchase Date</TableHead>
                )}
                {isVisible("expiryDate") && <TableHead>Expiry Date</TableHead>}
                {isVisible("purchaseCost") && (
                  <TableHead className="text-right">Purchase Cost</TableHead>
                )}
                {isVisible("currentValue") && (
                  <TableHead className="text-right">Current Value</TableHead>
                )}
                {isVisible("salvageValue") && (
                  <TableHead className="text-right">Salvage Value</TableHead>
                )}
                {isVisible("depreciationMethod") && (
                  <TableHead>Dep. Method</TableHead>
                )}
                {isVisible("usefulLifeYears") && (
                  <TableHead>Useful Life (Y)</TableHead>
                )}
                {isVisible("depreciationRate") && (
                  <TableHead className="text-right">Dep. Rate (%)</TableHead>
                )}
                {isVisible("accumulatedDepreciation") && (
                  <TableHead className="text-right">
                    Accumulated Dep.
                  </TableHead>
                )}
                {isVisible("annualDepreciation") && (
                  <TableHead className="text-right">Annual Dep.</TableHead>
                )}
                {isVisible("poNumber") && <TableHead>PO Number</TableHead>}
                {isVisible("vendor") && <TableHead>Vendor</TableHead>}
                {isVisible("invoiceNumber") && (
                  <TableHead>Invoice No.</TableHead>
                )}
                {isVisible("warrantyStartDate") && (
                  <TableHead>Warranty Start</TableHead>
                )}
                {isVisible("warrantyExpiry") && (
                  <TableHead>Warranty Expiry</TableHead>
                )}
                {isVisible("warrantyProvider") && (
                  <TableHead>Warranty Provider</TableHead>
                )}
                {isVisible("warrantyNotes") && (
                  <TableHead>Warranty Notes</TableHead>
                )}
                {isVisible("amcEnabled") && <TableHead>AMC</TableHead>}
                {isVisible("amcProvider") && (
                  <TableHead>AMC Provider</TableHead>
                )}
                {isVisible("amcStartDate") && (
                  <TableHead>AMC Start</TableHead>
                )}
                {isVisible("amcEndDate") && <TableHead>AMC End</TableHead>}
                {isVisible("amcCost") && (
                  <TableHead className="text-right">AMC Cost</TableHead>
                )}
                 {isVisible("condition") && <TableHead>Condition</TableHead>}
                 {isVisible("status") && <TableHead>Condition</TableHead>}
                {isVisible("approval") && <TableHead>Approval</TableHead>}
                {isVisible("createdBy") && <TableHead>Created By</TableHead>}
                {isVisible("notes") && <TableHead>Notes</TableHead>}
                {isVisible("description") && (
                  <TableHead>Description</TableHead>
                )}
                {isVisible("addedDate") && <TableHead>Created At</TableHead>}
                {isVisible("updatedDate") && (
                  <TableHead>Updated At</TableHead>
                )}
                {isVisible("onAsset") && <TableHead>Age</TableHead>}
                {isVisible("actions") && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchLoading ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="p-0">
                    <div className="p-4">
                      <SearchLoadingSkeleton rows={5} columns={6} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="h-[280px] text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/70">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          No assets found
                        </p>
                        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                          No asset records match the current filters. Adjust
                          the search, clear the filters, or add a new asset to
                          populate the catalogue.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((asset) => {
                  const pid = String(
                    asset.property_id || asset.property || "",
                  );
                  const canEdit =
                    role === "admin" || approverPropIds.has(pid);
                  return (
                    <TableRow
                      key={asset.id}
                      className="cursor-pointer select-none border-b border-slate-300 bg-white shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)] transition-colors hover:bg-slate-50 data-[selected=true]:bg-blue-100/80 dark:border-border dark:bg-card dark:shadow-[inset_0_-1px_0_rgba(51,65,85,0.55)] dark:hover:bg-slate-900 dark:data-[selected=true]:bg-slate-800"
                      data-selected={
                        selectedIds.has(asset.id) ? "true" : undefined
                      }
                      onDoubleClick={() => onOpenAsset(asset.id)}
                    >
                      {isVisible("select") && (
                        <TableCell className="w-10">
                          <Checkbox
                            aria-label={`Select ${asset.id}`}
                            checked={selectedIds.has(asset.id)}
                            onCheckedChange={(checked) =>
                              onSelectAsset(asset.id, !!checked)
                            }
                          />
                        </TableCell>
                      )}
                      {isVisible("id") && (
                        <TableCell className="font-medium">
                          <MonoTag value={asset.id} />
                        </TableCell>
                      )}
                      {isVisible("name") && (
                        <TableCell>
                          <span className="max-w-[220px] truncate font-semibold leading-5 text-foreground">
                            {asset.description || asset.name || asset.id}
                          </span>
                        </TableCell>
                      )}
                      {isVisible("type") && (
                        <TableCell className="truncate max-w-[160px] text-xs font-medium text-foreground/80">
                          {asset.type || "-"}
                        </TableCell>
                      )}
                       {isVisible("category") && (
                         <TableCell className="truncate max-w-[140px] text-xs">
                           {asset.category_name || "-"}
                         </TableCell>
                       )}
                       {isVisible("manufacturer") && (
                         <TableCell className="truncate max-w-[140px] text-xs">
                           {asset.manufacturer || "-"}
                         </TableCell>
                       )}
                       {isVisible("model") && (
                         <TableCell className="truncate max-w-[120px] text-xs">
                           {asset.model || "-"}
                         </TableCell>
                       )}
                       {isVisible("serial") && (
                         <TableCell className="truncate max-w-[140px] text-xs">
                           <MonoTag value={asset.serialNumber} />
                         </TableCell>
                       )}
                       {isVisible("barcode") && (
                         <TableCell className="truncate max-w-[140px] text-xs">
                           <MonoTag value={asset.barcode} />
                         </TableCell>
                       )}
                       {isVisible("property") && (
                        <TableCell>
                          <div className="flex max-w-[200px] flex-col gap-0.5 text-sm">
                            <span className="truncate font-medium text-foreground/90">
                              {propName(String(asset.property))}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground">
                              {propCode(String(asset.property))}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      {isVisible("department") && (
                        <TableCell className="truncate max-w-[180px] text-xs font-medium text-foreground/80">
                          {asset.department || "-"}
                        </TableCell>
                      )}
                      {isVisible("location") && (
                        <TableCell className="truncate max-w-[160px] text-xs">
                          {asset.location || "-"}
                        </TableCell>
                      )}
                      {isVisible("owner") && (
                        <TableCell className="truncate max-w-[140px] text-xs">
                          {asset.owner_name || asset.owner || "-"}
                        </TableCell>
                      )}
                      {isVisible("qty") && (
                        <TableCell className="text-center text-xs font-semibold">
                          —
                        </TableCell>
                      )}
                      {isVisible("purchaseDate") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.purchaseDate)}
                        </TableCell>
                      )}
                      {isVisible("expiryDate") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.expiryDate)}
                        </TableCell>
                      )}
                      {isVisible("purchaseCost") && (
                        <TableCell className="text-right text-xs">
                          {formatMoney(asset.purchaseCost)}
                        </TableCell>
                      )}
                      {isVisible("currentValue") && (
                        <TableCell className="text-right text-xs">
                          {formatMoney(asset.currentValue)}
                        </TableCell>
                      )}
                      {isVisible("salvageValue") && (
                        <TableCell className="text-right text-xs">
                          {formatMoney(asset.salvageValue)}
                        </TableCell>
                      )}
                      {isVisible("depreciationMethod") && (
                        <TableCell className="truncate max-w-[140px] text-xs">
                          {depMethodLabel(asset.depreciationMethod)}
                        </TableCell>
                      )}
                      {isVisible("usefulLifeYears") && (
                        <TableCell className="text-xs">
                          {formatNumber(asset.usefulLifeYears, " yrs")}
                        </TableCell>
                      )}
                      {isVisible("depreciationRate") && (
                        <TableCell className="text-right text-xs">
                          {formatNumber(asset.depreciationRate, "%")}
                        </TableCell>
                      )}
                      {isVisible("accumulatedDepreciation") && (
                        <TableCell className="text-right text-xs">
                          {formatMoney(asset.accumulatedDepreciation)}
                        </TableCell>
                      )}
                      {isVisible("annualDepreciation") && (
                        <TableCell className="text-right text-xs">
                          {formatMoney(asset.annual_depreciation_value)}
                        </TableCell>
                      )}
                      {isVisible("poNumber") && (
                        <TableCell className="truncate max-w-[130px] text-xs">
                          {asset.poNumber || "-"}
                        </TableCell>
                      )}
                      {isVisible("vendor") && (
                        <TableCell className="truncate max-w-[150px] text-xs">
                          {asset.vendor || "-"}
                        </TableCell>
                      )}
                      {isVisible("invoiceNumber") && (
                        <TableCell className="truncate max-w-[130px] text-xs">
                          {asset.invoiceNumber || "-"}
                        </TableCell>
                      )}
                      {isVisible("warrantyStartDate") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.warrantyStartDate)}
                        </TableCell>
                      )}
                      {isVisible("warrantyExpiry") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.warrantyExpiry)}
                        </TableCell>
                      )}
                      {isVisible("warrantyProvider") && (
                        <TableCell className="truncate max-w-[150px] text-xs">
                          {asset.warrantyProvider || "-"}
                        </TableCell>
                      )}
                      {isVisible("warrantyNotes") && (
                        <TableCell className="max-w-[200px] text-xs">
                          <TextCell value={asset.warrantyNotes} max={28} />
                        </TableCell>
                      )}
                      {isVisible("amcEnabled") && (
                        <TableCell>
                          <BoolChip value={Boolean(asset.amcEnabled)} />
                        </TableCell>
                      )}
                      {isVisible("amcProvider") && (
                        <TableCell className="truncate max-w-[150px] text-xs">
                          {asset.amcProvider || "-"}
                        </TableCell>
                      )}
                      {isVisible("amcStartDate") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.amcStartDate)}
                        </TableCell>
                      )}
                      {isVisible("amcEndDate") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.amcEndDate)}
                        </TableCell>
                      )}
                      {isVisible("amcCost") && (
                        <TableCell className="text-right text-xs">
                          {formatMoney(asset.amcCost)}
                        </TableCell>
                      )}
                       {isVisible("condition") && (
                         <TableCell>
                           <ConditionChip value={asset.condition} />
                         </TableCell>
                       )}
                       {isVisible("status") && (
                         <TableCell>
                           <ConditionChip value={asset.condition} />
                         </TableCell>
                       )}
                      {isVisible("approval") && (
                        <TableCell>
                          <ApprovalCell
                            approval={approvalsByAsset[asset.id]}
                          />
                        </TableCell>
                      )}
                      {isVisible("createdBy") && (
                        <TableCell className="truncate max-w-[160px] text-xs">
                          {asset.createdByName ||
                            asset.createdByEmail ||
                            asset.createdById ||
                            "-"}
                        </TableCell>
                      )}
                      {isVisible("notes") && (
                        <TableCell className="max-w-[200px] text-xs">
                          <TextCell value={asset.notes} max={28} />
                        </TableCell>
                      )}
                      {isVisible("description") && (
                        <TableCell className="max-w-[220px] text-xs">
                          <TextCell value={asset.description} max={28} />
                        </TableCell>
                      )}
                      {isVisible("addedDate") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.created_at)}
                        </TableCell>
                      )}
                      {isVisible("updatedDate") && (
                        <TableCell className="text-xs">
                          {formatDateShort(asset.updated_at)}
                        </TableCell>
                      )}
                      {isVisible("onAsset") && (
                        <TableCell className="text-xs font-medium text-muted-foreground">
                          {timeAgo(asset.created_at)}
                        </TableCell>
                      )}
                      {isVisible("actions") && (
                        <TableCell className="text-right">
                          <AssetActionsDropdown
                            onEdit={() => onEdit(asset)}
                            onQRCode={() => onQR(asset)}
                            onTransfer={() => onTransfer(asset)}
                            onPrint={() => onPrint(asset)}
                            onRequestEdit={() => onRequestEdit(asset)}
                            onDelete={() => onDelete(asset.id)}
                            canEdit={canEdit}
                            showRequestEdit={
                              role !== "admin" && !canEdit
                            }
                            canDelete={role === "admin"}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={currentPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={onPageChange}
            onRowsPerPageChange={(rows) => {
              onRowsPerPageChange(rows);
              onPageChange(1);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
