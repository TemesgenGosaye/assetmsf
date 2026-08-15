import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MetricCard from "@/components/ui/metric-card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, RefreshCw, Package } from "lucide-react";
import {
  fetchComplianceData,
  type ComplianceData,
  type ComplianceItem,
} from "@/services/assetAnalytics";

function formatMoney(v: number | undefined) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(v);
}

function ExpiryBadge({ item }: { item: ComplianceItem }) {
  if (item.status === "expired") {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if ((item.days_left ?? 999) <= 30) {
    return (
      <Badge
        variant="secondary"
        className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
      >
        Expiring in {item.days_left}d
      </Badge>
    );
  }
  return <Badge variant="secondary">Expiring in {item.days_left}d</Badge>;
}

export default function Compliance() {
  const navigate = useNavigate();
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await fetchComplianceData({ days });
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "Failed to load compliance data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await fetchComplianceData({ days, force: true });
      setData(result);
    } catch (e: any) {
      toast.error(e?.message || "Failed to refresh");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  const warranty = data?.warranty;
  const amc = data?.amc;
  const items = warranty?.items ?? [];
  const amcItems = amc?.items ?? [];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Assets", href: "/assets" }, { label: "Compliance" }]}
      />
      <PageHeader
        icon={ShieldCheck}
        title="Compliance & Contracts"
        amharicTitle="የንብረት አስተዳደር"
        description="Warranty and Annual Maintenance Contract (AMC) expiry tracking with proactive alerts."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/assets")}>
              <Package className="mr-2 h-4 w-4" /> All Assets
            </Button>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          icon={ShieldCheck}
          title="Active Warranty"
          value={warranty?.active ?? 0}
          caption="currently covered"
          variant="emerald"
        />
        <MetricCard
          icon={ShieldAlert}
          title="Warranty Expiring"
          value={(warranty?.expiring_30 ?? 0) + (warranty?.expiring_90 ?? 0)}
          caption={`${warranty?.expiring_30 ?? 0} within 30 days`}
          variant="amber"
        />
        <MetricCard
          icon={ShieldCheck}
          title="Active AMC"
          value={amc?.active ?? 0}
          caption="maintenance contracts"
          variant="blue"
        />
        <MetricCard
          icon={ShieldAlert}
          title="AMC Expiring"
          value={(amc?.expiring_30 ?? 0) + (amc?.expiring_90 ?? 0)}
          caption={`${amc?.expiring_30 ?? 0} within 30 days`}
          variant="rose"
        />
      </div>

      <Tabs defaultValue="warranty">
        <TabsList>
          <TabsTrigger value="warranty">
            Warranty
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              {items.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="amc">
            AMC
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              {amcItems.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warranty" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Warranty Expirations</CardTitle>
              <CardDescription>
                Assets whose warranty expires within {days} days or has already expired
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Purchase Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.asset}>
                        <TableCell className="font-medium font-mono text-xs">
                          {item.asset}
                        </TableCell>
                        <TableCell>{item.asset_name}</TableCell>
                        <TableCell>{item.provider || "—"}</TableCell>
                        <TableCell>{new Date(item.expiry).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {item.days_left !== null ? item.days_left : "—"}
                        </TableCell>
                        <TableCell>{formatMoney(item.purchase_cost)}</TableCell>
                        <TableCell>
                          <ExpiryBadge item={item} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No warranties are expiring or expired within this window.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amc" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AMC Expirations</CardTitle>
              <CardDescription>
                Annual Maintenance Contracts expiring within {days} days or already expired
              </CardDescription>
            </CardHeader>
            <CardContent>
              {amcItems.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Annual Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amcItems.map((item) => (
                      <TableRow key={item.asset}>
                        <TableCell className="font-medium font-mono text-xs">
                          {item.asset}
                        </TableCell>
                        <TableCell>{item.asset_name}</TableCell>
                        <TableCell>{item.provider || "—"}</TableCell>
                        <TableCell>
                          {item.start ? new Date(item.start).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>{new Date(item.expiry).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {item.days_left !== null ? item.days_left : "—"}
                        </TableCell>
                        <TableCell>{formatMoney(item.cost)}</TableCell>
                        <TableCell>
                          <ExpiryBadge item={item} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No AMCs are expiring or expired within this window.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
