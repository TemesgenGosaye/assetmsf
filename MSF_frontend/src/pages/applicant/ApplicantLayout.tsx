import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Header } from "@/components/layout/Header";
import { ApplicantSidebar } from "./ApplicantSidebar";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
}

export function ApplicantLayout({ children }: Props) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="hidden md:block">
          <ApplicantSidebar />
        </div>
      )}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-[300px] max-w-[85vw] border-0 bg-transparent p-0 shadow-xl [&>button]:hidden"
          >
            <ApplicantSidebar
              isMobile
              onNavigate={() => setSidebarOpen(false)}
              className="w-full rounded-r-2xl"
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className={cn(
          "flex-1 overflow-auto overscroll-contain bg-muted/30",
          "p-4 md:p-6",
          isMobile && "pb-24",
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
