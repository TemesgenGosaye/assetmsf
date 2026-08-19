import { useConfirm, crudToast } from "@/lib/enterprise-feedback";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isDemoMode } from "@/lib/demo";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { BulkImportModal } from "@/components/assets/BulkImportModal";
import { QRCodeGenerator } from "@/components/qr/QRCodeGenerator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PrintModal } from "@/components/common/PrintModal";
import { assetPrintHTML } from "@/lib/printUtils";
import {
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getCachedAssetsSnapshot,
  subscribeToAssetsCache,
} from "@/services/assets";
import { listProperties, type Property } from "@/services/properties";
import { listDepartments } from "@/services/departments";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import {
  listItemTypes,
  getItemTypePrefix,
  ITEM_TYPE_PREFIXES,
} from "@/services/itemTypes";
import {
  listQRCodes,
  createQRCode,
  type QRCode as SbQRCode,
} from "@/services/qrcodes";
import {
  submitApproval,
  listApprovals,
  type ApprovalRequest,
} from "@/services/approvals";
import RequestEditModal from "@/components/assets/RequestEditModal";
import TransferAssetDialog from "@/components/assets/TransferAssetDialog";
import { listFinalApproverPropsForUser } from "@/services/finalApprover";
import { logActivity } from "@/services/activity";
import { trackActivity } from "@/services/notifications";
import { getCurrentUserId, canUserEdit } from "@/services/permissions";
import { type DateRange } from "@/components/ui/date-range-picker";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useTablePreferences } from "@/components/table/useTablePreferences";
import { type ColumnDef } from "@/components/table/ColumnChooser";
import { listUserDepartmentAccess } from "@/services/userDeptAccess";
import { useSearchLoading } from "@/hooks/useDebouncedValue";
import AssetHighlightsCards from "@/components/assets/AssetHighlightsCards";
import AssetPageHeader from "@/components/assets/AssetPageHeader";
import AssetFiltersBar from "@/components/assets/AssetFiltersBar";
import BulkActionsBar from "@/components/assets/BulkActionsBar";
import AssetTable from "@/components/assets/AssetTable";
import QrExportModal from "@/components/assets/QrExportModal";
import AssetFormDialog from "@/components/assets/AssetFormDialog";
import type { ReportExportMenuProps } from "@/components/table/ReportExportMenu";

