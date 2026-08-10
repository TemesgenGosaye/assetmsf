import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getHouse, type House, deleteHouse } from "@/services/houses";
import {
  listAllocations,
  type ResidentAllocation,
} from "@/services/residentialAllocations";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { crudToast } from "@/lib/enterprise-feedback";
import { BarcodeGenerator } from "@/components/barcode/BarcodeGenerator";
import {
  Home,
  MapPin,
  Users,
  Hash,
  Trash2,
  Calendar,
  Sparkles,
  Edit,
  Grid3X3,
  Barcode,
} from "lucide-react";
import StatusChip from "@/components/ui/status-chip";
import DetailPage from "@/components/detail/DetailPage";

const TYPE_LABELS: Record<string, string> = {
  Staff: "Staff House",
  A: "Type A",
  B: "Type B",
  C: "Type C",
  D: "Type D",
  E: "Barrack",
};

const DamageGridItem = ({
  label,
  isDamaged,
}: {
  label: string;
  isDamaged: boolean;
}) => (
  <div
    className={`flex items-center justify-between p-3 rounded-xl border border-border/60 ${
      isDamaged
        ? "bg-rose-50/50 border-rose-200/50 dark:bg-rose-950/20 dark:border-rose-900/30"
        : "bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-900/30"
    }`}
  >
    <span className="text-sm font-medium text-foreground">{label}</span>
    <Badge
      variant="outline"
      className={`text-xs gap-1.5 ${
        isDamaged
          ? "border-rose-300 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
          : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isDamaged ? "bg-rose-600 dark:bg-rose-400" : "bg-emerald-600 dark:bg-emerald-400"}`}
      />
      {isDamaged ? "Damaged" : "OK"}
    </Badge>
  </div>
);

