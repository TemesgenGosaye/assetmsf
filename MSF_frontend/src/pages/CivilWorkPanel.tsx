import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import {
  Building2, Wrench, Clock, CheckCircle2, XCircle, AlertTriangle,
  Users, BarChart3, Filter, RefreshCw, UserCheck, Eye,
  Home, DollarSign, Calendar, MessageSquare, ArrowRight,
  Package, Zap, Droplets, Paintbrush, DoorOpen, Hammer,
} from "lucide-react";
import {
  listCivilWorkRequests,
  getCivilWorkStats,
  receiveMaintenanceRequest,
  assignMaintenanceRequest,
  updateMaintenanceRequest,
  listCivilWorkTeam,
  getMaintenanceRequestDetail,
  type MaintenanceRequest,
  type CivilWorkStats,
  type MaintenanceStatus,
} from "@/services/maintenanceRequest";

const STATUS_COLORS: Record<string, string> = {
  Submitted: "bg-blue-100 text-blue-700 border-blue-200",
  Received: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-200",
  "On Hold": "bg-orange-100 text-orange-700 border-orange-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-700",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Emergency: "bg-red-100 text-red-700",
};

const CATEGORY_ICONS: Record<string, typeof Wrench> = {
  Plumbing: Droplets,
  Electrical: Zap,
  Structural: Hammer,
  Roofing: Home,
  Painting: Paintbrush,
  "Door & Window": DoorOpen,
  "Water Supply": Droplets,
  General: Wrench,
  Other: Package,
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  Submitted: ["Received", "Cancelled"],
  Received: ["In Progress", "On Hold", "Rejected", "Cancelled"],
  "In Progress": ["On Hold", "Completed", "Cancelled"],
  "On Hold": ["In Progress", "Cancelled"],
  Completed: [],
  Rejected: [],
  Cancelled: [],
};

