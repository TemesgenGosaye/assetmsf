import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  CalendarIcon,
  Package,
  Save,
  ClipboardList,
  MapPin,
  Info,
  AlertTriangle,
  DollarSign,
  Loader2,
} from "lucide-react";
import { isDemoMode } from "@/lib/demo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { listProperties, type Property } from "@/services/properties";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { ASSET_GROUPS, GROUP_BY_CODE, type AssetGroup, type AssetItem } from "@/services/assetMaster";
import { listDepartments, type Department } from "@/services/departments";
import { ItemGroupSelector } from "@/components/assets/ItemGroupSelector";
import { listUserDepartmentAccess } from "@/services/userDeptAccess";

import { Checkbox } from "@/components/ui/checkbox";

interface AssetFormProps {
  onSubmit?: (data: any) => boolean | void | Promise<boolean> | void;
  initialData?: any;
  mode?: "page" | "modal";
  onCancel?: () => void;
  showAllProperties?: boolean;
}

export function AssetForm({
  onSubmit,
  initialData,
  mode = "page",
  onCancel,
  showAllProperties = true,
}: AssetFormProps) {
  const [formData, setFormData] = useState({
    itemName: initialData?.itemName || "",
    description: initialData?.description || "",
    notes: initialData?.notes || "",
    purchaseDate: initialData?.purchaseDate || undefined,
    itemType: initialData?.itemType || "",
    expiryDate: initialData?.expiryDate || undefined,
    poNumber: initialData?.poNumber || "",
    property: initialData?.property || "",
    condition: initialData?.condition || "",
    serialNumber: initialData?.serialNumber || "",
    barcode: initialData?.barcode || "",
    rfid: initialData?.rfid || "",
    subcategory: initialData?.subcategory || "",
    manufacturer: initialData?.manufacturer || "",
    model: initialData?.model || "",
    location: initialData?.location || "",
    department: initialData?.department || "",
    amcEnabled: initialData?.amcEnabled ?? false,
    amcStartDate: initialData?.amcStartDate || undefined,
    amcEndDate: initialData?.amcEndDate || undefined,
    amcProvider: initialData?.amcProvider || "",
    amcCost: initialData?.amcCost ?? "",
    purchaseCost: initialData?.purchaseCost ?? "",
    currentValue: initialData?.currentValue ?? "",
    depreciationMethod: initialData?.depreciationMethod || "straight_line",
    depreciationRate: initialData?.depreciationRate ?? "",
    accumulatedDepreciation: initialData?.accumulatedDepreciation ?? "",
    usefulLifeYears: initialData?.usefulLifeYears ?? "",
    salvageValue: initialData?.salvageValue ?? "",
    vendor: initialData?.vendor ?? "",
    invoiceNumber: initialData?.invoiceNumber ?? "",
    warrantyProvider: initialData?.warrantyProvider ?? "",
    warrantyNotes: initialData?.warrantyNotes ?? "",
    warrantyStartDate: initialData?.warrantyStartDate || undefined,
    warrantyEndDate: initialData?.warrantyExpiry || initialData?.warrantyEndDate || undefined,
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(initialData?.itemType ? (GROUP_BY_CODE[initialData.itemType?.split(':')[0]?.trim()]?.code || '') : '');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allowedDeptNames, setAllowedDeptNames] = useState<string[] | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData({
      itemName: initialData?.itemName || "",
      description: initialData?.description || "",
      notes: initialData?.notes || "",
      purchaseDate: initialData?.purchaseDate || undefined,
      itemType: initialData?.itemType || "",
      itemTypeName: initialData?.itemTypeName || "",
      expiryDate: initialData?.expiryDate || undefined,
      poNumber: initialData?.poNumber || "",
      property: initialData?.property || "",
      condition: initialData?.condition || "",
      serialNumber: initialData?.serialNumber || "",
      barcode: initialData?.barcode || "",
      rfid: initialData?.rfid || "",
      subcategory: initialData?.subcategory || "",
      manufacturer: initialData?.manufacturer || "",
      model: initialData?.model || "",
      location: initialData?.location || "",
      department: initialData?.department || "",
      amcEnabled: initialData?.amcEnabled ?? false,
      amcStartDate: initialData?.amcStartDate || undefined,
      amcEndDate: initialData?.amcEndDate || undefined,
      amcProvider: initialData?.amcProvider || "",
      amcCost: initialData?.amcCost ?? "",
      purchaseCost: initialData?.purchaseCost ?? "",
      currentValue: initialData?.currentValue ?? "",
      depreciationMethod: initialData?.depreciationMethod || "straight_line",
      depreciationRate: initialData?.depreciationRate ?? "",
      accumulatedDepreciation: initialData?.accumulatedDepreciation ?? "",
      usefulLifeYears: initialData?.usefulLifeYears ?? "",
      salvageValue: initialData?.salvageValue ?? "",
      vendor: initialData?.vendor ?? "",
      invoiceNumber: initialData?.invoiceNumber ?? "",
      warrantyProvider: initialData?.warrantyProvider ?? "",
      warrantyNotes: initialData?.warrantyNotes ?? "",
      warrantyStartDate: initialData?.warrantyStartDate || undefined,
      warrantyEndDate: initialData?.warrantyExpiry || initialData?.warrantyEndDate || undefined,
    });
  }, [initialData]);

  useEffect(() => {
    (async () => {
      try {
        // Properties from Django (or fallback handled in page state)
        if (!isDemoMode()) {
          let props = await listProperties();
          // Filter by access for non-admin users unless showAllProperties is true
          try {
            const raw =
              (isDemoMode()
                ? sessionStorage.getItem("demo_auth_user") ||
                  localStorage.getItem("demo_auth_user")
                : null) || localStorage.getItem("auth_user");
            const cu = raw ? JSON.parse(raw) : null;
            const role = (cu?.role || "").toLowerCase();
            if (role !== "admin" && !(showAllProperties ?? false)) {
              const access = await getAccessiblePropertyIdsForCurrentUser();
              const accessIds = new Set(Array.from(access).map(String));
              const filtered = props.filter((p) => accessIds.has(String(p.id)));
              // If editing and initialData property not in filtered, include it for visibility only
              if (
                initialData?.property &&
                !filtered.find((p) => p.id === initialData.property)
              ) {
                const keep = props.find((p) => p.id === initialData.property);
                if (keep) filtered.unshift(keep);
              }
              props = filtered;
            }
          } catch {}
          setProperties(props);
        } else {
          // fallback to common names in demo mode
          setProperties([
            {
              id: "PROP-001",
              name: "Main Office",
              type: "Office",
              status: "Active",
              address: "",
              manager: "",
            } as any,
            {
              id: "PROP-002",
              name: "Warehouse",
              type: "Storage",
              status: "Active",
              address: "",
              manager: "",
            } as any,
            {
              id: "PROP-003",
              name: "Branch Office",
              type: "Office",
              status: "Active",
              address: "",
              manager: "",
            } as any,
            {
              id: "PROP-004",
              name: "Factory",
              type: "Manufacturing",
              status: "Active",
              address: "",
              manager: "",
            } as any,
          ]);
        }
      } catch {
        /* properties stay empty */
      }
      // Load departments
      try {
        const list = await listDepartments();
        setDepartments(list);
      } catch {
        /* departments stay empty */
      }
      try {
        const raw =
          (isDemoMode()
            ? sessionStorage.getItem("demo_auth_user") ||
              localStorage.getItem("demo_auth_user")
            : null) || localStorage.getItem("auth_user");
        const cu = raw ? JSON.parse(raw) : null;
        setCurrentUser(cu);
        // Load allowed departments for current user (self), when backend present
        if (!isDemoMode() && cu?.id) {
          try {
            const depts = await listUserDepartmentAccess(cu.id);
            setAllowedDeptNames(Array.isArray(depts) ? depts : []);
          } catch {
            setAllowedDeptNames([]);
          }
        } else {
          setAllowedDeptNames(null);
        }
      } catch {}
    })();
  }, []);

  // Auto-select effective department for non-admins when there's a single choice
  useEffect(() => {
    const role = (currentUser?.role || "").toLowerCase();
    const allowed =
      allowedDeptNames && allowedDeptNames.length
        ? allowedDeptNames
        : currentUser?.department
          ? [currentUser.department]
          : [];
    if (role !== "admin") {
      if (allowed.length === 1 && !(formData as any).department) {
        setFormData((prev) => ({ ...prev, department: allowed[0] }) as any);
      }
      if (
        allowed.length > 1 &&
        (formData as any).department &&
        !allowed
          .map((d) => d.toLowerCase())
          .includes(String((formData as any).department).toLowerCase())
      ) {
        // Clear prefilled department if it isn't in allowed list
        setFormData((prev) => ({ ...prev, department: "" }) as any);
      }
    }
  }, [currentUser, allowedDeptNames]);

  const toNumber = (v: any): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const depreciationCalc = useMemo(() => {
    const cost = toNumber(formData.purchaseCost);
    if (!cost) {
      return { annual: 0, accumulated: 0, current: 0 };
    }
    const method = formData.depreciationMethod || "straight_line";
    const salvage = Math.max(0, toNumber(formData.salvageValue));
    const base = Math.max(0, cost - salvage);
    if (method === "no_depreciation") {
      return { annual: 0, accumulated: 0, current: cost };
    }
    let annual = 0;
    if (method === "straight_line") {
      const life = toNumber(formData.usefulLifeYears);
      if (life > 0) annual = base / life;
    } else {
      const rate = toNumber(formData.depreciationRate) / 100;
      if (rate > 0) annual = cost * rate;
    }
    let accumulated = 0;
    if (formData.purchaseDate) {
      const purchase = new Date(formData.purchaseDate);
      if (!Number.isNaN(purchase.getTime())) {
        const years =
          Math.max(0, Date.now() - purchase.getTime()) /
          (365.25 * 24 * 3600 * 1000);
        if (method === "straight_line") {
          const life = toNumber(formData.usefulLifeYears);
          if (life > 0) accumulated = Math.min(base, annual * years);
        } else {
          const rate = toNumber(formData.depreciationRate) / 100;
          if (rate > 0) {
            accumulated = Math.max(
              0,
              Math.min(base, cost * (1 - (1 - rate) ** years)),
            );
          }
        }
      }
    }
    const current = Math.max(0, cost - accumulated);
    return { annual, accumulated, current };
  }, [
    formData.purchaseCost,
    formData.purchaseDate,
    formData.depreciationMethod,
    formData.depreciationRate,
    formData.usefulLifeYears,
    formData.salvageValue,
  ]);

  const formatMoney = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const role = (currentUser?.role || "").toLowerCase();
    const amcEnabled = Boolean(formData.amcEnabled);
    const amcStart = amcEnabled ? formData.amcStartDate : undefined;
    const amcEnd = amcEnabled ? formData.amcEndDate : undefined;

    if (amcEnabled) {
      if (!amcStart || !amcEnd) {
        toast.error("Select both AMC start and end dates");
        return;
      }
      if (amcEnd.getTime() < amcStart.getTime()) {
        toast.error("AMC end date must be after the start date");
        return;
      }
    }

    const ws = formData.warrantyStartDate
      ? new Date(formData.warrantyStartDate)
      : undefined;
    const we = formData.warrantyEndDate
      ? new Date(formData.warrantyEndDate)
      : undefined;
    if (ws && we && we.getTime() < ws.getTime()) {
      toast.error("Warranty end date must be after the start date");
      return;
    }
    const cost = toNumber(formData.purchaseCost);
    const salvage = Math.max(0, toNumber(formData.salvageValue));
    if (cost > 0 && salvage > cost) {
      toast.error("Salvage value cannot exceed the purchase cost");
      return;
    }

    // For non-admins, if itemType not provided (hidden), default to "Other"
    const toSubmit = {
      ...formData,
      itemType:
        role === "admin" ? formData.itemType : formData.itemType || "Other",
      amcEnabled,
      amcStartDate: amcEnabled ? amcStart : undefined,
      amcEndDate: amcEnabled ? amcEnd : undefined,
      currentValue:
        cost > 0
          ? (depreciationCalc.current || 0).toFixed(2)
          : formData.currentValue,
      accumulatedDepreciation:
        cost > 0
          ? (depreciationCalc.accumulated || 0).toFixed(2)
          : formData.accumulatedDepreciation,
      warrantyExpiry: we,
      warrantyStartDate: ws,
    };

    // Basic validation — department falls back to currentUser's department
    // (mirrors the enforcement logic below so auto-filled values are accepted)
    const deptVal = (
      (toSubmit as any).department?.toString().trim() ||
      currentUser?.department?.toString().trim() ||
      ""
    );
    const locVal = (toSubmit as any).location?.toString().trim();
    const condVal = (toSubmit as any).condition?.toString().trim();

    // Collect all field errors at once so the user sees every problem inline
    const errors: Record<string, string> = {};
    if (!toSubmit.itemType) errors.itemType = "Asset item type is required";
    if (!toSubmit.property) errors.property = "Property is required";
    if (!deptVal) errors.department = "Department is required";
    if (!locVal) errors.location = "Location is required";
    if (!condVal) errors.condition = "Condition is required";

    // Ensure the resolved department is carried into toSubmit
    if (!toSubmit.department && deptVal) {
      (toSubmit as any).department = deptVal;
    }

    // Generic enforcement: if user is not admin and has allowed departments, selected department must be in that list
    const selectedDept =
      (toSubmit as any).department || currentUser?.department || "";
    const effectiveAllowed =
      allowedDeptNames && allowedDeptNames.length
        ? allowedDeptNames
        : currentUser?.department
          ? [currentUser.department]
          : [];
    const allowed = new Set(
      effectiveAllowed.map((d: string) => String(d).toLowerCase()),
    );
    if (role !== "admin" && allowed.size > 0) {
      if (!selectedDept || !allowed.has(String(selectedDept).toLowerCase())) {
        errors.department =
          "You are not allowed to create assets for this department";
      }
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      // Scroll to the first invalid field immediately so the user sees the error
      requestAnimationFrame(() => {
        const firstKey = Object.keys(errors)[0];
        const el = document.getElementById(firstKey) ??
          document.querySelector(`[aria-invalid="true"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement | null)?.focus?.();
      });
      return;
    }
    setFieldErrors({});
    if (submitting) return;
    setSubmitting(true);

    try {
      const result = await onSubmit?.(toSubmit);
      if (result === true && !initialData) {
        setFormData({
          itemName: "",
          description: "",
          notes: "",
          purchaseDate: undefined,
          itemType: "",
          itemTypeName: "",
          expiryDate: undefined,
          poNumber: "",
          property: "",
          condition: "",
          serialNumber: "",
          barcode: "",
          rfid: "",
          subcategory: "",
          manufacturer: "",
          model: "",
          location: "",
          department: "",
          amcEnabled: false,
          amcStartDate: undefined,
          amcEndDate: undefined,
          amcProvider: "",
          amcCost: "",
          purchaseCost: "",
          currentValue: "",
          depreciationMethod: "straight_line",
          depreciationRate: "",
          accumulatedDepreciation: "",
          usefulLifeYears: "",
          salvageValue: "",
          vendor: "",
          invoiceNumber: "",
          warrantyProvider: "",
          warrantyNotes: "",
          warrantyStartDate: undefined,
          warrantyEndDate: undefined,
        });
      }
    } catch (err: any) {
      // Parent already surfaced error (e.g., modal). Do nothing here.
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleToggleAmc = (enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      amcEnabled: enabled,
      amcStartDate: enabled ? prev.amcStartDate : undefined,
      amcEndDate: enabled ? prev.amcEndDate : undefined,
    }));
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="h-4 w-4 text-primary" />
          Asset Essentials
        </div>
        <div className="grid gap-6 md:grid-cols-1">
          <div className="space-y-2">
            <Label htmlFor="itemType">Asset Item Type *</Label>
            <ItemGroupSelector
              value={formData.itemType}
              onChange={(code, label) => {
                const item = ASSET_GROUPS.flatMap(g => g.items).find(i => i.code === code);
                if (item) {
                  setSelectedGroup(item.groupCode);
                  handleInputChange("itemType", item.code);
                  handleInputChange("itemTypeName", label);
                } else if (!code) {
                  setSelectedGroup("");
                  handleInputChange("itemType", "");
                  handleInputChange("itemTypeName", "");
                }
              }}
              error={Boolean(fieldErrors.itemType)}
            />
            {fieldErrors.itemType && (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.itemType}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condition *</Label>
            <Select
              value={formData.condition}
              onValueChange={(value) => handleInputChange("condition", value)}
            >
              <SelectTrigger
                className={cn(
                  fieldErrors.condition &&
                    "border-destructive focus-visible:ring-destructive/40"
                )}
              >
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.condition && (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.condition}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Assignment & Tracking
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="property">Property *</Label>
            <Select
              value={String(formData.property || "")}
              onValueChange={(value) => handleInputChange("property", value)}
            >
              <SelectTrigger
                className={cn(
                  fieldErrors.property &&
                    "border-destructive focus-visible:ring-destructive/40"
                )}
              >
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Select a property</SelectItem>
                {properties
                  .filter((p) => p.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {fieldErrors.property && (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.property}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <Select
              value={(formData as any).department || ""}
              onValueChange={(value) => handleInputChange("department", value)}
              disabled={
                (currentUser?.role || "").toLowerCase() !== "admin" &&
                (allowedDeptNames && allowedDeptNames.length
                  ? allowedDeptNames.length
                  : currentUser?.department
                    ? 1
                    : 0) === 1
              }
            >
              <SelectTrigger
                className={cn(
                  fieldErrors.department &&
                    "border-destructive focus-visible:ring-destructive/40"
                )}
              >
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const role = (currentUser?.role || "").toLowerCase();
                  let list: Department[] = [];
                  if (role === "admin") {
                    list = departments || [];
                  } else {
                    const effective =
                      allowedDeptNames && allowedDeptNames.length
                        ? allowedDeptNames
                        : currentUser?.department
                          ? [currentUser.department]
                          : [];
                    const set = new Set(
                      effective.map((n: string) => n.toLowerCase()),
                    );
                    list = (departments || []).filter((d) =>
                      set.has((d.name || "").toLowerCase()),
                    );
                    const cur = ((formData as any).department || "").toString();
                    if (
                      cur &&
                      !list.find(
                        (d) =>
                          (d.name || "").toLowerCase() === cur.toLowerCase(),
                      )
                    ) {
                      list = [{ id: "cur", name: cur } as any, ...list];
                    }
                  }
                  return list
                    .filter((d) => d.name)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}{d.code ? ` (${d.code})` : ''}
                      </SelectItem>
                    ));
                })()}
              </SelectContent>
            </Select>
            {fieldErrors.department && (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.department}
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
              placeholder="e.g., Floor 2, Room 203"
              aria-invalid={Boolean(fieldErrors.location)}
              className={cn(
                fieldErrors.location &&
                  "border-destructive focus-visible:ring-destructive/40"
              )}
              required
            />
            {fieldErrors.location && (
              <p className="text-xs font-medium text-destructive">
                {fieldErrors.location}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Package className="h-4 w-4 text-primary" />
          Classification & Manufacturing
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <Input
              id="subcategory"
              value={formData.subcategory}
              onChange={(e) => handleInputChange("subcategory", e.target.value)}
              placeholder="e.g., Portable, Server, Office Desk"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer / Brand</Label>
            <Input
              id="manufacturer"
              value={formData.manufacturer}
              onChange={(e) => handleInputChange("manufacturer", e.target.value)}
              placeholder="e.g., Dell, Herman Miller, Apple"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) => handleInputChange("model", e.target.value)}
              placeholder="e.g., Latitude 5520, Aeron Chair, iPhone 15"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarIcon className="h-4 w-4 text-primary" />
          Lifecycle & Procurement
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Purchase Date</Label>
            <DatePicker
              date={formData.purchaseDate}
              setDate={(date) => handleInputChange("purchaseDate", date)}
            />
          </div>

          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <DatePicker
              date={formData.expiryDate}
              setDate={(date) => handleInputChange("expiryDate", date)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poNumber">PO Number</Label>
            <Input
              id="poNumber"
              value={formData.poNumber}
              onChange={(e) => handleInputChange("poNumber", e.target.value)}
              placeholder="Purchase Order Number"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <DollarSign className="h-4 w-4 text-primary" />
          Financial Information
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="purchaseCost">Purchase Cost</Label>
            <Input
              id="purchaseCost"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={formData.purchaseCost}
              onChange={(e) => handleInputChange("purchaseCost", e.target.value)}
              onWheel={(e) => {
                try {
                  (e.currentTarget as HTMLInputElement).blur();
                } catch {}
              }}
              placeholder="e.g., 2500.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Supplier / Vendor</Label>
            <Input
              id="vendor"
              value={formData.vendor}
              onChange={(e) => handleInputChange("vendor", e.target.value)}
              placeholder="e.g., Dell Technologies"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={(e) => handleInputChange("invoiceNumber", e.target.value)}
              placeholder="Invoice reference"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="depreciationMethod">Depreciation Method</Label>
            <Select
              value={formData.depreciationMethod}
              onValueChange={(value) =>
                handleInputChange("depreciationMethod", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="straight_line">Straight Line</SelectItem>
                <SelectItem value="reducing_balance">
                  Reducing Balance
                </SelectItem>
                <SelectItem value="no_depreciation">No Depreciation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.depreciationMethod === "straight_line" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="usefulLifeYears">Useful Life (years)</Label>
                <Input
                  id="usefulLifeYears"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={formData.usefulLifeYears}
                  onChange={(e) =>
                    handleInputChange("usefulLifeYears", e.target.value)
                  }
                  onWheel={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).blur();
                    } catch {}
                  }}
                  placeholder="e.g., 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salvageValue">Salvage Value</Label>
                <Input
                  id="salvageValue"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={formData.salvageValue}
                  onChange={(e) =>
                    handleInputChange("salvageValue", e.target.value)
                  }
                  onWheel={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).blur();
                    } catch {}
                  }}
                  placeholder="e.g., 250.00"
                />
              </div>
            </>
          )}

          {formData.depreciationMethod === "reducing_balance" && (
            <div className="space-y-2">
              <Label htmlFor="depreciationRate">
                Depreciation Rate (% per year)
              </Label>
              <Input
                id="depreciationRate"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.1"
                value={formData.depreciationRate}
                onChange={(e) =>
                  handleInputChange("depreciationRate", e.target.value)
                }
                onWheel={(e) => {
                  try {
                    (e.currentTarget as HTMLInputElement).blur();
                  } catch {}
                }}
                placeholder="e.g., 20"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Warranty Start Date</Label>
            <DatePicker
              date={formData.warrantyStartDate}
              setDate={(date) => handleInputChange("warrantyStartDate", date)}
            />
          </div>

          <div className="space-y-2">
            <Label>Warranty End Date</Label>
            <DatePicker
              date={formData.warrantyEndDate}
              setDate={(date) => handleInputChange("warrantyEndDate", date)}
              disabledDates={(date) => {
                if (!formData.warrantyStartDate) return false;
                const start = new Date(
                  formData.warrantyStartDate.getFullYear(),
                  formData.warrantyStartDate.getMonth(),
                  formData.warrantyStartDate.getDate(),
                );
                return date < start;
              }}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="warrantyProvider">Warranty Provider</Label>
            <Input
              id="warrantyProvider"
              value={formData.warrantyProvider}
              onChange={(e) =>
                handleInputChange("warrantyProvider", e.target.value)
              }
              placeholder="e.g., Dell ProSupport, Manufacturer Warranty"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="warrantyNotes">Warranty Notes</Label>
            <Textarea
              id="warrantyNotes"
              value={formData.warrantyNotes}
              onChange={(e) =>
                handleInputChange("warrantyNotes", e.target.value)
              }
              placeholder="Terms, coverage details, claim numbers…"
              rows={2}
            />
          </div>
        </div>

        {(toNumber(formData.purchaseCost) > 0 ||
          formData.depreciationMethod !== "straight_line") && (
          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Annual Depreciation
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatMoney(depreciationCalc.annual)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Depreciation Value
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatMoney(depreciationCalc.accumulated)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Current Value
              </p>
              <p className="mt-1 text-lg font-semibold text-primary">
                {formatMoney(depreciationCalc.current)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-primary" />
          AMC Tracker
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Enable AMC tracking
              </p>
              <p className="text-xs text-muted-foreground">
                We’ll surface expiring contracts on the dashboard ahead of time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="amcEnabled"
                checked={formData.amcEnabled}
                onCheckedChange={(checked) => handleToggleAmc(checked === true)}
              />
              <Label htmlFor="amcEnabled" className="text-sm font-medium">
                Track AMC
              </Label>
            </div>
          </div>
          {formData.amcEnabled && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>AMC Start Date</Label>
                <DatePicker
                  date={formData.amcStartDate}
                  setDate={(date) => handleInputChange("amcStartDate", date)}
                />
              </div>
              <div className="space-y-2">
                <Label>AMC End Date</Label>
                <DatePicker
                  date={formData.amcEndDate}
                  setDate={(date) => handleInputChange("amcEndDate", date)}
                  disabledDates={(date) => {
                    if (!formData.amcStartDate) return false;
                    const start = new Date(
                      formData.amcStartDate.getFullYear(),
                      formData.amcStartDate.getMonth(),
                      formData.amcStartDate.getDate(),
                    );
                    return date < start;
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amcProvider">AMC Provider</Label>
                <Input
                  id="amcProvider"
                  value={formData.amcProvider}
                  onChange={(e) =>
                    handleInputChange("amcProvider", e.target.value)
                  }
                  placeholder="Service provider name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amcCost">AMC Cost</Label>
                <Input
                  id="amcCost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={formData.amcCost}
                  onChange={(e) => handleInputChange("amcCost", e.target.value)}
                  onWheel={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).blur();
                    } catch {}
                  }}
                  placeholder="e.g., 1200.00"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Info className="h-4 w-4 text-primary" />
          Notes & Metadata
        </div>
        <div className="grid gap-6 md:grid-cols-1">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Public-facing description of the asset…"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Operational notes, history, team reminders…"
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Double-check quantity and location details before saving to keep
          reports accurate.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : window.history.back())}
          >
            Cancel
          </Button>
          <Button type="submit" className="gap-2 min-w-[140px]" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {submitting
              ? "Saving..."
              : initialData
                ? "Update Asset"
                : "Save Asset"}
          </Button>
        </div>
      </div>
    </form>
  );

  if (mode === "modal") {
    return formContent;
  }

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-md">
      <CardHeader className="space-y-2 border-b border-border/70">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Package className="h-5 w-5 text-primary" />
          {initialData ? "Edit Asset" : "Add New Asset"}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Capture the information your teams rely on for lifecycle, assignment,
          and reporting.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">{formContent}</CardContent>
    </Card>
  );
}
