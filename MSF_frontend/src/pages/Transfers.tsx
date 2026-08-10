import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isDemoMode } from "@/lib/demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowRightLeft, CheckCircle, Clock, MoreVertical, Search, XCircle, RotateCcw, Eye, Filter } from "lucide-react";
import {
  listTransfers,
  approveTransfer,
  rejectTransfer,
  completeTransfer,
  cancelTransfer,
  type AssetTransfer,
} from "@/services/transfers";
import { getCachedValue } from "@/lib/data-cache";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/ui/table-pagination";

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useTablePreferences } from "@/components/table/useTablePreferences";
import { type ColumnDef } from "@/components/table/ColumnChooser";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUserId, canUserEdit } from "@/services/permissions";
import { logActivity } from "@/services/activity";
import { trackActivity } from "@/services/notifications";

export default function Transfers() {
  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "approve" | "reject" | "complete" | "cancel";
    transfer: AssetTransfer | null;
  }>({ open: false, type: "approve", transfer: null });
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<string>("");
  const navigate = useNavigate();

  const TRANSFER_CACHE_KEY = "assets:transfers";

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "completed", label: "Completed" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">Completed</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Approved</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const fetchTransfers = useCallback(async (force = false) => {
    if (isDemoMode()) {
      setTransfers([]);
      setLoading(false);
      return;
    }
    try {
      const data = await getCachedValue(
        TRANSFER_CACHE_KEY,
        async () => {
          const list = await listTransfers({ force: true });
          return list;
        },
        { ttlMs: 60_000 }
      );
      setTransfers(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  useEffect(() => {
    try {
      const raw = (isDemoMode()
        ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
        : null) || localStorage.getItem("auth_user");
      const r = raw ? JSON.parse(raw).role || "" : "";
      setRole((r || "").toLowerCase());
    } catch {}
  }, []);

  const filteredTransfers = useMemo(() => {
    let result = transfers;
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          (t.transfer_code || "").toLowerCase().includes(q) ||
          (t.asset_code || "").toLowerCase().includes(q) ||
          (t.asset_name || "").toLowerCase().includes(q) ||
          (t.reason || "").toLowerCase().includes(q) ||
          (t.to_department || "").toLowerCase().includes(q) ||
          (t.from_department || "").toLowerCase().includes(q) ||
          (t.requested_by_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [transfers, statusFilter, searchTerm]);

  const paginatedTransfers = useMemo(() => {
    return filteredTransfers.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );
  }, [filteredTransfers, currentPage, rowsPerPage]);

  const handleAction = async (type: "approve" | "reject" | "complete" | "cancel", transfer: AssetTransfer) => {
    setActionDialog({ open: true, type, transfer });
    setReason("");
  };

  const executeAction = async () => {
    const { type, transfer } = actionDialog;
    if (!transfer) return;
    setSubmitting(true);
    try {
      let result;
      switch (type) {
        case "approve":
          result = await approveTransfer(transfer.id, reason || undefined);
          break;
        case "reject":
          result = await rejectTransfer(transfer.id, reason || undefined);
          break;
        case "complete":
          result = await completeTransfer(transfer.id);
          break;
        case "cancel":
          result = await cancelTransfer(transfer.id);
          break;
      }
      toast.success(`Transfer ${result.transfer_code} ${type}d successfully`);
      await fetchTransfers(true);
      await logActivity(
        `transfer_${type}d`,
        `Transfer ${transfer.transfer_code} ${type}d`
      );
      trackActivity("transfer", type, {
        entityId: transfer.transfer_code,
        entityName: transfer.asset_name,
      }).catch(() => {});
    } catch (e: any) {
      toast.error(e.message || `Failed to ${type} transfer`);
    } finally {
      setSubmitting(false);
      setActionDialog({ open: false, type: "approve", transfer: null });
      setReason("");
    }
  };

  const canManage = role === "admin" || role === "manager";

  const getActionLabel = (type: string) => {
    switch (type) {
      case "approve": return "Approve";
      case "reject": return "Reject";
      case "complete": return "Complete";
      case "cancel": return "Cancel";
      default: return "";
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "approve": return <CheckCircle className="h-4 w-4" />;
      case "reject": return <XCircle className="h-4 w-4" />;
      case "complete": return <ArrowRightLeft className="h-4 w-4" />;
      case "cancel": return <RotateCcw className="h-4 w-4" />;
      default: return null;
    }
  };

  const availableActions = (t: AssetTransfer) => {
    const actions: Array<{ label: string; action: string; icon: React.ReactNode }> = [];
    if (!canManage) return actions;
    switch (t.status) {
      case "pending":
        actions.push({ label: "Approve", action: "approve", icon: <CheckCircle className="h-3.5 w-3.5" /> });
        actions.push({ label: "Reject", action: "reject", icon: <XCircle className="h-3.5 w-3.5" /> });
        actions.push({ label: "Cancel", action: "cancel", icon: <RotateCcw className="h-3.5 w-3.5" /> });
        break;
      case "approved":
        actions.push({ label: "Complete", action: "complete", icon: <ArrowRightLeft className="h-3.5 w-3.5" /> });
        actions.push({ label: "Cancel", action: "cancel", icon: <RotateCcw className="h-3.5 w-3.5" /> });
        break;
      case "completed":
        break;
      case "rejected":
      case "cancelled":
        break;
    }
    return actions;
  };

  const columnDefs = useMemo<ColumnDef[]>(() => [
    { key: "transfer_code", label: "Transfer Code", always: true },
    { key: "asset_code", label: "Asset Code", always: true },
    { key: "asset_name", label: "Asset Name" },
    { key: "from_department", label: "From Dept" },
    { key: "to_department", label: "To Dept" },
    { key: "from_property_name", label: "From Property" },
    { key: "to_property_name", label: "To Property" },
    { key: "from_owner_name", label: "From Owner" },
    { key: "to_owner_name", label: "To Owner" },
    { key: "quantity", label: "Qty" },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status", always: true },
    { key: "requested_by_name", label: "Requested By" },
    { key: "requested_at", label: "Requested At" },
    { key: "approved_by_name", label: "Approved By" },
    { key: "approved_at", label: "Approved At" },
    { key: "completed_by_name", label: "Completed By" },
    { key: "completed_at", label: "Completed At" },
    { key: "actions", label: "Actions", always: true },
  ], []);

  const prefs = useTablePreferences("transfers");
  const ALWAYS_COLS = useMemo(
    () => new Set(columnDefs.filter((c) => c.always).map((c) => c.key)),
    [columnDefs],
  );
  const isVisible = useCallback(
    (key: string) => ALWAYS_COLS.has(key) || prefs.visibleCols.includes(key),
    [ALWAYS_COLS, prefs.visibleCols]
  );

  useEffect(() => {
    if (!prefs.visibleCols.length) {
      const defaults = columnDefs.map((c) => c.key);
      const merged = Array.from(new Set([...Array.from(ALWAYS_COLS), ...defaults]));
      prefs.setVisibleCols(merged);
    }
  }, [ALWAYS_COLS, columnDefs, prefs]);

  return (
    <div className="space-y-6 pb-10">
      <Breadcrumbs items={[{ label: "Transfers" }]} />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asset Transfers</h1>
          <p className="text-muted-foreground mt-1">Track and manage asset movements between departments, properties, and owners.</p>
        </div>
      </div>

      {isDemoMode() && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Demo mode – transfer data is simulated.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer List
          </CardTitle>
          <CardDescription>
            {transfers.length} transfers found. Use filters to narrow results.
          </CardDescription>
          <div className="flex flex-wrap gap-4 items-center pt-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transfers..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              <span className="ml-2 text-sm text-muted-foreground">Loading transfers...</span>
            </div>
          ) : paginatedTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transfers found</p>
              <p className="text-sm text-muted-foreground/70">Create transfers from the Assets page</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columnDefs.map((col) => (
                        isVisible(col.key) && (
                          <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>
                        )
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransfers.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/50">
                        {isVisible("transfer_code") && (
                          <TableCell className="font-mono text-sm">
                            <Link to={`/assets/${t.asset_code}`} className="hover:underline">
                              {t.transfer_code}
                            </Link>
                          </TableCell>
                        )}
                        {isVisible("asset_code") && (
                          <TableCell className="font-mono text-sm">
                            {t.asset_code}
                          </TableCell>
                        )}
                        {isVisible("asset_name") && (
                          <TableCell className="max-w-48 truncate">{t.asset_name}</TableCell>
                        )}
                        {isVisible("from_department") && (
                          <TableCell>{t.from_department || "—"}</TableCell>
                        )}
                        {isVisible("to_department") && (
                          <TableCell>{t.to_department || "—"}</TableCell>
                        )}
                        {isVisible("from_property_name") && (
                          <TableCell>{t.from_property_name || "—"}</TableCell>
                        )}
                        {isVisible("to_property_name") && (
                          <TableCell>{t.to_property_name || "—"}</TableCell>
                        )}
                        {isVisible("from_owner_name") && (
                          <TableCell>{t.from_owner_name || "—"}</TableCell>
                        )}
                        {isVisible("to_owner_name") && (
                          <TableCell>{t.to_owner_name || "—"}</TableCell>
                        )}
                        {isVisible("quantity") && (
                          <TableCell className="text-center">{t.quantity}</TableCell>
                        )}
                        {isVisible("reason") && (
                          <TableCell className="max-w-48 truncate">{t.reason}</TableCell>
                        )}
                        {isVisible("status") && (
                          <TableCell>{statusBadge(t.status)}</TableCell>
                        )}
                        {isVisible("requested_by_name") && (
                          <TableCell>{t.requested_by_name || t.requested_by_email || "—"}</TableCell>
                        )}
                        {isVisible("requested_at") && (
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatShortDate(t.requested_at)}
                          </TableCell>
                        )}
                        {isVisible("approved_by_name") && (
                          <TableCell>{t.approved_by_name || "—"}</TableCell>
                        )}
                        {isVisible("approved_at") && (
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {t.approved_at ? formatShortDate(t.approved_at) : "—"}
                          </TableCell>
                        )}
                        {isVisible("completed_by_name") && (
                          <TableCell>{t.completed_by_name || "—"}</TableCell>
                        )}
                        {isVisible("completed_at") && (
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {t.completed_at ? formatShortDate(t.completed_at) : "—"}
                          </TableCell>
                        )}
                        {isVisible("actions") && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link to={`/assets/${t.asset_code}`} className="cursor-pointer">
                                    <Eye className="h-3.5 w-3.5 mr-2" />
                                    View Asset
                                  </Link>
                                </DropdownMenuItem>
                                {availableActions(t).map((a) => (
                                  <DropdownMenuItem
                                    key={a.action}
                                    onClick={() => handleAction(a.action as any, t)}
                                    className="cursor-pointer text-destructive/80 focus:text-destructive"
                                  >
                                    {a.icon}
                                    {a.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={currentPage}
                totalItems={filteredTransfers.length}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={actionDialog.open}
        onOpenChange={(open) => {
          if (!open) setActionDialog({ open: false, type: "approve", transfer: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getActionIcon(actionDialog.type)}
              {getActionLabel(actionDialog.type)} Transfer
            </DialogTitle>
            <DialogDescription>
              {actionDialog.transfer && (
                <>
                  Transfer <strong>{actionDialog.transfer.transfer_code}</strong> for asset <strong>{actionDialog.transfer.asset_code}</strong> ({actionDialog.transfer.asset_name})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {actionDialog.type === "reject" && (
            <div className="space-y-2 py-2">
              <Label htmlFor="reason">Reason for rejection</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this transfer is being rejected..."
                rows={3}
              />
            </div>
          )}
          {actionDialog.type === "approve" && (
            <div className="space-y-2 py-2">
              <Label htmlFor="reason">Approval notes (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add any notes for the approval..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: "approve", transfer: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={executeAction}
              disabled={submitting || (actionDialog.type === "reject" && !reason.trim())}
              className={cn(
                actionDialog.type === "reject" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                actionDialog.type === "approve" && "bg-green-600 text-white hover:bg-green-700",
                actionDialog.type === "complete" && "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {submitting ? "Processing..." : getActionLabel(actionDialog.type)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { AlertCircle } from "lucide-react";