export default function HouseDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [house, setHouse] = useState<House | null>(null);
  const [occupants, setOccupants] = useState<ResidentAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState<string>("");
  const role = (() => {
    try {
      const r = localStorage.getItem("auth_user");
      return r ? (JSON.parse(r).role ?? "").toLowerCase() : "";
    } catch {
      return "";
    }
  })();
  const isAdmin = role === "admin";
  const confirm = useConfirm();

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const houseData = await getHouse(id);
        setHouse(houseData);
        
        const categories = ["permanent", "seasonal", "guest"] as const;
        const promises = categories.map((cat) =>
          listAllocations(cat).catch(() => []),
        );
        const results = await Promise.all(promises);
        const allAllocations = results.flat();
        const houseOccupants = allAllocations.filter(
          (alloc) =>
            alloc.unit_number === houseData.house_id &&
            alloc.status === "Active",
        );
        setOccupants(houseOccupants);
      } catch (error: any) {
        console.error("Error loading house:", error);
        toast.error(error.message || "Failed to load house details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const isAssigned = house?.allocation_status === "Assigned";

  const handleEdit = () => {
    if (!house || !isAdmin) return;
    if (isAssigned) {
      toast.error("Cannot edit an allocated/assigned house.");
      return;
    }
    navigate(`/house-opp?edit=${encodeURIComponent(house.id)}`);
  };

  const handleDelete = async () => {
    if (!house) return;
    if (isAssigned) {
      crudToast.error("Cannot Delete House", "Cannot delete an allocated or assigned house.");
      return;
    }
    const ok = await confirm({
      title: "Delete House Record",
      description: `Are you sure you want to delete house "${house.house_id}"? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete House",
    });
    if (ok) {
      try {
        await deleteHouse(house.id);
        crudToast.deleted("House", `House ${house.house_id} has been removed.`);
        navigate("/house-opp");
      } catch (error: any) {
        crudToast.failed("delete house", error.message);
      }
    }
  };

  if (loading || !house) {
    return (
      <DetailPage
        backTo="/house-opp"
        breadcrumbs={[
          { label: "SAMS", to: "/dashboard" },
          { label: "House Opp", to: "/house-opp" },
          { label: "House Details" },
        ]}
        title="Housing Profile"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading house details..."
        notFound={!loading && !house}
        notFoundTitle="House Not Found"
      />
    );
  }

  return (
    <>
      <DetailPage
        backTo="/house-opp"
        breadcrumbs={[
          { label: "SAMS", to: "/dashboard" },
          { label: "House Opp", to: "/house-opp" },
          { label: "House Details" },
        ]}
        title="Housing Profile"
        hero={{
          icon: <Home className="h-8 w-8 text-primary" />,
          name: house.house_id,
          subtitle: TYPE_LABELS[house.house_type] || house.house_type,
          status: house.status,
          badges: (
            <Badge variant="outline" className="text-[10px] font-mono">
              {house.id}
            </Badge>
          ),
        }}
        sections={[
          {
            title: "Property Information",
            titleIcon: Home,
            fields: [
              {
                icon: Hash,
                label: "House Code",
                value: <span className="font-mono">{house.house_id}</span>,
              },
              { icon: MapPin, label: "Location", value: house.location },
              {
                icon: Users,
                label: "Allocation & Assignee",
                value: (
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex items-center w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        house.allocation_status === "Assigned"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                          : "bg-slate-500/10 text-slate-600 border-slate-300"
                      }`}
                    >
                      {house.allocation_status || "Unassigned"}
                    </span>
                    {house.allocation_status === "Assigned" && house.assigned_employee_name && (
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {house.assigned_employee_name} {house.assigned_employee_id ? `(ID: ${house.assigned_employee_id})` : ""}
                        {house.assigned_application_no ? ` • Ref: ${house.assigned_application_no}` : ""}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                icon: Grid3X3,
                label: "Inside Items",
                value: (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {house.inside_items && house.inside_items.length > 0 ? (
                      house.inside_items.map((item) => (
                        <Badge
                          key={item}
                          variant="secondary"
                          className="bg-primary/10 text-primary border-none text-xs py-0.5 px-2 font-medium"
                        >
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm font-normal">—</span>
                    )}
                  </div>
                ),
              },
            ],
          },
        ]}
        adminActions={
          isAdmin ? (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setBarcodeValue(house.house_id);
                  setBarcodeOpen(true);
                }}
                className="gap-1 border border-primary/20 bg-primary text-white shadow-sm hover:bg-primary/90"
              >
                <Barcode className="h-4 w-4" /> Generate Barcode
              </Button>
              <Button
                size="sm"
                onClick={handleEdit}
                className="gap-1 border border-emerald-200 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 dark:border-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Edit className="h-4 w-4" /> Edit House
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" /> Delete House
              </Button>
            </>
          ) : undefined
        }
        sidebar={
          <Card className="border border-border/60 shadow-sm rounded-2xl bg-card h-full">
            <CardHeader className="border-b border-border/60 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Current Occupants
                </CardTitle>
                <CardDescription>Residents assigned to this unit</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary">
                {occupants.length} / {house.capacity}
              </Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                {occupants.map((resident) => (
                  <div
                    key={resident.id}
                    className="flex flex-col p-3 rounded-xl border border-border/60 bg-muted/10 space-y-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {resident.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {resident.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {resident.job_title}
                        </p>
                      </div>
                    </div>
                    <Separator className="opacity-50" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> In:{" "}
                        {resident.move_in_date
                          ? new Date(resident.move_in_date).toLocaleDateString()
                          : "—"}
                      </span>
                      <span className="font-semibold capitalize text-primary/80">
                        {resident.category}
                      </span>
                    </div>
                  </div>
                ))}
                {occupants.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                    <Users className="h-10 w-10 opacity-20" />
                    <p>No residents currently assigned.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        }
      >
         <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
           <CardHeader className="py-4 border-b border-border/60">
             <CardTitle className="text-base font-semibold flex items-center gap-2">
               <Sparkles className="h-4 w-4 text-primary" /> Maintenance Checklist
             </CardTitle>
           </CardHeader>
           <CardContent className="p-6">
             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
               <DamageGridItem label="Door" isDamaged={house.damaged_door} />
               <DamageGridItem label="Windows" isDamaged={house.damaged_windows} />
               <DamageGridItem label="Walls" isDamaged={house.damaged_walls} />
               <DamageGridItem label="Switch" isDamaged={house.damaged_switch} />
               <DamageGridItem label="Bulb" isDamaged={house.damaged_bulb} />
               <DamageGridItem
                 label="Water System"
                 isDamaged={house.damaged_water}
               />
             </div>
           </CardContent>
         </Card>
         

        {house.description && (
          <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
            <CardContent className="p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Description / Notes
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {house.description}
              </p>
            </CardContent>
          </Card>
        )}
      </DetailPage>
      
      <BarcodeGenerator
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        value={barcodeValue}
      />
    </>
  );
}
