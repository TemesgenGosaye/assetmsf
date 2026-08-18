import { useConfirm, crudToast } from "@/lib/enterprise-feedback";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProperty, type Property, deleteProperty } from "@/services/properties";
import { listAssets, type Asset } from "@/services/assets";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building2, MapPin, User, Package, Trash2, Hash, ShieldCheck } from "lucide-react";
import StatusChip from "@/components/ui/status-chip";
import DetailPage from "@/components/detail/DetailPage";

export default function PropertyDetails() {
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const role = (() => { try { const r = localStorage.getItem("auth_user"); return r ? (JSON.parse(r).role ?? "").toLowerCase() : ""; } catch { return ""; } })();
  const isAdmin = role === "admin";

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const propData = await getProperty(id);
        setProperty(propData);
        const allAssets = await listAssets();
        const propertyAssets = allAssets.filter(
          a => String(a.property_id) === id || a.property === propData.name
        );
        setAssets(propertyAssets);
      } catch (error: any) {
        console.error("Error loading property:", error);
        toast.error(error.message || "Failed to load property details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!property) return;
    const ok = await confirm({
      title: "Delete Property Record",
      description: `Are you sure you want to delete property "${property.name}"? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete Property",
    });
    if (ok) {
      try {
        await deleteProperty(property.id);
        crudToast.deleted("Property", `Property "${property.name}" deleted.`);
        navigate("/properties");
      } catch (error: any) {
        crudToast.failed("delete property", error.message);
      }
    }
  };

  if (loading || !property) {
    return (
      <DetailPage
        backTo="/properties"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Properties", to: "/properties" }, { label: "Property Details" }]}
        title="Property Profile"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading property details..."
        notFound={!loading && !property}
        notFoundTitle="Property Not Found"
      />
    );
  }

  return (
    <DetailPage
      backTo="/properties"
breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Properties", to: "/properties" }, { label: "Property Details" }]}
        title="Property Profile"
        layout="inverted"
      hero={{
        icon: <Building2 className="h-8 w-8 text-primary" />,
        name: property.name,
        subtitle: property.type,
        status: property.status,
        badges: <Badge variant="outline" className="text-[10px] font-mono">{property.id}</Badge>,
      }}
      sections={[
        {
          fields: [
            { icon: Hash, label: "Property ID", value: <span className="font-mono text-xs">{property.id}</span> },
            { icon: MapPin, label: "Address", value: property.address },
            { icon: User, label: "Manager", value: property.manager_name || property.manager || "—" },
          ],
        },
      ]}
      adminActions={
        isAdmin ? (
          <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
            <Trash2 className="h-4 w-4" /> Delete Property
          </Button>
        ) : undefined
      }
      sidebar={
        <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total Assets</span>
              </div>
              <span className="font-bold text-foreground">{assets.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Verification Rate</span>
              </div>
              <span className="font-semibold text-emerald-600">100%</span>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground text-center">
              Allocated inside Smart Asset Management System
            </div>
          </CardContent>
        </Card>
      }
    >
      <Card className="border border-border/60 shadow-sm rounded-2xl bg-card h-full">
        <CardHeader className="border-b border-border/60 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Assigned Assets</CardTitle>
            <CardDescription>Inventory items associated with this location</CardDescription>
          </div>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{assets.length} items</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                <tr>
                  <th className="px-6 py-2.5 border-r border-border">Asset Code</th>
                  <th className="px-6 py-2.5 border-r border-border">Name</th>
                  <th className="px-6 py-2.5 border-r border-border">Category</th>
                  <th className="px-6 py-2.5 border-r border-border">Condition</th>
                  <th className="px-6 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="hover:bg-blue-50 dark:hover:bg-blue-500/15 cursor-pointer transition-colors select-none"
                  >
                    <td className="px-6 py-2.5 border-r border-border font-mono text-xs font-semibold text-primary">{asset.asset_code || asset.id}</td>
                    <td className="px-6 py-2.5 border-r border-border font-medium text-foreground">{asset.name}</td>
                    <td className="px-6 py-2.5 border-r border-border text-muted-foreground">{asset.type}</td>
                    <td className="px-6 py-2.5 border-r border-border capitalize text-muted-foreground">{asset.condition || "—"}</td>
                    <td className="px-6 py-2.5">
                      <StatusChip status={asset.status} />
                    </td>
                  </tr>
                ))}
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground text-sm">
                      No assets currently assigned to this property.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DetailPage>
  );
}
