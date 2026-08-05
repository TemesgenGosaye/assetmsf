import { Fragment } from "react";
import { Package, ShieldCheck, Users, ChevronRight, ChevronDown } from "lucide-react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { AssetActionsDropdown } from "@/components/assets/AssetActionsDropdown";
import { TablePagination } from "@/components/ui/table-pagination";
import { SearchLoadingSkeleton } from "@/components/ui/page-skeletons";
import StatusChip from "@/components/ui/status-chip";

type AssetGroup = {
  key: string;
  members: any[];
  rep: any;
  totalQty: number;
};

type Props = {
  dense: boolean;
  isVisible: (key: string) => boolean;
  searchLoading: boolean;
  paginatedRows: AssetGroup[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectGroup: (members: any[], checked: boolean) => void;
  onSelectAsset: (id: string, checked: boolean) => void;
  expandedGroups: Set<string>;
  onToggleExpanded: (key: string) => void;
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
  onDeleteGroup: (members: any[]) => void;
  groupedRowsLength: number;
  sortedAssetsLength: number;
  currentPage: number;
  rowsPerPage: number;
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (rows: number) => void;
};

function displayPropertyCode(
  val: string,
  propsById: Props["propsById"],
  propsByName: Props["propsByName"],
) {
  if (propsById[val]) return val;
  const p = propsByName[val];
  return p ? p.id : val;
}

function propertyDisplayName(
  val: string,
  propsById: Props["propsById"],
  propsByName: Props["propsByName"],
) {
  if (propsById[val]) return propsById[val].name || val;
  const p = propsByName[val];
  return p ? p.name : val;
}

function getStatusBadge(status: string) {
  return <StatusChip status={status} />;
}

function ApprovalCell({ approval }: { approval?: { status?: string } }) {
  const st = approval?.status;
  if (st) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs">
                {st === "pending_manager" ? "Mgr" : "Admin"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Pending {st === "pending_manager" ? "Manager" : "Admin"} approval
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return <span className="text-xs text-muted-foreground">-</span>;
}

function TypeCell({ value }: { value?: string }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80">
      <Package className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate whitespace-nowrap">{value}</span>
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">-</span>
  );
}

function DepartmentCell({ value }: { value?: string }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80">
      <Users className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate whitespace-nowrap">{value}</span>
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">-</span>
  );
}

function QtyBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex min-w-[48px] items-center justify-center gap-1 border border-slate-300 bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-700 dark:border-border dark:bg-muted dark:text-slate-200">
      <Package className="h-3 w-3 text-slate-500 dark:text-slate-300" />
      {value}
    </span>
  );
}

const DEP_METHOD_LABELS: Record<string, string> = {
  straight_line: "Straight Line",
  reducing_balance: "Reducing Balance",
  no_depreciation: "No Depreciation",
};

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

function depMethodLabel(v?: string) {
  if (!v) return "-";
  return DEP_METHOD_LABELS[v] || v.replace(/_/g, " ");
}

