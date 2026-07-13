import { CalendarClock } from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { AllocationSection } from "./ResidentialHub";

export default function ResidentialSeasonal() {
  return (
    <div className="space-y-6 p-6">
      <Breadcrumbs items={[
        { label: "Residential Hub", href: "/residential-hub" },
        { label: "Seasonal House" },
      ]} />
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
          <CalendarClock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Seasonal House</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Fixed-term housing allocations for seasonal staff.
          </p>
        </div>
      </div>
      <AllocationSection category="seasonal" />
    </div>
  );
}
