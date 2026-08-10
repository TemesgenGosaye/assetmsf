import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { crudToast } from "@/lib/enterprise-feedback";
import { isDemoMode } from "@/lib/demo";
import {
  Calendar,
  MapPin,
  Package,
  Building2,
  ShieldCheck,
  Copy,
  ClipboardList,
  AlertTriangle,
  Edit,
  Trash2,
  History,
  PlusCircle,
  Activity,
  ArrowRightLeft,
  UserCheck,
  Wrench,
  TrendingDown,
  QrCode,
  RefreshCw,
  User,
} from "lucide-react";
import { getAssetById, deleteAsset, type Asset } from "@/services/assets";
import { fetchLifecycleEvents, type LifecycleEvent } from "@/services/assetLifecycle";
import { listProperties, type Property } from "@/services/properties";
import { listFinalApproverPropsForUser } from "@/services/finalApprover";

import { generateQrPng } from "@/lib/qr";
import DetailPage from "@/components/detail/DetailPage";

const DEP_METHOD_LABELS: Record<string, string> = {
  straight_line: "Straight Line",
  reducing_balance: "Reducing Balance",
  no_depreciation: "No Depreciation",
};

function formatMoney(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function toDateString(v: any) {
  return v ? new Date(v).toLocaleDateString() : "—";
}

const EVENT_META: Record<string, { label: string; icon: any }> = {
  created: { label: "Asset Created", icon: PlusCircle },
  updated: { label: "Details Updated", icon: Edit },
  status_changed: { label: "Status Changed", icon: RefreshCw },
  condition_changed: { label: "Condition Changed", icon: Activity },
  transferred: { label: "Transferred", icon: ArrowRightLeft },
  owner_changed: { label: "Owner Changed", icon: UserCheck },
  location_changed: { label: "Location Changed", icon: MapPin },
  disposed: { label: "Disposed", icon: Trash2 },
  retired: { label: "Retired", icon: RefreshCw },
  maintenance_scheduled: { label: "Maintenance Scheduled", icon: Wrench },
  maintenance_completed: { label: "Maintenance Completed", icon: Wrench },
  depreciation_updated: { label: "Depreciation Updated", icon: TrendingDown },
  value_updated: { label: "Value Updated", icon: TrendingDown },
  qr_generated: { label: "QR Generated", icon: QrCode },
  scanned: { label: "Scanned", icon: QrCode },
  amc_updated: { label: "AMC Updated", icon: ShieldCheck },
};

function LifecycleTimeline({ assetId }: { assetId: string }) {
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!assetId) return;
      try {
        if (!isDemoMode()) {
          const list = await fetchLifecycleEvents({ asset: assetId });
          setEvents(list || []);
        }
      } catch (e: any) {
        console.error("Failed to load lifecycle events", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [assetId]);

  if (loading) {
    return (
      <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
        <CardHeader className="py-4 border-b border-border/60">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Lifecycle Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Loading events...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
      <CardHeader className="py-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Lifecycle Timeline
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No lifecycle events recorded yet.
          </p>
        ) : (
          <ol className="relative border-l border-border/60 pl-5 space-y-4">
            {events.map((ev) => {
              const meta = EVENT_META[ev.event_type] || {
                label: (ev.event_type || "event").replace(/_/g, " "),
                icon: History,
              };
              const Icon = meta.icon;
              const oldVal = ev.old_value || null;
              const newVal = ev.new_value || null;
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[27px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background">
                    <Icon className="h-3 w-3 text-primary" />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-sm font-medium capitalize">
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.occurred_at || ev.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {ev.actor_name && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> {ev.actor_name}
                      </span>
                    )}
                    {oldVal !== null && newVal !== null && (
                      <span className="font-mono">
                        {String(oldVal)} → {String(newVal)}
                      </span>
                    )}
                  </div>
                  {ev.message && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ev.message}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default function AssetDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [propsById, setPropsById] = useState<Record<string, Property>>({});
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [approverPropIds, setApproverPropIds] = useState<Set<string>>(
    new Set(),
  );
  const confirm = useConfirm();

  const qrPayload = useMemo(() => {
    try {
      return JSON.parse(searchParams.get("payload") || "null");
    } catch {
      return null;
    }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        if (!isDemoMode()) {
          const props = await listProperties();
          setPropsById(Object.fromEntries(props.map((p) => [p.id, p])));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (isDemoMode()) {
          setApproverPropIds(new Set());
          return;
        }
        let uid = localStorage.getItem("current_user_id") || "";
        if (!uid) {
          try {
            const raw = localStorage.getItem("auth_user");
            if (raw) {
              const parsed = JSON.parse(raw) as { id?: string; email?: string };
              uid = parsed?.id || parsed?.email || "";
            }
          } catch {}
        }
        if (!uid) {
          setApproverPropIds(new Set());
          return;
        }
        const list = await listFinalApproverPropsForUser(uid);
        setApproverPropIds(new Set((list || []).map(String)));
      } catch {
        setApproverPropIds(new Set());
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        setLoading(true);
        let currentAsset: Asset | null = null;
        if (!isDemoMode()) {
          const data = await getAssetById(id);
          currentAsset = data;
        } else if (qrPayload) {
          currentAsset = {
            id: qrPayload.assetId,
            asset_code: qrPayload.assetId,
            name: qrPayload.assetName,
            type: "",
            property: qrPayload.propertyName || qrPayload.property || "",
            property_id: null,
            quantity: 1,
            purchaseDate: null,
            expiryDate: null,
            poNumber: null,
            condition: null,
            status: "",
            location: qrPayload.location || null,
          } as Asset;
        }

        setAsset(currentAsset);

        if (currentAsset) {
          try {
            const url = await generateQrPng({ assetData: currentAsset });
            setQrUrl(url);
          } catch (qrErr) {
            console.error("QR Code generation failed:", qrErr);
          }
        }
      } catch (e: any) {
        console.error(e);
        crudToast.error(e.message || "Failed to load asset");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, qrPayload]);

  const propertyLabel = (code: string | null | undefined) => {
    if (!code) return "—";
    return propsById[code]?.name || code;
  };

  const role = (() => {
    try {
      const raw = localStorage.getItem("auth_user");
      return raw ? (JSON.parse(raw).role ?? "").toLowerCase() : "";
    } catch {
      return "";
    }
  })();

  const getAssetPropertyId = (a: any): string => {
    const raw = String(a?.property_id || a?.property || "").trim();
    if (raw && propsById[raw]) return raw;
    if (raw) {
      const byName = Object.values(propsById).find(
        (p) => (p.name || "").toLowerCase() === raw.toLowerCase(),
      );
      if (byName) return String(byName.id);
    }
    return raw;
  };

  const canEditAsset = asset
    ? role === "admin" || approverPropIds.has(getAssetPropertyId(asset))
    : false;

  const handleEditAsset = () => {
    if (!asset || !canEditAsset) return;
    navigate(`/assets?edit=${encodeURIComponent(asset.id)}`);
  };

  const handleDeleteAsset = async () => {
    if (!asset || role !== "admin") return;
    const ok = await confirm({
      title: "Delete asset",
      description: `Are you sure you want to delete asset ${asset.id}? This action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    try {
      if (!isDemoMode()) {
        await deleteAsset(asset.id);
        crudToast.deleted("Asset", asset.id);
      } else {
        crudToast.info("Demo mode; deleted locally only");
      }
      navigate("/assets");
    } catch (e: any) {
      crudToast.error(e?.message || "Failed to delete asset");
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(asset!.id!);
      crudToast.info("Asset ID copied");
    } catch {
      crudToast.error("Copy failed");
    }
  };

  if (loading || !asset) {
    return (
      <DetailPage
        backTo="/assets"
        breadcrumbs={[
          { label: "SAMS", to: "/dashboard" },
          { label: "Assets", to: "/assets" },
          { label: "Asset Details" },
        ]}
        title="Asset Profile"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading asset details..."
        notFound={!loading && !asset}
        notFoundTitle="Asset Not Found"
      />
    );
  }

  return (
    <DetailPage
      backTo="/assets"
      breadcrumbs={[
          { label: "SAMS", to: "/dashboard" },
          { label: "Assets", to: "/assets" },
          { label: "Asset Details" },
        ]}
        title="Asset Profile"
        hero={{
        icon: <Package className="h-8 w-8 text-primary" />,
        name: asset.name || "Asset Details",
        subtitle: asset.type || "Unknown type",
        status: asset.status,
        badges: (
          <>
            <Badge variant="outline" className="text-[10px] font-mono">
              {asset.id}
            </Badge>
            {!isDemoMode() ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800">
                <ShieldCheck className="mr-1 h-3 w-3" /> Verified
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-amber-600 bg-amber-50 border-amber-200"
              >
                <AlertTriangle className="mr-1 h-3 w-3" /> Demo preview
              </Badge>
            )}
          </>
        ),
      }}
      sections={[
        {
          title: "Location Details",
          titleIcon: Building2,
          fields: [
            {
              icon: Building2,
              label: "Property",
              value: asset.property_id
                ? propertyLabel(asset.property_id)
                : propertyLabel(asset.property || ""),
            },
            { icon: MapPin, label: "Department", value: asset.department },
            { icon: MapPin, label: "Specific Location", value: asset.location },
          ],
        },
        {
          title: "Status & Condition",
          titleIcon: ClipboardList,
          fields: [
            {
              icon: ClipboardList,
              label: "Condition",
              value: asset.condition || "Not specified",
            },
            {
              icon: Package,
              label: "Quantity",
              value: asset.quantity != null ? asset.quantity.toString() : "—",
            },
            { icon: ClipboardList, label: "PO Number", value: asset.poNumber },
          ],
        },
      ]}
      adminActions={
        asset ? (
          <>
            {canEditAsset && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditAsset}
                className="gap-1"
              >
                <Edit className="h-4 w-4" /> Edit Asset
              </Button>
            )}
            {role === "admin" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAsset}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" /> Delete Asset
              </Button>
            )}
          </>
        ) : undefined
      }
      sidebar={
        <div className="space-y-6">
          {/* QR Code Card */}
          {qrUrl && (
            <Card className="border border-border/60 shadow-sm rounded-2xl bg-card overflow-hidden">
              <CardHeader className="py-4 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Asset QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center justify-center gap-4">
                <div className="rounded-xl border border-border/40 bg-white p-3 shadow-sm">
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="h-40 w-40 object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Scan this code to view this asset page directly or print it as
                  a label.
                </p>
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = qrUrl;
                    link.download = `QR_${asset.id}.png`;
                    link.click();
                  }}
                  className="w-full text-xs py-2 px-3 border border-border/60 rounded-xl hover:bg-muted font-medium transition-colors"
                >
                  Download QR Label
                </button>
              </CardContent>
            </Card>
          )}

          {/* System Info sidebar card */}
          <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
            <CardHeader className="py-4 border-b border-border/60">
              <CardTitle className="text-sm font-semibold">
                System Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Scanned By</span>
                <span className="font-medium">
                  {qrPayload?.scannedBy || "Unknown"}
                </span>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground text-center">
                Asset Record {asset.id}
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      {/* Asset ID copy box */}
      <Card className="border border-primary/10 bg-primary/5 rounded-2xl shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-primary/80">
              Asset ID
            </p>
            <p className="font-mono text-lg font-bold text-foreground tracking-tight">
              {asset.id}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-background/50 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/30 transition-all"
            onClick={handleCopyId}
          >
            <Copy className="h-3.5 w-3.5" /> Copy ID
          </button>
        </CardContent>
      </Card>

      {/* Important Dates */}
      <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
        <CardHeader className="py-4 border-b border-border/60">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Important Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Purchase Date</span>
            <span className="font-medium">
              {asset.purchaseDate
                ? new Date(asset.purchaseDate).toLocaleDateString()
                : "—"}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expiry Date</span>
            <span className="font-medium">
              {asset.expiryDate
                ? new Date(asset.expiryDate).toLocaleDateString()
                : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Financial Information */}
      <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
        <CardHeader className="py-4 border-b border-border/60">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Financial Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Purchase Cost</span>
            <span className="font-medium">{formatMoney(asset.purchaseCost)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Value</span>
            <span className="font-medium text-primary">
              {formatMoney(asset.currentValue)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Depreciation Method</span>
            <span className="font-medium">
              {asset.depreciationMethod
                ? DEP_METHOD_LABELS[asset.depreciationMethod] ||
                  asset.depreciationMethod.replace(/_/g, " ")
                : "—"}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vendor</span>
            <span className="font-medium">{asset.vendor || "—"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Invoice Number</span>
            <span className="font-medium">{asset.invoiceNumber || "—"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Warranty Period</span>
            <span className="font-medium">
              {toDateString(asset.warrantyStartDate)}
              {asset.warrantyStartDate && asset.warrantyExpiry ? " → " : ""}
              {toDateString(asset.warrantyExpiry)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Scan Notes */}
      {qrPayload?.notes && (
        <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
          <CardContent className="p-5">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> Scan
              Notes
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {qrPayload.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lifecycle Timeline */}
      <LifecycleTimeline assetId={asset.id} />
    </DetailPage>
  );
}