export default function AssetTable({
  dense,
  isVisible,
  searchLoading,
  paginatedRows,
  selectedIds,
  onSelectAll,
  onSelectGroup,
  onSelectAsset,
  expandedGroups,
  onToggleExpanded,
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
  onDeleteGroup,
  groupedRowsLength,
  sortedAssetsLength,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: Props) {
  const propCode = (val: string) =>
    displayPropertyCode(val, propsById, propsByName);
  const propName = (val: string) =>
    propertyDisplayName(val, propsById, propsByName);

  return (
    <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <CardHeader className="flex flex-col gap-1 border-b border-border/60 bg-muted/30 px-6 py-5">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div>
              <CardTitle className="text-lg font-semibold">
                Asset Catalogue
              </CardTitle>
              <CardDescription>
                All assets that match the filters and scope above
              </CardDescription>
            </div>
          </div>
          <div className="bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 border border-slate-300 md:text-right dark:bg-muted dark:border-border dark:text-slate-300">
            Showing {groupedRowsLength.toLocaleString()} group
            {groupedRowsLength === 1 ? "" : "s"} •{" "}
            {sortedAssetsLength.toLocaleString()} item
            {sortedAssetsLength === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table
            dense={dense}
            stickyHeader
            stickyFirstCol
            className="text-sm"
          >
            <TableHeader className="bg-transparent">
              <TableRow className="border-b border-border/60 shadow-[inset_0_-1px_0_theme(colors.border/0.45)] hover:bg-transparent">
                {isVisible("select") && (
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      aria-label="Select all"
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size === sortedAssetsLength
                      }
                      onCheckedChange={(checked) => onSelectAll(!!checked)}
                    />
                  </TableHead>
                )}
                {isVisible("group") && (
                  <TableHead className="w-[110px] whitespace-nowrap text-center">
                    Group
                  </TableHead>
                )}
                {isVisible("id") && (
                  <TableHead className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange(sortBy === "id-asc" ? "id-desc" : "id-asc")
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
                {isVisible("type") && <TableHead>Type</TableHead>}
                {isVisible("property") && <TableHead>Property</TableHead>}
                {isVisible("department") && <TableHead>Department</TableHead>}
                {isVisible("qty") && (
                  <TableHead className="text-center">Quantity</TableHead>
                )}
                {isVisible("location") && <TableHead>Location</TableHead>}
                {isVisible("purchaseDate") && (
                  <TableHead>Purchase Date</TableHead>
                )}
                {isVisible("purchaseCost") && (
                  <TableHead className="text-right">Cost</TableHead>
                )}
                {isVisible("currentValue") && (
                  <TableHead className="text-right">Current Value</TableHead>
                )}
                {isVisible("depreciationMethod") && (
                  <TableHead>Dep. Method</TableHead>
                )}
                {isVisible("vendor") && <TableHead>Vendor</TableHead>}
                {isVisible("invoiceNumber") && <TableHead>Invoice No</TableHead>}
                {isVisible("warrantyExpiry") && (
                  <TableHead>Warranty Ends</TableHead>
                )}
                {isVisible("status") && <TableHead>Status</TableHead>}
                {isVisible("approval") && <TableHead>Approval</TableHead>}
                {isVisible("createdBy") && <TableHead>Created By</TableHead>}
                {isVisible("serial") && <TableHead>Serial</TableHead>}
                {isVisible("description") && (
                  <TableHead>Description</TableHead>
                )}
                {isVisible("actions") && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="p-0">
                    <div className="p-4">
                      <SearchLoadingSkeleton rows={5} columns={6} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((group) => {
                  const { rep, members, totalQty, key } = group;
                  const allSelected = members.every((m) =>
                    selectedIds.has(m.id),
                  );
                  const isExpanded = expandedGroups.has(key);
                  return (
                    <Fragment key={key}>
                      <TableRow
                        key={key}
                        className="cursor-pointer select-none border-b border-slate-300 bg-white shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)] transition-colors hover:bg-slate-50 data-[selected=true]:bg-blue-100/80 dark:border-border dark:bg-card dark:shadow-[inset_0_-1px_0_rgba(51,65,85,0.55)] dark:hover:bg-slate-900 dark:data-[selected=true]:bg-slate-800"
                        data-selected={allSelected ? "true" : undefined}
                        onDoubleClick={() => onOpenAsset(rep.id)}
                      >
                        {isVisible("select") && (
                          <TableCell className="w-10">
                            <Checkbox
                              aria-label={`Select group ${key}`}
                              checked={allSelected}
                              onCheckedChange={(checked) =>
                                onSelectGroup(members, !!checked)
                              }
                            />
                          </TableCell>
                        )}
                        {isVisible("group") && (
                          <TableCell className="text-center">
                            {members.length > 1 ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onToggleExpanded(key)}
                                  aria-label={
                                    isExpanded
                                      ? "Collapse group"
                                      : "Expand group"
                                  }
                                  aria-expanded={isExpanded}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:border-border dark:bg-muted dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                                <span className="inline-flex items-center rounded-sm border border-slate-300 bg-slate-100 px-1.5 py-0 text-[10px] font-medium text-slate-600 dark:border-border dark:bg-muted dark:text-slate-300">
                                  {isExpanded
                                    ? "Group"
                                    : `+${members.length - 1}`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Single
                              </span>
                            )}
                          </TableCell>
                        )}
                        {isVisible("id") && (
                          <TableCell className="font-medium">
                            <span className="font-mono text-[12px] font-semibold tracking-normal text-foreground">
                              {members[0]?.id}
                            </span>
                          </TableCell>
                        )}
                        {isVisible("name") && (
                          <TableCell>
                            <span className="font-semibold text-foreground leading-5">
                              {rep.name || rep.id}
                            </span>
                          </TableCell>
                        )}
                        {isVisible("type") && (
                          <TableCell>
                            <TypeCell value={rep.type} />
                          </TableCell>
                        )}
                        {isVisible("property") && (
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-sm">
                              <span className="font-medium text-foreground/90">
                                {propName(String(rep.property))}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {propCode(String(rep.property))}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {isVisible("department") && (
                          <TableCell>
                            <DepartmentCell value={rep.department} />
                          </TableCell>
                        )}
                        {isVisible("qty") && (
                          <TableCell className="text-center">
                            {!isExpanded ? (
                              <QtyBadge value={totalQty} />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {members.length} item
                                {members.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </TableCell>
                        )}
                        {isVisible("location") && (
                          <TableCell>{rep.location || "-"}</TableCell>
                        )}
                        {isVisible("purchaseDate") && (
                          <TableCell>{rep.purchaseDate}</TableCell>
                        )}
                        {isVisible("purchaseCost") && (
                          <TableCell className="text-right">
                            {formatMoney(rep.purchaseCost)}
                          </TableCell>
                        )}
                        {isVisible("currentValue") && (
                          <TableCell className="text-right">
                            {formatMoney(rep.currentValue)}
                          </TableCell>
                        )}
                        {isVisible("depreciationMethod") && (
                          <TableCell>{depMethodLabel(rep.depreciationMethod)}</TableCell>
                        )}
                        {isVisible("vendor") && (
                          <TableCell>{rep.vendor || "-"}</TableCell>
                        )}
                        {isVisible("invoiceNumber") && (
                          <TableCell>{rep.invoiceNumber || "-"}</TableCell>
                        )}
                        {isVisible("warrantyExpiry") && (
                          <TableCell>{rep.warrantyExpiry || "-"}</TableCell>
                        )}
                        {isVisible("status") && (
                          <TableCell>{getStatusBadge(rep.status)}</TableCell>
                        )}
                        {isVisible("approval") && (
                          <TableCell>
                            {/* Show approval indicator if ANY member has a pending approval */}
                            {(() => {
                              const pending = members.find(
                                (m) => approvalsByAsset[m.id],
                              );
                              return pending ? (
                                <ApprovalCell
                                  approval={approvalsByAsset[pending.id]}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              );
                            })()}
                          </TableCell>
                        )}
                        {isVisible("createdBy") && (
                          <TableCell>
                            {rep.createdByName ||
                              rep.createdByEmail ||
                              rep.createdById ||
                              "-"}
                          </TableCell>
                        )}
                        {isVisible("serial") && (
                          <TableCell>{rep.serialNumber || "-"}</TableCell>
                        )}
                        {isVisible("description") && (
                          <TableCell>{rep.description || "-"}</TableCell>
                        )}
                        {isVisible("actions") && (
                          <TableCell className="text-right">
                            <AssetActionsDropdown
                              onEdit={() => onEdit(rep)}
                              onQRCode={() => onQR(rep)}
                              onTransfer={() =>
                                onTransfer(
                                  members.length === 1 ? members[0] : rep,
                                )
                              }
                              onPrint={() => onPrint(rep)}
                              onRequestEdit={() =>
                                onRequestEdit(
                                  members.length === 1 ? members[0] : rep,
                                )
                              }
                              onDelete={() => {
                                if (members.length > 1) {
                                  onDeleteGroup(members);
                                } else {
                                  onDelete(rep.id);
                                }
                              }}
                              canEdit={
                                (members.length === 1 || isExpanded) &&
                                (role === "admin" ||
                                  approverPropIds.has(
                                    String(
                                      rep.property_id || rep.property || "",
                                    ),
                                  ))
                              }
                              showRequestEdit={
                                (members.length === 1 || isExpanded) &&
                                role !== "admin" &&
                                !approverPropIds.has(
                                  String(rep.property_id || rep.property || ""),
                                )
                              }
                              canDelete={role === "admin"}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                      {isExpanded && members.length > 0 && (
                        <>
                          {members
                            .slice(1) // exclude representative (already shown in group row)
                            .sort((a: any, b: any) => {
                              const parse = (
                                id: string,
                              ): { prefix: string; num: number } | null => {
                                const m = String(id).match(/^(.*?)(\d+)$/);
                                if (!m) return null;
                                return {
                                  prefix: m[1],
                                  num: Number(m[2]),
                                };
                              };
                              const pa = parse(String(a.id));
                              const pb = parse(String(b.id));
                              if (pa && pb) {
                                const prefCmp = pa.prefix.localeCompare(
                                  pb.prefix,
                                );
                                if (prefCmp !== 0) return prefCmp;
                                return pa.num - pb.num;
                              }
                              return String(a.id).localeCompare(String(b.id));
                            })
                            .reverse() // show newest / highest id first
                            .map((asset) => (
                              <TableRow
                                key={`${key}::${asset.id}`}
                                className="border-b border-slate-200 bg-white transition-colors hover:bg-slate-50 data-[selected=true]:bg-blue-100/70 dark:border-border dark:bg-card dark:hover:bg-slate-900 dark:data-[selected=true]:bg-slate-800"
                                data-selected={
                                  selectedIds.has(asset.id)
                                    ? "true"
                                    : undefined
                                }
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
                                {isVisible("group") && (
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center rounded-sm border border-slate-300 bg-slate-100 px-1.5 py-0 text-[10px] font-medium text-slate-600 dark:border-border dark:bg-muted dark:text-slate-300">
                                      Child
                                    </span>
                                  </TableCell>
                                )}
                                {isVisible("id") && (
                                  <TableCell className="font-medium">
                                    <div className="flex items-start gap-2">
                                      <span className="mt-[3px] h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                                      <span className="font-mono text-[12px] font-medium tracking-normal text-slate-700 dark:text-slate-200">
                                        {asset.id}
                                      </span>
                                    </div>
                                  </TableCell>
                                )}
                                {isVisible("name") && (
                                  <TableCell>
                                    <span className="font-semibold text-foreground leading-5">
                                      {asset.name || asset.id}
                                    </span>
                                  </TableCell>
                                )}
                                {isVisible("type") && (
                                  <TableCell>
                                    <TypeCell value={asset.type} />
                                  </TableCell>
                                )}
                                {isVisible("property") && (
                                  <TableCell>
                                    <div className="flex flex-col gap-0.5 text-sm">
                                      <span className="font-medium text-foreground/90">
                                        {propName(String(asset.property))}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {propCode(String(asset.property))}
                                      </span>
                                    </div>
                                  </TableCell>
                                )}
                                {isVisible("department") && (
                                  <TableCell>
                                    <DepartmentCell value={asset.department} />
                                  </TableCell>
                                )}
                                {isVisible("qty") && (
                                  <TableCell className="text-center">
                                    <QtyBadge value={asset.quantity} />
                                  </TableCell>
                                )}
                                {isVisible("location") && (
                                  <TableCell>{asset.location || "-"}</TableCell>
                                )}
                                {isVisible("purchaseDate") && (
                                  <TableCell>{asset.purchaseDate}</TableCell>
                                )}
                                {isVisible("purchaseCost") && (
                                  <TableCell className="text-right">
                                    {formatMoney(asset.purchaseCost)}
                                  </TableCell>
                                )}
                                {isVisible("currentValue") && (
                                  <TableCell className="text-right">
                                    {formatMoney(asset.currentValue)}
                                  </TableCell>
                                )}
                                {isVisible("depreciationMethod") && (
                                  <TableCell>
                                    {depMethodLabel(asset.depreciationMethod)}
                                  </TableCell>
                                )}
                                {isVisible("vendor") && (
                                  <TableCell>{asset.vendor || "-"}</TableCell>
                                )}
                                {isVisible("invoiceNumber") && (
                                  <TableCell>
                                    {asset.invoiceNumber || "-"}
                                  </TableCell>
                                )}
                                {isVisible("warrantyExpiry") && (
                                  <TableCell>
                                    {asset.warrantyExpiry || "-"}
                                  </TableCell>
                                )}
                                {isVisible("status") && (
                                  <TableCell>
                                    {getStatusBadge(asset.status)}
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
                                  <TableCell>
                                    {asset.createdByName ||
                                      asset.createdByEmail ||
                                      asset.createdById ||
                                      "-"}
                                  </TableCell>
                                )}
                                {isVisible("serial") && (
                                  <TableCell>
                                    {asset.serialNumber || "-"}
                                  </TableCell>
                                )}
                                {isVisible("description") && (
                                  <TableCell>
                                    {asset.description || "-"}
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
                                      canEdit={
                                        role === "admin" ||
                                        approverPropIds.has(
                                          String(
                                            asset.property_id ||
                                              asset.property ||
                                              "",
                                          ),
                                        )
                                      }
                                      showRequestEdit={
                                        role !== "admin" &&
                                        !approverPropIds.has(
                                          String(
                                            asset.property_id ||
                                              asset.property ||
                                              "",
                                          ),
                                        )
                                      }
                                      canDelete={role === "admin"}
                                    />
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                        </>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={currentPage}
            totalItems={groupedRowsLength}
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