export default function Assets() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, debouncedSearch] = useSearchLoading(searchTerm, 300);
  const [filterType, setFilterType] = useState("all");
  const [assets, setAssets] = useState<any[]>(
    () => getCachedAssetsSnapshot() ?? [],
  );
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<string[]>([]);
  const [deptOptions, setDeptOptions] = useState<string[]>([]);
  const navigate = useNavigate();
  const [propsById, setPropsById] = useState<Record<string, Property>>({});
  const [propsByName, setPropsByName] = useState<Record<string, Property>>({});
  const [sortBy, setSortBy] = useState("newest");
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [deptAll, setDeptAll] = useState<boolean>(true);
  const [accessibleProps, setAccessibleProps] = useState<Set<string>>(
    new Set(),
  );
  const [role, setRole] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [approvalsByAsset, setApprovalsByAsset] = useState<
    Record<string, ApprovalRequest | undefined>
  >({});
  const [requestEditOpen, setRequestEditOpen] = useState(false);
  const [requestEditAsset, setRequestEditAsset] = useState<any | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAsset, setTransferAsset] = useState<any | null>(null);
  const [approverPropIds, setApproverPropIds] = useState<Set<string>>(
    new Set(),
  );
  const [qrImgByAssetId, setQrImgByAssetId] = useState<Record<string, string>>(
    {},
  );
  const [range, setRange] = useState<DateRange>();
  const [allowedDepts, setAllowedDepts] = useState<string[] | null>(null);
  const [filterProperty, setFilterProperty] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  // Saved views & bulk actions
  const [savedView, setSavedView] = useState<string>("all");
  const [bulkProperty, setBulkProperty] = useState<string>("");
  const [bulkCondition, setBulkCondition] = useState<string>("");

  // Bulk action scoping: restrict property assignment options for managers
  const bulkPropertyOptions = useMemo(() => {
    if (role === "admin") return propertyOptions;
    if (role === "manager") {
      // Only properties the manager can access
      if (accessibleProps && accessibleProps.size) {
        return propertyOptions.filter((pid) =>
          accessibleProps.has(String(pid)),
        );
      }
      return [] as string[];
    }
    // Users cannot assign property via bulk actions
    return [] as string[];
  }, [role, propertyOptions, accessibleProps]);

  // Ensure selected bulkProperty remains valid when options/role change
  useEffect(() => {
    if (bulkProperty && !bulkPropertyOptions.includes(bulkProperty))
      setBulkProperty("");
  }, [bulkPropertyOptions]);
  // Load final-approver property ids for current user
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
              const parsed = JSON.parse(raw) as {
                id?: string;
                email?: string;
              };
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
  const prefs = useTablePreferences("assets");
  const columnDefs: ColumnDef[] = [
    { key: "select", label: "Select", always: true },
    { key: "id", label: "Asset ID", always: true },
    { key: "name", label: "Name", always: true },
    { key: "type", label: "Item Type" },
    { key: "category", label: "Category" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "model", label: "Model" },
    { key: "serial", label: "Serial No." },
    { key: "barcode", label: "Barcode" },
    { key: "property", label: "Property" },
    { key: "department", label: "Department" },
    { key: "location", label: "Location" },
    { key: "owner", label: "Owner" },
    { key: "qty", label: "Qty" },
    { key: "purchaseDate", label: "Purchase Date" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "purchaseCost", label: "Purchase Cost" },
    { key: "currentValue", label: "Current Value" },
    { key: "salvageValue", label: "Salvage Value" },
    { key: "depreciationMethod", label: "Dep. Method" },
    { key: "usefulLifeYears", label: "Useful Life (Y)" },
    { key: "depreciationRate", label: "Dep. Rate (%)" },
    { key: "accumulatedDepreciation", label: "Accum. Dep." },
    { key: "annualDepreciation", label: "Annual Dep." },
    { key: "poNumber", label: "PO Number" },
    { key: "vendor", label: "Vendor" },
    { key: "invoiceNumber", label: "Invoice No." },
    { key: "warrantyStartDate", label: "Warranty Start" },
    { key: "warrantyExpiry", label: "Warranty Expiry" },
    { key: "warrantyProvider", label: "Warranty Provider" },
    { key: "warrantyNotes", label: "Warranty Notes" },
    { key: "amcEnabled", label: "AMC" },
    { key: "amcProvider", label: "AMC Provider" },
    { key: "amcStartDate", label: "AMC Start" },
    { key: "amcEndDate", label: "AMC End" },
    { key: "amcCost", label: "AMC Cost" },
    { key: "condition", label: "Condition" },
    { key: "approval", label: "Approval" },
    ...(role === "admin"
      ? ([{ key: "createdBy", label: "Created By" }] as ColumnDef[])
      : []),
    { key: "notes", label: "Notes" },
    { key: "description", label: "Description" },
    { key: "addedDate", label: "Created At" },
    { key: "updatedDate", label: "Updated At" },
    { key: "onAsset", label: "Age" },
    { key: "actions", label: "Actions", always: true },
  ];
  // Always-on columns set (cannot be hidden)
  const ALWAYS_COLS = useMemo(
    () => new Set(columnDefs.filter((c) => c.always).map((c) => c.key)),
    [],
  );
  const isVisible = useCallback(
    (key: string) => ALWAYS_COLS.has(key) || prefs.visibleCols.includes(key),
    [ALWAYS_COLS, prefs.visibleCols],
  );
  // initialize defaults for visible columns once
  useEffect(() => {
    // Only set defaults if nothing was loaded from storage
    if (!prefs.visibleCols.length) {
      const defaults = columnDefs.map((c) => c.key);
      // Merge with ALWAYS_COLS to be safe
      const merged = Array.from(
        new Set([...Array.from(ALWAYS_COLS), ...defaults]),
      );
      prefs.setVisibleCols(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time bootstrap: if user already has saved prefs but Department is missing, add it once
  useEffect(() => {
    try {
      const key = "assets_dept_col_added_v1";
      if (
        prefs.visibleCols.length &&
        !prefs.visibleCols.includes("department")
      ) {
        const done = sessionStorage.getItem(key);
        if (!done) {
          prefs.setVisibleCols((cols) =>
            Array.from(new Set([...cols, "department"])),
          );
          sessionStorage.setItem(key, "1");
        }
      }
    } catch {
      /* ignore */
    }
  }, [prefs.visibleCols]);

  // One-time bootstrap: surface every available column (incl. financial ones)
  // for users with older saved prefs so no input value stays hidden
  useEffect(() => {
    try {
      const key = "assets_all_cols_v4";
      const done = sessionStorage.getItem(key);
      if (done) return;
      if (!prefs.visibleCols.length) return;
      const all = columnDefs.map((c) => c.key);
      const missing = all.filter((k) => !prefs.visibleCols.includes(k));
      if (missing.length) {
        prefs.setVisibleCols((cols) =>
          Array.from(new Set([...cols, ...missing])),
        );
      }
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, [prefs.visibleCols, columnDefs]);
  const activePropertyIds = useMemo(() => {
    const list = Object.values(propsById);
    if (!list.length) return new Set<string>();
    return new Set(
      list
        .filter((p) => (p.status || "").toLowerCase() !== "disabled")
        .map((p) => p.id),
    );
  }, [propsById]);

  // Property options visible in filter, respecting access for non-admins
  const visiblePropertyOptions = useMemo(() => {
    const base = propertyOptions;
    if (role === "admin") return base;
    if (accessibleProps && accessibleProps.size) {
      return base.filter((pid) => accessibleProps.has(String(pid)));
    }
    return [] as string[];
  }, [propertyOptions, accessibleProps, role]);

  // Keep property filter valid when visible options change
  useEffect(() => {
    if (
      filterProperty !== "all" &&
      !visiblePropertyOptions.includes(filterProperty)
    ) {
      setFilterProperty("all");
    }
  }, [visiblePropertyOptions]);

  // Open Add/Edit form from query params
  useEffect(() => {
    const isNew = searchParams.get("new") === "1";
    const editId = searchParams.get("edit");

    if (isNew) {
      setSelectedAsset(null);
      setShowAddForm(true);
      return;
    }

    if (!editId || assets.length === 0) return;

    const target = assets.find((a) => String(a.id) === String(editId));
    if (!target) return;

    setSelectedAsset(target);
    setShowAddForm(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        next.delete("new");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, assets, setSearchParams]);

  // ── Single mount effect: fire all independent requests in parallel ──
  useEffect(() => {
    // Read role synchronously from localStorage (no network)
    try {
      const raw =
        (isDemoMode()
          ? sessionStorage.getItem("demo_auth_user") ||
            localStorage.getItem("demo_auth_user")
          : null) || localStorage.getItem("auth_user");
      const r = raw ? JSON.parse(raw).role || "" : "";
      setRole((r || "").toLowerCase());
    } catch {}

    if (isDemoMode()) {
      setAccessibleProps(new Set());
      return;
    }

    // Fire all independent network requests in parallel
    (async () => {
      const [accessibleIds, qrCodes, filterData, deptAccess] =
        await Promise.all([
          getAccessiblePropertyIdsForCurrentUser().catch(
            () => new Set<string>(),
          ),
          listQRCodes().catch(() => []),
          Promise.all([
            listProperties().catch(() => [] as any[]),
            listItemTypes().catch(() => [] as any[]),
            listDepartments().catch(() => [] as any[]),
          ]),
          (async () => {
            try {
              const raw = localStorage.getItem("auth_user");
              const user = raw ? JSON.parse(raw) : null;
              if (user?.id) {
                const depts = await listUserDepartmentAccess(user.id);
                return Array.isArray(depts) ? depts : [];
              }
              return null;
            } catch {
              return null;
            }
          })(),
        ]);

      setAccessibleProps(accessibleIds);

      // Build QR lookup map
      const qrMap: Record<string, string> = {};
      for (const c of qrCodes) {
        if (c.assetId && c.imageUrl) qrMap[c.assetId] = c.imageUrl;
      }
      setQrImgByAssetId(qrMap);

      // Process filter options
      const [props, types, depts] = filterData;
      if (props?.length) {
        const active = props.filter(
          (p: any) => (p.status || "").toLowerCase() !== "disabled",
        );
        setPropertyOptions(active.map((p: any) => p.id).filter(Boolean));
        setPropsById(Object.fromEntries(props.map((p: any) => [p.id, p])));
        setPropsByName(Object.fromEntries(props.map((p: any) => [p.name, p])));
      }
      setTypeOptions(Object.keys(ITEM_TYPE_PREFIXES));
      if (depts?.length) {
        const names = Array.from(
          new Set(
            (depts as any[])
              .map((d: any) => (d.name || "").toString())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));
        if (names.length) setDeptOptions(names);
      }

      // Department access
      setAllowedDepts(deptAccess);
    })();
  }, []);

  const [canEditPage, setCanEditPage] = useState<boolean>(true);
  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        if (!uid) {
          setCanEditPage(
            role === "admin" || role === "manager" || role === "user",
          );
          return;
        }
        const allowed = await canUserEdit(uid, "assets");
        // Baseline: role can create/edit; if override exists (true/false), respect it; if null, keep baseline
        const baseline =
          role === "admin" || role === "manager" || role === "user";
        setCanEditPage(allowed === null ? baseline : allowed);
      } catch {
        setCanEditPage(true);
      }
    })();
  }, [role]);

  // Simple UI loading flag
  const [loadingUI, setLoadingUI] = useState(
    () => !isDemoMode() && !getCachedAssetsSnapshot()?.length,
  );

  const fetchAssets = useCallback(async (force = false) => {
    if (isDemoMode()) return;
    try {
      const data = await listAssets(force ? { force: true } : undefined);
      setAssets(data as any);
      setLoadingUI(false);
      setLoadError(null);
    } catch (e: any) {
      toast.error("Failed to load assets");
      setLoadingUI(false);
      setLoadError(
        e?.message || "We couldn't load the asset records. Please try again.",
      );
    }
  }, []);

  // Load assets on mount using cached snapshot first, then refresh in background
  useEffect(() => {
    const cached = getCachedAssetsSnapshot();
    if (cached?.length) {
      setAssets(cached as any);
      setLoadingUI(false);
    }

    const unsubscribe = subscribeToAssetsCache((next) => {
      setAssets(next as any);
      setLoadingUI(false);
    });

    fetchAssets(Boolean(cached?.length));
    return unsubscribe;
  }, [fetchAssets]);

  // Fallback options from current assets
  useEffect(() => {
    if (!propertyOptions.length) {
      const props = Array.from(new Set(assets.map((a) => a.property))).filter(
        Boolean,
      ) as string[];
      const filtered = activePropertyIds.size
        ? props.filter((id) => activePropertyIds.has(id))
        : props;
      if (filtered.length) setPropertyOptions(filtered);
    }
    if (!typeOptions.length) {
      setTypeOptions(Object.keys(ITEM_TYPE_PREFIXES));
    }
    // derive department options from assets when not set
    if (!deptOptions.length) {
      const depts = Array.from(
        new Set(
          assets.map((a) => (a.department || "").toString()).filter(Boolean),
        ),
      );
      if (depts.length) setDeptOptions(depts);
    }
  }, [assets]);

  // Visible department options respecting allowedDepts for non-admins
  const visibleDeptOptions = useMemo(() => {
    // Departments actually present in the current assets dataset
    const inUse = Array.from(
      new Set(
        assets.map((a) => (a.department || "").toString()).filter(Boolean),
      ),
    );
    // Start from backend-provided list if any, else from in-use set
    let base = (
      deptOptions && deptOptions.length
        ? Array.from(new Set(deptOptions))
        : inUse
    )
      // Show only departments that have at least one asset
      .filter((d) => inUse.includes(d))
      .sort((a, b) => a.localeCompare(b));
    // Restrict to allowed for non-admins
    const lowerAllowed =
      role !== "admin" && Array.isArray(allowedDepts) && allowedDepts.length
        ? new Set(allowedDepts.map((d) => d.toLowerCase()))
        : null;
    base = lowerAllowed
      ? base.filter((d) => lowerAllowed.has(d.toLowerCase()))
      : base;
    return base;
  }, [deptOptions, allowedDepts, role, assets]);

  // Keep "All" selected by default and sync when options change
  useEffect(() => {
    if (deptAll) {
      // ensure all visible options are selected
      if (visibleDeptOptions.length) {
        const allSelected =
          deptFilter.length === visibleDeptOptions.length &&
          visibleDeptOptions.every((d) => deptFilter.includes(d));
        if (!allSelected) setDeptFilter(visibleDeptOptions);
      } else if (deptFilter.length) {
        setDeptFilter([]);
      }
    } else if (deptFilter.length) {
      // prune selections that no longer exist
      const pruned = deptFilter.filter((d) => visibleDeptOptions.includes(d));
      if (pruned.length !== deptFilter.length) setDeptFilter(pruned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDeptOptions, deptAll]);

  // Load pending approvals per asset for indicator
  useEffect(() => {
    (async () => {
      try {
        const list = await listApprovals();
        const pending = list
          .filter(
            (a) =>
              a.status === "pending_manager" || a.status === "pending_admin",
          )
          .sort(
            (a, b) =>
              new Date(b.requestedAt).getTime() -
              new Date(a.requestedAt).getTime(),
          );
        const map: Record<string, ApprovalRequest> = {} as any;
        for (const a of pending) {
          if (!map[a.assetId]) map[a.assetId] = a;
        }
        setApprovalsByAsset(map);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Asset scope for stats: restrict to accessible properties for non-admins
  const scopedAssets = useMemo(() => {
    const isAdmin = (role || "").toLowerCase() === "admin";
    if (isAdmin) return assets;
    if (accessibleProps && accessibleProps.size) {
      return assets.filter((a) =>
        accessibleProps.has(
          String((a as any).property_id || (a as any).property),
        ),
      );
    }
    return assets;
  }, [assets, accessibleProps, role]);

  // Stats source: apply selected Property filter to the scoped assets so cards reflect chosen properties
  const statsAssets = useMemo(() => {
    if (!scopedAssets.length) return scopedAssets;
    if (filterProperty === "all") return scopedAssets;
    const needle = String(filterProperty || "").toLowerCase();
    return scopedAssets.filter((a: any) => {
      const pid = String(a?.property_id || a?.property || "").toLowerCase();
      return pid === needle;
    });
  }, [scopedAssets, filterProperty]);

  // Apply filters to assets and sort for display (memoized to avoid recomputing on every render)
  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        // hide assets tied to disabled properties if we know properties
        if (
          activePropertyIds.size &&
          asset.property_id != null &&
          !activePropertyIds.has(String(asset.property_id))
        )
          return false;
        // enforce user access if any set exists (skip in demo to keep sample data visible)
        if (
          !isDemoMode() &&
          accessibleProps.size &&
          !accessibleProps.has(String(asset.property_id || asset.property))
        )
          return false;
        const matchesSearch =
          asset.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          asset.id.toLowerCase().includes(debouncedSearch.toLowerCase());
        const matchesType =
          filterType === "all" ||
          (asset.type || "").toLowerCase() === filterType.toLowerCase();
        const matchesProperty =
          filterProperty === "all" ||
          (asset.property_id || "").toLowerCase() ===
            filterProperty.toLowerCase();
        // Department multi-select filter
        const matchesDepartment =
          deptAll ||
          deptFilter
            .map((d) => d.toLowerCase())
            .includes((asset.department || "").toString().toLowerCase());
        // Date range filter: use purchaseDate when available, else fallback to created_at
        let matchesDate = true;
        if (range?.from) {
          const toStartOfDay = (d: Date) =>
            new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const toEndOfDay = (d: Date) =>
            new Date(
              d.getFullYear(),
              d.getMonth(),
              d.getDate(),
              23,
              59,
              59,
              999,
            );
          const start = toStartOfDay(range.from);
          const end = toEndOfDay(range.to ?? range.from);
          const dateStr: string | undefined =
            (asset.purchaseDate as any) || (asset.created_at as any);
          if (dateStr) {
            const t = new Date(dateStr).getTime();
            matchesDate = t >= start.getTime() && t <= end.getTime();
          } else {
            matchesDate = false;
          }
        }
        // Saved views filter
        let matchesSaved = true;
        if (savedView === "expiring-30" || savedView === "expiring-90") {
          const days = savedView === "expiring-30" ? 30 : 90;
          if (asset.expiryDate) {
            const now = new Date();
            const limit = new Date();
            limit.setDate(limit.getDate() + days);
            const exp = new Date(asset.expiryDate);
            matchesSaved = exp >= now && exp <= limit;
          } else {
            matchesSaved = false;
          }
        } else if (savedView === "needing-audit") {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const pd = asset.purchaseDate ? new Date(asset.purchaseDate) : null;
          matchesSaved = !!(
            pd &&
            pd < oneYearAgo &&
            String(asset.status || "")
              .toLowerCase()
              .includes("active")
          );
        }

        return (
          matchesSearch &&
          matchesType &&
          matchesProperty &&
          matchesDepartment &&
          matchesDate &&
          matchesSaved
        );
      }),
    [
      assets,
      activePropertyIds,
      accessibleProps,
      debouncedSearch,
      filterType,
      filterProperty,
      deptAll,
      deptFilter,
      range,
      savedView,
    ],
  );

  const sortedAssets = useMemo(
    () =>
      [...filteredAssets].sort((a, b) => {
        // Local natural ID comparator to avoid dependency ordering issues
        const localCompareById = (x: any, y: any) => {
          const parse = (
            id: string,
          ): { prefix: string; num: number } | null => {
            const m = String(id).match(/^(.*?)(\d+)$/);
            if (!m) return null;
            return { prefix: m[1], num: Number(m[2]) };
          };
          const pa = parse(String(x.id));
          const pb = parse(String(y.id));
          if (pa && pb) {
            const prefCmp = pa.prefix.localeCompare(pb.prefix);
            if (prefCmp !== 0) return prefCmp;
            return pa.num - pb.num;
          }
          return String(x.id).localeCompare(String(y.id));
        };
        switch (sortBy) {
          case "id-asc":
            return localCompareById(a, b);
          case "id-desc":
            return -localCompareById(a, b);
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          case "qty":
            return 0;
          case "department": {
            const da = (a.department || "").toString();
            const db = (b.department || "").toString();
            const cmp = da.localeCompare(db);
            return cmp !== 0 ? cmp : localCompareById(a, b);
          }
          case "newest":
          default: {
            const at = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
            const dt = bt - at;
            if (dt !== 0) return dt;
            // tie-break by natural id to keep units close when created_at is equal/empty
            return localCompareById(a, b);
          }
        }
      }),
    [filteredAssets, sortBy],
  );

  const paginatedRows = useMemo(() => {
    return sortedAssets.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage,
    );
  }, [sortedAssets, currentPage, rowsPerPage]);

  const assetExportColumns = useMemo(() => {
    return columnDefs
      .filter((c) => c.key !== "select" && c.key !== "actions" && isVisible(c.key))
      .map((c) => ({
        header: c.label,
        key: c.key,
      }));
  }, [columnDefs, isVisible]);

  const getAssetRowValues = useCallback((asset: any) => {
    return assetExportColumns.map((col) => {
      switch (col.key) {
        case "id": return asset.id || "";
        case "name": return asset.name || "";
        case "type": return asset.type || "";
        case "category": return asset.category_name || asset.category || "";
        case "manufacturer": return asset.manufacturer || "";
        case "model": return asset.model || "";
        case "serial": return asset.serialNumber || "";
        case "barcode": return asset.barcode || "";
        case "property": return propsById[asset.property]?.name || propsByName[asset.property]?.name || asset.property || "";
        case "department": return asset.department || "";
        case "location": return asset.location || "";
        case "owner": return asset.owner_name || asset.owner || "";
        case "qty": return 0;
        case "purchaseDate": return asset.purchaseDate || "";
        case "expiryDate": return asset.expiryDate || "";
        case "purchaseCost": return asset.purchaseCost ?? "";
        case "currentValue": return asset.currentValue ?? "";
        case "salvageValue": return asset.salvageValue ?? "";
        case "depreciationMethod": return asset.depreciationMethod || "";
        case "usefulLifeYears": return asset.usefulLifeYears ?? "";
        case "depreciationRate": return asset.depreciationRate ?? "";
        case "accumulatedDepreciation": return asset.accumulatedDepreciation ?? "";
        case "annualDepreciation": return asset.annual_depreciation_value ?? "";
        case "poNumber": return asset.poNumber || "";
        case "vendor": return asset.vendor || "";
        case "invoiceNumber": return asset.invoiceNumber || "";
        case "warrantyStartDate": return asset.warrantyStartDate || "";
        case "warrantyExpiry": return asset.warrantyExpiry || "";
        case "warrantyProvider": return asset.warrantyProvider || "";
        case "warrantyNotes": return asset.warrantyNotes || "";
        case "amcEnabled": return asset.amcEnabled ? "Yes" : "No";
        case "amcProvider": return asset.amcProvider || "";
        case "amcStartDate": return asset.amcStartDate || "";
        case "amcEndDate": return asset.amcEndDate || "";
        case "amcCost": return asset.amcCost ?? "";
        case "condition": return asset.condition || "";
        case "status": return asset.status || "";
        case "createdBy": return asset.createdByName || asset.created_by || "";
        case "notes": return asset.notes || "";
        case "description": return asset.description || "";
        case "addedDate": return asset.created_at || "";
        case "updatedDate": return asset.updated_at || "";
        default: return (asset as any)[col.key] ?? "";
      }
    });
  }, [assetExportColumns, propsById, propsByName]);

  const assetExportProps: ReportExportMenuProps = useMemo(() => ({
    title: "Asset Catalogue Report",
    fileName: "asset_catalogue",
    columns: assetExportColumns,
    getRows: () => sortedAssets.map(getAssetRowValues),
    getSelectedRows: selectedIds.size > 0 ? () => sortedAssets.filter(a => selectedIds.has(a.id)).map(getAssetRowValues) : undefined,
    totalCount: sortedAssets.length,
    selectedCount: selectedIds.size,
    filters: [
      debouncedSearch ? `Search: "${debouncedSearch}"` : "",
      filterType !== "all" ? `Type: ${filterType}` : "",
      filterProperty !== "all" ? `Property: ${filterProperty}` : "",
      !deptAll && deptFilter.length ? `Departments: ${deptFilter.join(", ")}` : "",
      savedView !== "all" ? `View: ${savedView}` : "",
    ].filter(Boolean).join(", ") || undefined,
  }), [assetExportColumns, sortedAssets, selectedIds, getAssetRowValues, debouncedSearch, filterType, filterProperty, deptAll, deptFilter, savedView]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortedAssets.length]);

  // Helpers for ID generation and display
  const typePrefix = (t: string) => {
    return getItemTypePrefix(t);
  };

  const nextSequence = (existing: any[], prefix: string) => {
    const seqs = existing
      .map((a) => a.id)
      .filter((id: string) => typeof id === "string" && id.startsWith(prefix))
      .map((id: string) => Number(id.slice(prefix.length)) || 0);
    const max = seqs.length ? Math.max(...seqs) : 0;
    return max + 1;
  };

  const toISODate = (value: any): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  };

  const handleAddAsset = async (assetData: any): Promise<boolean> => {
    const canCreate = canEditPage;
    if (!canCreate) {
      toast.error("You don't have permission to create assets");
      return false;
    }
    // Department enforcement: if user has an allowed department list (from mapping), selected must be in list (non-admin)
    try {
      const raw =
        (isDemoMode()
          ? sessionStorage.getItem("demo_auth_user") ||
            localStorage.getItem("demo_auth_user")
          : null) || localStorage.getItem("auth_user");
      const user = raw ? JSON.parse(raw) : null;
      const role = (user?.role || "").toLowerCase();
      const effectiveAllowed =
        allowedDepts && allowedDepts.length
          ? allowedDepts
          : user?.department
            ? [user.department]
            : [];
      if (
        role !== "admin" &&
        Array.isArray(effectiveAllowed) &&
        effectiveAllowed.length > 0
      ) {
        const sel = (assetData.department || user?.department || "")
          .toString()
          .toLowerCase();
        const ok = effectiveAllowed.map((d) => d.toLowerCase()).includes(sel);
        if (!ok) {
          toast.error(
            "You are not allowed to create assets for this department",
          );
          return false;
        }
      }
    } catch {}
    try {
      // Reuse the already-cached asset list for sequence derivation so we don't
      // re-fetch all assets from the server (which is very slow on cold backends).
      const cachedAssets: any[] | null = assets;
      const amcEnabled = Boolean(assetData.amcEnabled);
      const amcStartDate = amcEnabled ? toISODate(assetData.amcStartDate) : null;
      const amcEndDate = amcEnabled ? toISODate(assetData.amcEndDate) : null;

      if (!isDemoMode()) {
        const propertyCodeRaw = assetData.property;
        const seqPrefix = `${typePrefix(assetData.itemType)}0-0-00-`;
        const quantity = 1;
        const baseSeq = nextSequence(
          cachedAssets && cachedAssets.length ? cachedAssets : assets,
          seqPrefix,
        );

        if (selectedAsset) {
          await updateAsset(selectedAsset.id, {
            name: assetData.itemName,
            type: assetData.itemType,
            subcategory: assetData.subcategory || null,
            manufacturer: assetData.manufacturer || null,
            model: assetData.model || null,
            barcode: assetData.barcode || null,
            rfid: assetData.rfid || null,
            department: assetData.department,
            purchaseDate: toISODate(assetData.purchaseDate),
            expiryDate: toISODate(assetData.expiryDate),
            poNumber: assetData.poNumber || null,
            purchaseCost: assetData.purchaseCost || null,
            vendor: assetData.vendor || null,
            invoiceNumber: assetData.invoiceNumber || null,
            warrantyStartDate: toISODate(assetData.warrantyStartDate),
            warrantyExpiry: toISODate(assetData.warrantyExpiry),
            warrantyProvider: assetData.warrantyProvider || null,
            warrantyNotes: assetData.warrantyNotes || null,
            depreciationMethod:
              assetData.depreciationMethod || "straight_line",
            usefulLifeYears: assetData.usefulLifeYears || null,
            salvageValue: assetData.salvageValue || null,
            currentValue: assetData.currentValue || null,
            depreciationRate: assetData.depreciationRate || null,
            accumulatedDepreciation:
              assetData.accumulatedDepreciation ?? 0,
            condition: assetData.condition || null,
            status: selectedAsset.status || "active",
            location: assetData.location || null,
            description: assetData.description || null,
            notes: assetData.notes || null,
            serialNumber: assetData.serialNumber || null,
            amcEnabled,
            amcProvider: assetData.amcProvider || null,
            amcStartDate,
            amcEndDate,
            amcCost: assetData.amcCost || null,
          } as any);
          logActivity(
            "asset_updated",
            `Asset ${selectedAsset.id} (${assetData.itemName}) updated`,
          ).catch(() => {});
          trackActivity("asset", "update", {
            entityName: assetData.itemName,
            entityId: selectedAsset.id,
          }).catch(() => {});
          crudToast.updated("Asset", selectedAsset.id);
        } else {
          // Create new assets — fire all requests in parallel so the save is
          // as fast as the slowest single request, not quantity x round-trips.
          const makeAsset = (seq: number) =>
            ({
              asset_code: `${seqPrefix}${String(seq).padStart(3, "0")}`,
              name: assetData.itemName || assetData.description || "Asset",
              type: assetData.itemType,
              item_type_name: assetData.itemTypeName || assetData.itemType,
              subcategory: assetData.subcategory || null,
              manufacturer: assetData.manufacturer || null,
              model: assetData.model || null,
              barcode: assetData.barcode || null,
              rfid: assetData.rfid || null,
              property_id: propertyCodeRaw,
              department: assetData.department,
              quantity: 1,
              purchaseDate: toISODate(assetData.purchaseDate),
              expiryDate: toISODate(assetData.expiryDate),
              poNumber: assetData.poNumber || null,
              purchaseCost: assetData.purchaseCost || null,
              vendor: assetData.vendor || null,
              invoiceNumber: assetData.invoiceNumber || null,
              warrantyStartDate: toISODate(assetData.warrantyStartDate),
              warrantyExpiry: toISODate(assetData.warrantyExpiry),
              warrantyProvider: assetData.warrantyProvider || null,
              warrantyNotes: assetData.warrantyNotes || null,
              depreciationMethod:
                assetData.depreciationMethod || "straight_line",
              usefulLifeYears: assetData.usefulLifeYears || null,
              salvageValue: assetData.salvageValue || null,
              currentValue: assetData.currentValue || null,
              depreciationRate: assetData.depreciationRate || null,
              accumulatedDepreciation:
                assetData.accumulatedDepreciation ?? 0,
              condition: assetData.condition || null,
              status: "active",
              location: assetData.location || null,
              description: assetData.description || null,
              notes: assetData.notes || null,
              serialNumber: assetData.serialNumber || null,
              amcEnabled,
              amcProvider: assetData.amcProvider || null,
              amcStartDate,
              amcEndDate,
              amcCost: assetData.amcCost || null,
            } as any);
          const created = await createAsset(makeAsset(baseSeq));
          const newAssetId = created?.id ?? null;
          logActivity("asset_created", `Asset ${newAssetId} created`).catch(() => {});
          trackActivity("asset", "create", { entityName: assetData.itemName }).catch(() => {});
          if (newAssetId) {
            toast.success(`Asset ${newAssetId} created`);
            navigate(`/assets/${newAssetId}`);
          }
        }
        // Refresh in the background — never block the success feedback or the
        // dialog close on a full list fetch (the cache subscription already
        // keeps the table in sync once the refresh resolves).
        listAssets({ force: true }).catch(() => {});
      }
      setShowAddForm(false);
      setSelectedAsset(null);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("edit");
          next.delete("new");
          return next;
        },
        { replace: true },
      );
      return true;
    } catch (e: any) {
      toast.error(e.message || "Failed to save asset");
      return false;
    }
  };

  const initialFormData = useMemo(
    () =>
      selectedAsset
        ? {
            itemName: selectedAsset.name ?? "",
            itemType: selectedAsset.type ?? "",
            subcategory: selectedAsset.subcategory ?? "",
            manufacturer: selectedAsset.manufacturer ?? "",
            model: selectedAsset.model ?? "",
            barcode: selectedAsset.barcode ?? "",
            rfid: selectedAsset.rfid ?? "",
            property: selectedAsset.property_id ?? selectedAsset.property ?? "",
            department: selectedAsset.department ?? "",
            purchaseDate: selectedAsset.purchaseDate
              ? new Date(selectedAsset.purchaseDate)
              : undefined,
            expiryDate: selectedAsset.expiryDate
              ? new Date(selectedAsset.expiryDate)
              : undefined,
            poNumber: selectedAsset.poNumber ?? "",
            condition: selectedAsset.condition ?? "",
            location: selectedAsset.location ?? "",
            description: selectedAsset.description ?? "",
            notes: selectedAsset.notes ?? "",
            serialNumber: selectedAsset.serialNumber ?? "",
            amcEnabled: Boolean(selectedAsset.amcEnabled),
            amcProvider: selectedAsset.amcProvider ?? "",
            amcStartDate: selectedAsset.amcStartDate
              ? new Date(selectedAsset.amcStartDate)
              : undefined,
            amcEndDate: selectedAsset.amcEndDate
              ? new Date(selectedAsset.amcEndDate)
              : undefined,
            amcCost: selectedAsset.amcCost ?? "",
            purchaseCost: selectedAsset.purchaseCost ?? "",
            currentValue: selectedAsset.currentValue ?? "",
            depreciationMethod:
              selectedAsset.depreciationMethod || "straight_line",
            depreciationRate: selectedAsset.depreciationRate ?? "",
            accumulatedDepreciation:
              selectedAsset.accumulatedDepreciation ?? "",
            usefulLifeYears: selectedAsset.usefulLifeYears ?? "",
            salvageValue: selectedAsset.salvageValue ?? "",
            vendor: selectedAsset.vendor ?? "",
            invoiceNumber: selectedAsset.invoiceNumber ?? "",
            warrantyProvider: selectedAsset.warrantyProvider ?? "",
            warrantyNotes: selectedAsset.warrantyNotes ?? "",
            warrantyStartDate: selectedAsset.warrantyStartDate
              ? new Date(selectedAsset.warrantyStartDate)
              : undefined,
            warrantyExpiry: selectedAsset.warrantyExpiry
              ? new Date(selectedAsset.warrantyExpiry)
              : undefined,
          }
        : undefined,
    [selectedAsset],
  );

  if (loadingUI && !isDemoMode() && assets.length === 0) {
    return <PageSkeleton />;
  }

  // Resolve property id for an asset (supports demo where only name is present)
  const getAssetPropertyId = (a: any): string => {
    const pid = a?.property_id ? String(a.property_id) : "";
    if (pid) return pid;
    const name = String(a?.property || "");
    const by = propsByName[name];
    return by?.id ? String(by.id) : name;
  };

  const handleEditAsset = (asset: any) => {
    const pid = getAssetPropertyId(asset);
    const canApproverEdit = approverPropIds.has(pid);
    if (!(role === "admin" || canApproverEdit)) return;
    setSelectedAsset(asset);
    setShowAddForm(true);
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (role !== "admin") return; // only admin can delete
    const ok = await confirm({
      title: "Delete Asset Record",
      description: `Are you sure you want to delete asset ${assetId}? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete Asset",
    });
    if (!ok) return;
    try {
      if (!isDemoMode()) {
        await deleteAsset(assetId);
        const data = await listAssets({ force: true });
        setAssets(data as any);
        crudToast.deleted("Asset", `Asset ${assetId} has been removed.`);
        await logActivity("asset_deleted", `Asset ${assetId} deleted`);
        trackActivity("asset", "delete", { entityId: assetId }).catch(() => {});
      } else {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        crudToast.info("Demo Mode", `Asset ${assetId} deleted locally in demo mode.`);
        await logActivity(
          "asset_deleted",
          `Asset ${assetId} deleted (demo)`,
          "Demo",
        );
      }
    } catch (e: any) {
      crudToast.failed("delete asset", e.message);
    }
  };

  const handleDeleteGroup = async (assetsToDelete: any[]) => {
    if (role !== "admin") return;
    const count = assetsToDelete.length;
    const ok = await confirm({
      title: `Delete ${count} Assets`,
      description: `Are you sure you want to permanently delete ${count} selected assets? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: `Delete ${count} Assets`,
      requireText: count > 3 ? "DELETE" : undefined,
    });
    if (!ok) return;

    try {
      if (!isDemoMode()) {
        await Promise.all(assetsToDelete.map((a) => deleteAsset(a.id)));
        const data = await listAssets({ force: true });
        setAssets(data as any);
        crudToast.deleted("Assets", `${count} asset records removed.`);
        await logActivity("asset_deleted", `${count} assets deleted`);
        trackActivity("asset", "delete", {
          entityName: `${count} assets`,
        }).catch(() => {});
      } else {
        const ids = new Set(assetsToDelete.map((a) => a.id));
        setAssets((prev) => prev.filter((a) => !ids.has(a.id)));
        crudToast.info("Demo Mode", `${count} assets deleted locally in demo mode.`);
        await logActivity(
          "asset_deleted",
          `${count} assets deleted (demo)`,
          "Demo",
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to delete assets");
    }
  };

  const handleGenerateQR = (asset: any) => {
    setSelectedAsset(asset);
    setShowQRGenerator(true);
  };

  const handlePrintAsset = (asset: any) => {
    // Generate printable HTML for the selected asset and open modal
    const html = assetPrintHTML(asset);
    setPrintHtml(html);
    setPrintOpen(true);
  };

  // ── Bulk action handlers (property assign / condition / export / delete) ──
  const handleBulkAssignProperty = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !bulkProperty) return;
    // Enforce access guard for managers on the Apply action as well
    if (role === "manager" && !bulkPropertyOptions.includes(bulkProperty)) {
      toast.error("You do not have access to assign to this property");
      return;
    }
    try {
      await Promise.all(
        ids.map(async (id) => {
          try {
            await updateAsset(id, {
              property: bulkProperty,
              property_id: bulkProperty,
            } as any);
          } catch {
            setAssets((prev) =>
              prev.map((a) =>
                a.id === id
                  ? {
                      ...a,
                      property: bulkProperty,
                      property_id: bulkProperty,
                    }
                  : a,
              ),
            );
          }
        }),
      );
      toast.success("Property assigned");
      await trackActivity("asset", "update", {
        entityName: `Bulk property assign`,
        entityId: ids.join(","),
        changes: [`assigned to ${bulkProperty}`],
      });
    } catch {
      toast.error("Failed to assign property");
    }
  };

  const handleBulkUpdateCondition = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !bulkCondition) return;
    try {
      await Promise.all(
        ids.map(async (id) => {
          try {
            await updateAsset(id, {
              condition: bulkCondition,
            } as any);
          } catch {
            setAssets((prev) =>
              prev.map((a) =>
                a.id === id ? { ...a, condition: bulkCondition } : a,
              ),
            );
          }
        }),
      );
      toast.success("Condition updated");
      await trackActivity("asset", "update", {
        entityName: `Bulk condition update`,
        entityId: ids.join(","),
        changes: [`condition set to ${bulkCondition}`],
      });
    } catch {
      toast.error("Failed to update condition");
    }
  };

  const handleExportSelectedCsv = () => {
    const ids = new Set(selectedIds);
    const rows = sortedAssets
      .filter((a) => ids.has(a.id))
      .map((a) => {
        const base = {
          id: a.id,
          name: a.name,
          type: a.type,
          property: propsById[a.property]?.name || a.property,
          department: a.department || "",
          serialNumber: a.serialNumber || "",
          condition: a.condition || "",
          status: a.status,
          purchaseDate: a.purchaseDate || "",
          purchaseCost: a.purchaseCost ?? "",
          currentValue: a.currentValue ?? "",
          depreciationMethod: a.depreciationMethod || "",
          vendor: a.vendor || "",
          invoiceNumber: a.invoiceNumber || "",
          warrantyStartDate: a.warrantyStartDate || "",
          warrantyEndDate: a.warrantyExpiry || "",
          expiryDate: a.expiryDate || "",
          location: a.location || "",
          description: (a.description || "")
            .toString()
            .replace(/\n/g, " "),
        } as Record<string, string | number>;
        if (role === "admin") {
          base["createdBy"] = (a.createdByName ||
            a.createdByEmail ||
            a.createdById ||
            "") as string;
        }
        return base;
      });
    if (!rows.length) {
      toast.info("Nothing selected");
      return;
    }
    const cols = Object.keys(rows[0]);
    const header = cols.join(",");
    const lines = rows.map((r) =>
      cols
        .map((c) => {
          const v = (r[c as keyof typeof r] ?? "")
            .toString()
            .replace(/"/g, '""');
          return /[",\n]/.test(v) ? `"${v}"` : v;
        })
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assets_selection_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteSelected = async () => {
    const targets = sortedAssets.filter((a) => selectedIds.has(a.id));
    await handleDeleteGroup(targets);
    setSelectedIds(new Set());
  };

  // ── Selection handlers ──
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(sortedAssets.map((a) => a.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectGroup = (members: any[], checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      for (const m of members) next.add(m.id);
    } else {
      for (const m of members) next.delete(m.id);
    }
    setSelectedIds(next);
  };

  const handleSelectAsset = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleDeptToggleAll = (on: boolean) => {
    setDeptAll(on);
    if (on) {
      setDeptFilter(visibleDeptOptions);
    } else {
      setDeptFilter([]);
    }
  };

  const handleDeptToggle = (d: string, checked: boolean) => {
    setDeptAll(false);
    setDeptFilter((prev) => {
      const set = new Set(prev);
      if (checked) set.add(d);
      else set.delete(d);
      return Array.from(set);
    });
  };

  // ── Dialog helpers ──
  const clearAddParams = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        next.delete("new");
        return next;
      },
      { replace: true },
    );
  };

  const handleFormClose = (open: boolean) => {
    if (!open) {
      // Just close the dialog — save success (toast, navigation, refresh)
      // is already handled inside handleAddAsset.
      setShowAddForm(false);
      setSelectedAsset(null);
      clearAddParams();
    }
  };

  const handleFormCancel = () => {
    setShowAddForm(false);
    setSelectedAsset(null);
    clearAddParams();
  };

  const handleOpenBulkImport = () => {
    setShowAddForm(false);
    setSelectedAsset(null);
    clearAddParams();
    setShowBulkImport(true);
  };

  const toggleExpandedGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-8 pb-10">
      <Dialog open={showQRGenerator} onOpenChange={setShowQRGenerator}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Generate QR Code</DialogTitle>
            <DialogDescription>
              Generate a QR code for {selectedAsset?.name} ({selectedAsset?.id})
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <QRCodeGenerator
              asset={selectedAsset}
              onGenerated={(qrCodeUrl) => {
                toast.success("QR Code generated");
                // Persist QR code record and log activity
                (async () => {
                  try {
                    const id = `QR-${Math.floor(Math.random() * 900 + 100)}`;
                    const payload: SbQRCode = {
                      id,
                      assetId: selectedAsset.id,
                      property: selectedAsset.property,
                      generatedDate: new Date().toISOString().slice(0, 10),
                      status: "Generated",
                      printed: false,
                      imageUrl: qrCodeUrl,
                    } as any;
                    await createQRCode(payload);
                    await logActivity(
                      "qr_generated",
                      `QR generated for ${selectedAsset.name} (${selectedAsset.id})`,
                    );
                  } catch {
                    // best effort
                  }
                })();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Header with breadcrumbs */}
      <Breadcrumbs
        items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Assets" }]}
      />

      <AssetPageHeader
        columns={columnDefs}
        visibleCols={prefs.visibleCols}
        onVisibleColsChange={prefs.setVisibleCols}
        canAdd={role === "admin" || role === "manager" || role === "user"}
        onAddClick={() => setShowAddForm(true)}
        exportProps={assetExportProps}
      />

      <AssetHighlightsCards assets={statsAssets} />

      <AssetFiltersBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchLoading={searchLoading}
        typeOptions={typeOptions}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        visiblePropertyOptions={visiblePropertyOptions}
        filterProperty={filterProperty}
        onFilterPropertyChange={setFilterProperty}
        deptAll={deptAll}
        deptFilter={deptFilter}
        visibleDeptOptions={visibleDeptOptions}
        onDeptToggleAll={handleDeptToggleAll}
        onDeptToggle={handleDeptToggle}
        sortBy={sortBy}
        onSortChange={setSortBy}
        range={range}
        onRangeChange={setRange}
        savedView={savedView}
        onSavedViewChange={setSavedView}
      />

      {/* Bulk actions bar (visible when any selected) */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          role={role}
          bulkPropertyOptions={bulkPropertyOptions}
          propsById={propsById}
          bulkProperty={bulkProperty}
          onBulkPropertyChange={setBulkProperty}
          bulkCondition={bulkCondition}
          onBulkConditionChange={setBulkCondition}
          onApplyProperty={handleBulkAssignProperty}
          onApplyCondition={handleBulkUpdateCondition}
          onExportSelected={handleExportSelectedCsv}
          onExportQrSheet={() => setExportOpen(true)}
          onDeleteSelected={handleDeleteSelected}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Assets Table */}
      <AssetTable
        dense={prefs.dense}
        isVisible={isVisible}
        searchLoading={searchLoading}
        rows={paginatedRows}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectAsset={handleSelectAsset}
        approvalsByAsset={approvalsByAsset}
        role={role}
        approverPropIds={approverPropIds}
        propsById={propsById}
        propsByName={propsByName}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onOpenAsset={(id) => navigate(`/assets/${id}`)}
        onEdit={handleEditAsset}
        onQR={handleGenerateQR}
        onTransfer={(asset) => {
          setTransferAsset(asset);
          setTransferOpen(true);
        }}
        onPrint={handlePrintAsset}
        onRequestEdit={(asset) => {
          setRequestEditAsset(asset as any);
          setRequestEditOpen(true);
        }}
        onDelete={handleDeleteAsset}
        error={loadError}
        onRetry={() => fetchAssets(true)}
        totalItems={sortedAssets.length}
        currentPage={currentPage}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
      />

      <QrExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        assets={assets}
        selectedIds={selectedIds}
      />

      <AssetFormDialog
        open={showAddForm}
        onOpenChange={handleFormClose}
        selectedAsset={selectedAsset}
        initialData={initialFormData}
        onSubmit={handleAddAsset}
        onCancel={handleFormCancel}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        onBulkImport={handleOpenBulkImport}
      />

      <BulkImportModal
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        onSuccess={() => {
          fetchAssets();
        }}
        propertyCount={propertyOptions.length}
      />

      <RequestEditModal
        open={requestEditOpen}
        asset={requestEditAsset}
        onClose={() => setRequestEditOpen(false)}
        onSubmitted={async ({ patch, notes }) => {
          try {
            const raw = localStorage.getItem("auth_user");
            let me = "user";
            try {
              const u = raw ? JSON.parse(raw) : null;
              me = u?.email || u?.id || "user";
            } catch {}
            if (!requestEditAsset) {
              toast.error("No asset selected");
              return;
            }
            await submitApproval({
              assetId: requestEditAsset.id,
              action: "edit",
              requestedBy: me,
              notes,
              patch,
            });
            toast.success("Edit request submitted for manager approval");
            await trackActivity("asset", "update", {
              entityName: requestEditAsset.id,
              entityId: requestEditAsset.id,
              changes: ["edit request submitted"],
            });
            setRequestEditOpen(false);
            // refresh approval indicators
            try {
              let dept: string | undefined;
              try {
                const au = raw ? JSON.parse(raw) : null;
                dept = au?.department || undefined;
              } catch {}
              const list = await listApprovals(undefined, dept || undefined);
              const pending = list
                .filter(
                  (a) =>
                    a.status === "pending_manager" ||
                    a.status === "pending_admin",
                )
                .sort(
                  (a, b) =>
                    new Date(b.requestedAt).getTime() -
                    new Date(a.requestedAt).getTime(),
                );
              const map: Record<string, ApprovalRequest> = {} as any;
              for (const a of pending) {
                if (!map[a.assetId]) map[a.assetId] = a;
              }
              setApprovalsByAsset(map);
            } catch {}
          } catch (e: any) {
            toast.error(e?.message || "Failed to submit edit request");
          }
        }}
      />

      <TransferAssetDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        asset={transferAsset}
        onTransferCreated={async () => {
          const data = await listAssets({ force: true });
          setAssets(data as any);
        }}
      />

      <PrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Print Asset Label"
      >
        <div dangerouslySetInnerHTML={{ __html: printHtml }} />
      </PrintModal>
    </div>
  );
}
