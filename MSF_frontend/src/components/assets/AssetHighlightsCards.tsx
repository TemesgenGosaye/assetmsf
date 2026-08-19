import { useMemo } from "react";
import { Package, ShieldCheck, AlertTriangle, Calendar } from "lucide-react";
import MetricCard, {
  type MetricCardVariant,
} from "@/components/ui/metric-card";

type Props = {
  assets: any[];
};

type CardItem = {
  key: string;
  title: string;
  icon: typeof Package;
  variant: MetricCardVariant;
  value: string;
  caption: string;
};

export default function AssetHighlightsCards({ assets }: Props) {
  const items = useMemo<CardItem[]>(() => {
    const total = assets.length;
    const active = assets.filter(
      (a: any) => String(a.status).toLowerCase() === "active",
    ).length;
    const expiringSoon = assets.filter(
      (a: any) => String(a.status).toLowerCase() === "expiring soon",
    ).length;
    const quantity = 0;

    return [
      {
        key: "total",
        title: "Total Assets",
        icon: Package,
        variant: "blue",
        value: total.toLocaleString(),
        caption: "Assets currently in view",
      },
      {
        key: "active",
        title: "Active Assets",
        icon: ShieldCheck,
        variant: "emerald",
        value: active.toLocaleString(),
        caption: "In service today",
      },
      {
        key: "expiring",
        title: "Expiring Soon",
        icon: AlertTriangle,
        variant: "amber",
        value: expiringSoon.toLocaleString(),
        caption: "Due within 30 days",
      },
    ];
  }, [assets]);

  return (
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
      {items.map((item) => (
        <MetricCard
          key={item.key}
          icon={item.icon}
          title={item.title}
          value={item.value}
          caption={item.caption}
          variant={item.variant}
        />
      ))}
    </div>
  );
}
