import { Users } from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { AllocationSection } from "./ResidentialHub";

export default function ResidentialGuest() {
  return (
    <div className="space-y-6 p-6">
      <Breadcrumbs items={[
        { label: "Residential Hub", href: "/residential-hub" },
        { label: "Guest House" },
      ]} />
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guest House</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Short-stay allocations for visiting guests and contractors.
          </p>
        </div>
      </div>
      <AllocationSection category="guest" />
    </div>
  );
}
