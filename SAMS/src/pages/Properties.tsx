import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
import MetricCard from "@/components/ui/metric-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Package,
  MapPin,
  Edit,
  Trash2,
  AlertTriangle,
  Users,
  Hash,
  User,
  ChevronRight,
  ChevronLeft,
  Plus,
  Settings,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isDemoMode } from "@/lib/demo";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listProperties,
  deleteProperty,
  createProperty,
  updateProperty,
  type Property,
} from "@/services/properties";
import { listAssets, type Asset } from "@/services/assets";
import { listPropertyLicenses } from "@/services/license";
import { logActivity } from "@/services/activity";
import { trackActivity } from "@/services/notifications";
import { getCurrentUserId, canUserEdit } from "@/services/permissions";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { TablePagination } from "@/components/ui/table-pagination";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from "recharts";
// removed dropdown actions; showing buttons inline for better visibility

// ── Property Detail Sheet ─────────────────────────────────────────────────

function PropertyDetailSheet({
  property,
  open,
  onClose,
  onEdit,
  onDelete,
  role,
}: {
  property: any | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (p: any) => void;
  onDelete?: (p: any) => void;
  role: string;
}) {
  if (!property) return null;

  const Field = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium break-words">
          {value || "—"}
        </div>
      </div>
    </div>
  );

  const limit = Number(property.licenseLimit) || 0;
  const effectiveLimited = limit > 0;
  const pct = effectiveLimited
    ? Math.min(
        100,
        Math.round(((Number(property.assetCount) || 0) / limit) * 100),
      )
    : 0;
  const statusColor =
    (property.status || "").toLowerCase() === "active"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/30 dark:text-emerald-400"
      : "bg-rose-500/10 text-rose-700 border-rose-400/30 dark:text-rose-400";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-8 pb-6 border-b border-border/60">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center shadow-sm ring-2 ring-primary/20">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold leading-tight">{property.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {property.type}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
                >
                  {property.status}
                </span>
                <Badge variant="outline" className="text-xs font-mono">
                  {property.id}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Details
            </p>
            <div className="space-y-3">
              <Field
                icon={Hash}
                label="Property ID"
                value={<span className="font-mono">{property.id}</span>}
              />
              <Field icon={Building2} label="Name" value={property.name} />
              <Field icon={MapPin} label="Address" value={property.address} />
              <Field icon={User} label="Manager" value={property.manager} />
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Usage
            </p>
            <div className="space-y-3">
              <Field
                icon={Package}
                label="Assets"
                value={
                  <div className="space-y-1.5">
                    <span>
                      {property.assetCount}
                      {effectiveLimited ? (
                        <span className="text-muted-foreground text-xs ml-1">
                          / {limit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs ml-1">
                          unlimited
                        </span>
                      )}
                    </span>
                    {effectiveLimited && (
                      <div className="h-1.5 w-full rounded-full bg-muted/60">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                }
              />
              <Field
                icon={Users}
                label="Users"
                value={`${Number(property.userCount) || 0} assigned`}
              />
            </div>
          </div>
          {property._plan && (
            <>
              <Separator />
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  License
                </p>
                <div className="space-y-3">
                  <Field
                    icon={ChevronRight}
                    label="Plan"
                    value={
                      <span className="capitalize font-mono">
                        {property._plan}
                      </span>
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {role === "admin" && (
          <div className="border-t border-border/60 bg-muted/10 px-6 py-4 space-y-2">
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    onClose();
                    onEdit(property);
                  }}
                >
                  <Edit className="h-4 w-4" /> Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={() => {
                    onDelete(property);
                    onClose();
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Properties() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [role, setRole] = useState<string>("");
  const [accessibleProps, setAccessibleProps] = useState<Set<string>>(
    new Set(),
  );
  // UI state: filters and search
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    address: "",
    type: "Office",
    status: "Active",
    manager: "",
  });
  const [canEditPage, setCanEditPage] = useState<boolean>(false);
  const [detailProperty, setDetailProperty] = useState<any | null>(null);
  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        const allowed = uid ? await canUserEdit(uid, "properties") : null;
        const baseline = role === "admin";
        setCanEditPage(allowed === null ? baseline : allowed);
      } catch {
        setCanEditPage(role === "admin");
      }
    })();
  }, [role]);

  const loadPropertiesData = useCallback(async () => {
    try {
      const [props, assets, licenses] = await Promise.all([
        listProperties(),
        listAssets().catch(() => [] as Asset[]),
        listPropertyLicenses().catch(() => []),
      ]);

      const assetCounts: Record<string, number> = {};
      for (const a of assets) {
        const key = (a.property_id || a.property || "").toString();
        if (!key) continue;
        assetCounts[key] = (assetCounts[key] || 0) + 1;
      }

      const licMap: Record<string, { limit: number; plan?: string | null }> =
        {};
      for (const l of licenses as any[]) {
        if (l?.property_id)
          licMap[l.property_id] = { limit: l.asset_limit || 0, plan: l.plan };
      }

      function derivedFromPlan(plan?: string | null): number | null {
        switch (plan) {
          case "free":
            return 100;
          case "standard":
            return 500;
          case "pro":
            return 2500;
          case "business":
            return null;
          default:
            return null;
        }
      }

      const merged = props.map((p: Property) => {
        const entry = licMap[p.id];
        const plan = entry?.plan;
        const rawLimit = entry?.limit ?? 0;
        const derived = rawLimit === 0 ? derivedFromPlan(plan) : null;
        const effective = rawLimit > 0 ? rawLimit : (derived ?? 0);
        return {
          id: p.id,
          name: p.name,
          address: p.address ?? "",
          type: p.type,
          status: p.status,
          manager: p.manager ?? "",
          assetCount: assetCounts[p.id] ?? 0,
          userCount: 0,
          licenseLimit: effective,
          _rawLimit: rawLimit,
          _plan: plan,
          _derived: derived,
        } as any;
      });
      setProperties(merged);
    } catch (e: any) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadPropertiesData();
  }, [loadPropertiesData]);

  // Load accessible property ids for current user (used to filter visibility for non-admins)
  useEffect(() => {
    (async () => {
      try {
        const ids = await getAccessiblePropertyIdsForCurrentUser();
        setAccessibleProps(ids);
      } catch {
        setAccessibleProps(new Set());
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const raw =
        (isDemoMode()
          ? sessionStorage.getItem("demo_auth_user") ||
            localStorage.getItem("demo_auth_user")
          : null) || localStorage.getItem("auth_user");
      const r = raw ? JSON.parse(raw).role || "" : "";
      setRole((r || "").toLowerCase());
    } catch {}
  }, []);

  // Add Property opens the inline dialog

  const handleEditProperty = (propertyId: string) => {
    if ((role || "").toLowerCase() !== "admin") {
      toast.error("Only admins can edit properties");
      return;
    }
    setEditingId(propertyId);
    const p = properties.find((x: any) => x.id === propertyId);
    if (p) {
      setForm({
        id: p.id,
        name: p.name,
        address: p.address ?? "",
        type: p.type,
        status: p.status,
        manager: p.manager ?? "",
      });
      setIsDialogOpen(true);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    if ((role || "").toLowerCase() !== "admin") {
      toast.error("Only admins can delete properties");
      return;
    }
    const ok = window.confirm(
      `Are you sure you want to delete property ${propertyId}?`,
    );
    if (!ok) return;
    try {
      await deleteProperty(propertyId);
      toast.success(`Property ${propertyId} deleted`);
      await logActivity("property_deleted", `Property ${propertyId} deleted`);
      await trackActivity("property", "delete", {
        entityName: propertyId,
        entityId: propertyId,
      });
      loadPropertiesData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete property");
    }
  };

  const handleSubmit = async () => {
    try {
      if (!form.name || !form.type || !form.status) {
        toast.error("Please fill required fields");
        return;
      }
      const id =
        editingId || form.id || `PROP-${Math.floor(Math.random() * 900 + 100)}`;

      if (editingId) {
        await updateProperty(editingId, {
          name: form.name,
          address: form.address,
          type: form.type,
          status: form.status,
        });
        toast.success("Property updated");
        await logActivity("property_updated", `Property ${editingId} updated`);
        await trackActivity("property", "update", {
          entityName: form.name,
          entityId: editingId,
          changes: [form.type, form.status].filter(Boolean),
        });
      } else {
        await createProperty({
          id,
          name: form.name,
          address: form.address,
          type: form.type,
          status: form.status,
        } as Property);
        toast.success("Property created");
        await logActivity("property_created", `Property ${id} created`);
        await trackActivity("property", "create", {
          entityName: form.name,
          entityId: id,
        });
      }
      setIsDialogOpen(false);
      setEditingId(null);
      setForm({
        id: "",
        name: "",
        address: "",
        type: "Office",
        status: "Active",
        manager: "",
      });
      loadPropertiesData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save property");
    }
  };

  const getStatusBadge = (status: string) => (
    <StatusChip status={status} size="sm" className="px-2" />
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Office":
        return "text-primary";
      case "Storage":
        return "text-warning";
      case "Manufacturing":
        return "text-success";
      case "Site Office":
        return "text-muted-foreground";
      default:
        return "text-foreground";
    }
  };

  // Derived helpers for UI rendering
  // Restrict visible properties for non-admins when access list is available
  const visibleProperties = (() => {
    if (role === "admin") return properties;
    if (accessibleProps && accessibleProps.size)
      return properties.filter((p) => accessibleProps.has(String(p.id)));
    return properties;
  })();

  const filtered = visibleProperties.filter((p) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      [p.name, p.address, p.id, p.type, p.manager].some((v: any) =>
        (v || "").toString().toLowerCase().includes(term),
      );
    const matchesType =
      typeFilter === "all" ||
      (p.type || "").toString().toLowerCase() === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (p.status || "").toString().toLowerCase() === statusFilter;
    return matchesTerm && matchesType && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filtered.slice(
    (safeCurrentPage - 1) * rowsPerPage,
    safeCurrentPage * rowsPerPage,
  );

  const maxAssets = Math.max(
    1,
    ...filtered.map((p: any) => Number(p.assetCount) || 0),
  );
  const inactiveCount = filtered.filter(
    (p) => (p.status || "").toLowerCase() === "inactive",
  ).length;
  const propertyHighlights = useMemo(() => {
    const totalProperties = filtered.length;
    const activeProperties = filtered.filter(
      (p) => (p.status || "").toLowerCase() === "active",
    ).length;
    const inactiveProperties = filtered.filter(
      (p) => (p.status || "").toLowerCase() === "inactive",
    ).length;
    const totalAssetsCount = filtered.reduce(
      (sum, prop) => sum + (Number(prop.assetCount) || 0),
      0,
    );

    return [
      {
        key: "total",
        title: "Total Properties",
        icon: Building2,
        value: totalProperties.toLocaleString(),
        caption: "Properties in current view",
        iconClassName: "text-primary h-4 w-4",
      },
      {
        key: "active",
        title: "Active Properties",
        icon: MapPin,
        value: activeProperties.toLocaleString(),
        caption: "Open and operating",
        iconClassName: "text-primary h-4 w-4",
        valueClassName: activeProperties ? "text-foreground" : undefined,
      },
      {
        key: "assets",
        title: "Total Assets",
        icon: Package,
        value: totalAssetsCount.toLocaleString(),
        caption: "Assets across properties",
        iconClassName: "text-primary h-4 w-4",
      },
      {
        key: "inactive",
        title: "Inactive Properties",
        icon: AlertTriangle,
        value: inactiveProperties.toLocaleString(),
        caption: "Temporarily offline",
        iconClassName: "text-primary h-4 w-4",
        valueClassName: inactiveProperties ? "text-foreground" : undefined,
      },
    ];
  }, [filtered]);
  const typeCounts = (() => {
    const map = new Map<string, number>();
    for (const p of filtered) {
      const t = p.type || "Other";
      map.set(t, (map.get(t) || 0) + 1);
    }
    const paletteTypes = [
      "hsl(221, 83%, 53%)", // Blue
      "hsl(142, 71%, 45%)", // Green
      "hsl(262, 83%, 58%)", // Purple
      "hsl(31, 97%, 55%)", // Orange
      "hsl(339, 90%, 51%)", // Pink
      "hsl(191, 91%, 46%)", // Cyan
      "hsl(47, 95%, 57%)", // Yellow
    ];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: paletteTypes[i % paletteTypes.length],
      }));
  })();

  const assetsByType = (() => {
    const map = new Map<string, number>();
    for (const p of filtered) {
      const t = p.type || "Other";
      const count = Number(p.assetCount) || 0;
      map.set(t, (map.get(t) || 0) + count);
    }
    const paletteAssets = [
      "hsl(191, 91%, 46%)", // Cyan
      "hsl(339, 90%, 51%)", // Pink
      "hsl(31, 97%, 55%)", // Orange
      "hsl(262, 83%, 58%)", // Purple
      "hsl(142, 71%, 45%)", // Green
      "hsl(221, 83%, 53%)", // Blue
      "hsl(47, 95%, 57%)", // Yellow
    ];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, assets], i) => ({
        name,
        assets,
        fill: paletteAssets[i % paletteAssets.length],
      }));
  })();

  const assetsByTypeSorted = useMemo(
    () => [...assetsByType].sort((a, b) => b.assets - a.assets),
    [assetsByType],
  );

  // Themed tooltip for charts to ensure readability in dark mode
  function ChartTooltip({ active, payload, label, formatter }: any) {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-sm">
          {label && (
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {label}
            </p>
          )}
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: entry.color || entry.fill || entry.stroke,
                }}
              />
              <span className="font-medium text-foreground">
                {formatter
                  ? formatter(entry.value, entry.name, entry)[0]
                  : entry.value}
              </span>
              <span className="text-muted-foreground">
                {formatter
                  ? formatter(entry.value, entry.name, entry)[1]
                  : entry.name}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <div className="space-y-8 pb-10">
        <Breadcrumbs
          items={[{ label: "Dashboard", to: "/" }, { label: "Properties" }]}
        />

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-10 shadow-sm sm:px-12 sm:py-12">
          <div className="relative z-10 max-w-3xl space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Property Management
            </h1>
            <p className="text-lg text-muted-foreground">
              Manage properties and related assets
            </p>
          </div>
          {/* Decorative background element */}
          <div className="absolute right-0 top-0 -z-10 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent" />
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Input
                  placeholder="Search properties, IDs, addresses…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {canEditPage && (
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      id: "",
                      name: "",
                      address: "",
                      type: "Office",
                      status: "Active",
                      manager: "",
                    });
                    setIsDialogOpen(true);
                  }}
                  className="gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add Property
                </Button>
              )}
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="office">Office</SelectItem>
                    <SelectItem value="storage">Storage</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="site office">Site Office</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
          {propertyHighlights.map((item) => (
            <MetricCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              value={item.value}
              caption={item.caption}
              iconClassName={item.iconClassName}
              valueClassName={item.valueClassName}
            />
          ))}
        </div>

        {/* Properties Table */}
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Properties</span>
              <span className="text-muted-foreground">({filtered.length})</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table dense stickyHeader className="text-sm">
              <TableHeader className="bg-transparent">
                <TableRow className="border-b border-border/60 shadow-[inset_0_-1px_0_theme(colors.border/0.45)] hover:bg-transparent">
                  <TableHead className="min-w-[200px] whitespace-nowrap">
                    Property
                  </TableHead>
                  <TableHead className="min-w-[180px] whitespace-nowrap">
                    Address
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="min-w-[140px] whitespace-nowrap">
                    Assets
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Manager</TableHead>
                  {role === "admin" && (
                    <TableHead className="whitespace-nowrap text-right">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={role === "admin" ? 6 : 5}
                      className="h-32 text-center text-sm text-muted-foreground"
                    >
                      No properties match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((property, idx) => {
                    const limit = (property as any).licenseLimit;
                    const effectiveLimited = limit > 0;
                    const pct = effectiveLimited
                      ? Math.min(
                          100,
                          Math.round(
                            ((Number(property.assetCount) || 0) / limit) * 100,
                          ),
                        )
                      : 0;
                    return (
                      <TableRow
                        key={property.id}
                        className={`group cursor-pointer select-none border-b border-slate-200 bg-white transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 ${idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-900/40" : ""}`}
                        onDoubleClick={() =>
                          navigate(`/properties/${property.id}`)
                        }
                      >
                        <TableCell className="py-2 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-foreground/95 leading-tight">
                                {property.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span className="text-[10px] font-mono text-muted-foreground/70">
                                  {property.id}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50">
                                  ·
                                </span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  {property.type}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <div className="flex max-w-[220px] items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="mt-px h-3 w-3 shrink-0 text-muted-foreground/50" />
                            <span className="leading-snug">
                              {property.address || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          {getStatusBadge(property.status)}
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Package className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <span className="font-medium text-foreground">
                                {property.assetCount}
                              </span>
                              {effectiveLimited ? (
                                <span className="text-[10px] text-muted-foreground">
                                  / {limit}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/50">
                                  unlimited
                                </span>
                              )}
                            </div>
                            {effectiveLimited && (
                              <div className="h-1 w-20 rounded-full bg-muted/50">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <span className="text-sm text-foreground/80">
                            {property.manager || "—"}
                          </span>
                        </TableCell>
                        {role === "admin" && (
                          <TableCell className="py-2 align-middle text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProperty(property.id);
                                }}
                                className="h-7 w-7 rounded-sm border border-transparent p-0 text-muted-foreground hover:border-slate-300 hover:bg-slate-100 hover:text-foreground dark:hover:border-slate-700 dark:hover:bg-slate-800"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProperty(property.id);
                                }}
                                className="h-7 w-7 rounded-sm border border-transparent p-0 text-muted-foreground hover:border-slate-300 hover:bg-slate-100 hover:text-destructive dark:hover:border-slate-700 dark:hover:bg-slate-800"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Pagination */}
        <TablePagination
          currentPage={safeCurrentPage}
          totalItems={filtered.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={(v) => {
            setRowsPerPage(v);
            setCurrentPage(1);
          }}
        />

        {/* Property Types & Assets by Type (compact two-chart grid) */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border border-border/60 bg-card shadow-sm min-w-0">
            <CardHeader className="space-y-1">
              <CardTitle>Property Types Distribution</CardTitle>
              <CardDescription>
                See how your portfolio is spread across location types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip
                      content={
                        <ChartTooltip
                          formatter={(value: any, name: any) => [value, name]}
                        />
                      }
                    />
                    <Pie
                      dataKey="value"
                      data={typeCounts}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      cornerRadius={6}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {typeCounts.map((d) => (
                        <Cell
                          key={d.name}
                          fill={d.fill}
                          className="stroke-background hover:opacity-80 transition-opacity"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {typeCounts.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.fill }}
                    />
                    <span className="text-muted-foreground">{t.name}</span>
                    <span className="font-semibold text-foreground">
                      {t.value}
                    </span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-card shadow-sm min-w-0">
            <CardHeader className="space-y-1">
              <CardTitle>Assets by Property Type</CardTitle>
              <CardDescription>
                Compare asset volume across each property category
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={assetsByTypeSorted}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                    barSize={24}
                  >
                    <defs>
                      <linearGradient
                        id="barGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop
                          offset="0%"
                          stopColor="hsl(191, 91%, 46%)"
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="100%"
                          stopColor="hsl(191, 91%, 46%)"
                          stopOpacity={1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="hsl(var(--border) / 0.5)"
                    />
                    <XAxis
                      type="number"
                      hide
                      stroke="hsl(var(--muted-foreground))"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 12,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      content={
                        <ChartTooltip formatter={(v: any) => [v, "Assets"]} />
                      }
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                    />
                    <Bar
                      dataKey="assets"
                      fill="url(#barGradient)"
                      radius={[0, 4, 4, 0]}
                    >
                      <LabelList
                        dataKey="assets"
                        position="right"
                        className="text-[10px] font-medium fill-foreground"
                        offset={8}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add/Edit Property Dialog */}
        <Dialog
          open={isDialogOpen && canEditPage}
          onOpenChange={setIsDialogOpen}
        >
          <DialogContent
            className={cn(
              "p-0 gap-0 overflow-hidden",
              isExpanded ? "!max-w-[90vw] !w-[90vw]" : "max-w-xl",
            )}
          >
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 bg-muted/10 px-6 py-5">
              <div className="space-y-1.5">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {editingId ? "Edit Property" : "Add New Property"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Update property details"
                    : "Create a new property for asset tracking"}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="shrink-0 rounded-full"
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-5 max-h-[70vh]">
              <div className="space-y-6">
                <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    Property Details
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="prop-id"
                        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                      >
                        Property ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="prop-id"
                        value={form.id}
                        onChange={(e) =>
                          setForm({ ...form, id: e.target.value })
                        }
                        placeholder="e.g., PROP-006"
                        disabled={Boolean(editingId)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="prop-name"
                        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                      >
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="prop-name"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="Main Office"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="prop-address"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                    >
                      Address
                    </Label>
                    <Input
                      id="prop-address"
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                      placeholder="Full address"
                    />
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Settings className="h-4 w-4 text-primary" />
                    Configuration
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Type
                      </Label>
                      <Select
                        value={form.type}
                        onValueChange={(v) => setForm({ ...form, type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Office">Office</SelectItem>
                          <SelectItem value="Storage">Storage</SelectItem>
                          <SelectItem value="Manufacturing">
                            Manufacturing
                          </SelectItem>
                          <SelectItem value="Site Office">
                            Site Office
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Status
                      </Label>
                      <Select
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="prop-manager"
                        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                      >
                        Manager
                      </Label>
                      <Input
                        id="prop-manager"
                        value={form.manager}
                        onChange={(e) =>
                          setForm({ ...form, manager: e.target.value })
                        }
                        placeholder="Manager name"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="rounded-xl gap-2">
                {editingId ? "Save Changes" : "Create Property"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <PropertyDetailSheet
        property={detailProperty}
        open={!!detailProperty}
        onClose={() => setDetailProperty(null)}
        onEdit={(p) => handleEditProperty(p.id)}
        onDelete={(p) => handleDeleteProperty(p.id)}
        role={role}
      />
    </>
  );
}