export default function CivilWorkPanel() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [stats, setStats] = useState<CivilWorkStats | null>(null);
  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Update form state
  const [updateStatus, setUpdateStatus] = useState<MaintenanceStatus>("In Progress");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateCost, setUpdateCost] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const filters: any = {};
      if (filterStatus !== "all") filters.status = filterStatus;
      if (filterPriority !== "all") filters.priority = filterPriority;
      if (filterCategory !== "all") filters.category = filterCategory;

      const [reqs, statsData, teamData] = await Promise.all([
        listCivilWorkRequests(filters),
        getCivilWorkStats().catch(() => null),
        listCivilWorkTeam().catch(() => []),
      ]);
      setRequests(reqs);
      setStats(statsData);
      setTeam(teamData);
    } catch (e: any) {
      toast.error("Failed to load data: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus, filterPriority, filterCategory]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData(true);
    toast.success("Data refreshed");
  }

  async function handleReceive(id: string) {
    try {
      await receiveMaintenanceRequest(id);
      toast.success("Request received successfully");
      await loadData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to receive request");
    }
  }

  async function handleAssign() {
    if (!selectedRequest || !assigneeId) return;
    try {
      await assignMaintenanceRequest(selectedRequest.id, assigneeId);
      toast.success("Request assigned successfully");
      setAssignDialogOpen(false);
      setAssigneeId("");
      await loadData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to assign request");
    }
  }

  async function handleUpdate() {
    if (!selectedRequest) return;
    try {
      const patch: any = { status: updateStatus };
      if (updateNotes.trim()) patch.resolution_notes = updateNotes.trim();
      if (updateCost.trim()) patch.actual_cost = parseFloat(updateCost);
      await updateMaintenanceRequest(selectedRequest.id, patch);
      toast.success("Request updated successfully");
      setUpdateDialogOpen(false);
      setUpdateNotes("");
      setUpdateCost("");
      await loadData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to update request");
    }
  }

  async function handleReject() {
    if (!selectedRequest || !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await updateMaintenanceRequest(selectedRequest.id, {
        status: "Rejected",
        rejection_reason: rejectReason.trim(),
      });
      toast.success("Request rejected");
      setRejectDialogOpen(false);
      setRejectReason("");
      await loadData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to reject request");
    }
  }

  function openDetail(req: MaintenanceRequest) {
    setSelectedRequest(req);
    setDetailDialogOpen(true);
  }

  function openAssign(req: MaintenanceRequest) {
    setSelectedRequest(req);
    setAssigneeId(req.civil_work_assigned_to || "");
    setAssignDialogOpen(true);
  }

  function openUpdate(req: MaintenanceRequest) {
    setSelectedRequest(req);
    setUpdateStatus(req.status as MaintenanceStatus);
    setUpdateNotes(req.resolution_notes || "");
    setUpdateCost(req.actual_cost ? String(req.actual_cost) : "");
    setUpdateDialogOpen(true);
  }

  function openReject(req: MaintenanceRequest) {
    setSelectedRequest(req);
    setRejectReason(req.rejection_reason || "");
    setRejectDialogOpen(true);
  }

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      (r.house_number || "").toLowerCase().includes(q) ||
      (r.house_hid || "").toLowerCase().includes(q) ||
      (r.requested_by_name || "").toLowerCase().includes(q)
    );
  });

  const statCards = stats
    ? [
        { label: "Total", value: stats.total, icon: BarChart3, color: "text-[#0B4F2F]" },
        { label: "Submitted", value: stats.by_status["Submitted"] || 0, icon: Clock, color: "text-blue-600" },
        { label: "Received", value: stats.by_status["Received"] || 0, icon: Eye, color: "text-indigo-600" },
        { label: "In Progress", value: stats.by_status["In Progress"] || 0, icon: Wrench, color: "text-amber-600" },
        { label: "Completed", value: stats.by_status["Completed"] || 0, icon: CheckCircle2, color: "text-green-600" },
        { label: "Overdue", value: stats.overdue_count, icon: AlertTriangle, color: "text-red-600" },
      ]
    : [];

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B4F2F] to-[#0E5A37] shadow-md">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Civil Work Department</h1>
            <p className="text-sm text-muted-foreground">
              Manage incoming maintenance requests from house occupants
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((s) => (
            <Card key={s.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                  <s.icon className={`h-8 w-8 ${s.color} opacity-20`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-60"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="Received">Received</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Plumbing">Plumbing</SelectItem>
                <SelectItem value="Electrical">Electrical</SelectItem>
                <SelectItem value="Structural">Structural</SelectItem>
                <SelectItem value="Roofing">Roofing</SelectItem>
                <SelectItem value="Painting">Painting</SelectItem>
                <SelectItem value="Flooring">Flooring</SelectItem>
                <SelectItem value="Door & Window">Door & Window</SelectItem>
                <SelectItem value="Water Supply">Water Supply</SelectItem>
                <SelectItem value="Drainage">Drainage</SelectItem>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Request List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-[#0B4F2F] dark:text-[#7BC29A]" />
            Maintenance Requests
            <Badge variant="outline" className="ml-2">{filteredRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500/40" />
              <p className="text-sm text-muted-foreground">No maintenance requests found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map((req) => {
                const CatIcon = CATEGORY_ICONS[req.category] || Wrench;
                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-4 rounded-xl border p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                      <CatIcon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{req.request_number}</span>
                        <Badge className={`${STATUS_COLORS[req.status] || ""} text-[10px] px-1.5 py-0`} variant="outline">
                          {req.status}
                        </Badge>
                        <Badge className={`${PRIORITY_COLORS[req.priority] || ""} text-[10px] px-1.5 py-0`} variant="outline">
                          {req.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {req.category}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-sm truncate">{req.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{req.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" />
                          {req.house_number || req.house_hid} — {req.house_location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {req.requested_by_name || "Unknown"}
                        </span>
                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                        {req.civil_work_assigned_to_name && (
                          <span className="flex items-center gap-1 text-indigo-600">
                            <UserCheck className="h-3 w-3" />
                            {req.civil_work_assigned_to_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(req)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {req.status === "Submitted" && (
                        <Button
                          size="sm"
                          onClick={() => handleReceive(req.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Receive
                        </Button>
                      )}
                      {["Received", "In Progress", "On Hold"].includes(req.status) && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openAssign(req)}>
                            Assign
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openUpdate(req)}>
                            Update
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openReject(req)} className="text-red-600 hover:text-red-700">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{selectedRequest.request_number}</span>
                  <Badge className={`${STATUS_COLORS[selectedRequest.status] || ""}`} variant="outline">
                    {selectedRequest.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedRequest.title}</DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="font-medium">{selectedRequest.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Priority</p>
                      <p className="font-medium">{selectedRequest.priority}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">House</p>
                      <p className="font-medium">
                        {selectedRequest.house_number || selectedRequest.house_hid} — {selectedRequest.house_location}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Requested By</p>
                      <p className="font-medium">{selectedRequest.requested_by_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Submitted</p>
                      <p className="font-medium">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                    </div>
                    {selectedRequest.received_at && (
                      <div>
                        <p className="text-xs text-muted-foreground">Received</p>
                        <p className="font-medium">{new Date(selectedRequest.received_at).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedRequest.civil_work_assigned_to_name && (
                      <div>
                        <p className="text-xs text-muted-foreground">Assigned To</p>
                        <p className="font-medium">{selectedRequest.civil_work_assigned_to_name}</p>
                      </div>
                    )}
                    {selectedRequest.actual_cost > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Actual Cost</p>
                        <p className="font-medium">ETB {selectedRequest.actual_cost.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedRequest.description}</p>
                  </div>

                  {selectedRequest.resolution_notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Resolution Notes</p>
                        <p className="text-sm text-green-700 whitespace-pre-wrap">{selectedRequest.resolution_notes}</p>
                      </div>
                    </>
                  )}

                  {selectedRequest.rejection_reason && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Rejection Reason</p>
                        <p className="text-sm text-red-600 whitespace-pre-wrap">{selectedRequest.rejection_reason}</p>
                      </div>
                    </>
                  )}

                  {/* Audit Trail */}
                  {selectedRequest.logs && selectedRequest.logs.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Activity Log</p>
                        <div className="space-y-2">
                          {selectedRequest.logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-2 text-xs">
                              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[#0B4F2F] shrink-0" />
                              <div>
                                <span className="font-medium">{log.event_type}</span>
                                {log.actor_name && (
                                  <span className="text-muted-foreground"> by {log.actor_name}</span>
                                )}
                                {log.note && (
                                  <p className="text-muted-foreground mt-0.5">{log.note}</p>
                                )}
                                <span className="text-muted-foreground">
                                  {" "}— {new Date(log.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="pt-3 border-t">
                {selectedRequest.status === "Submitted" && (
                  <Button
                    onClick={() => { setDetailDialogOpen(false); handleReceive(selectedRequest.id); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Receive Request
                  </Button>
                )}
                {["Received", "In Progress", "On Hold"].includes(selectedRequest.status) && (
                  <div className="flex gap-2">
                    <Button onClick={() => { setDetailDialogOpen(false); openAssign(selectedRequest); }}>
                      Assign
                    </Button>
                    <Button variant="outline" onClick={() => { setDetailDialogOpen(false); openUpdate(selectedRequest); }}>
                      Update Status
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Request</DialogTitle>
            <DialogDescription>
              Assign this maintenance request to a civil work team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team Member *</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {team.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assigneeId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Request</DialogTitle>
            <DialogDescription>
              Update the status and add notes for this maintenance request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={updateStatus} onValueChange={(v) => setUpdateStatus(v as MaintenanceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_TRANSITIONS[selectedRequest?.status || ""]?.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                placeholder="Describe the work done or status update..."
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Actual Cost (ETB)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={updateCost}
                onChange={(e) => setUpdateCost(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Reject Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this maintenance request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                placeholder="Explain why this request is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
