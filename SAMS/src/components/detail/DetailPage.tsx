import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import StatusChip from "@/components/ui/status-chip";

export type DetailFieldData = {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
};

export type DetailSection = {
  title?: string;
  titleIcon?: React.ElementType;
  fields: DetailFieldData[];
};

export type DetailPageProps = {
  backTo: string;
  breadcrumbs: { label: string; to?: string }[];
  title: string;
  hero: {
    icon?: React.ReactNode;
    initials?: string;
    name: string;
    subtitle?: string;
    status?: string;
    badges?: React.ReactNode;
  };
  sections: DetailSection[];
  layout?: "standard" | "inverted";
  sidebar?: React.ReactNode;
  children?: React.ReactNode;
  adminActions?: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  notFound?: boolean;
  notFoundTitle?: string;
  notFoundMessage?: string;
};

export function DetailField({ icon: Icon, label, value }: DetailFieldData) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-foreground break-words">{value ?? "—"}</div>
      </div>
    </div>
  );
}

export default function DetailPage({
  backTo,
  breadcrumbs,
  title,
  hero,
  sections,
  layout = "standard",
  sidebar,
  children,
  adminActions,
  loading = false,
  loadingMessage = "Loading details...",
  notFound = false,
  notFoundTitle = "Not Found",
  notFoundMessage = "We could not find what you are looking for. It may have been deleted or the ID is incorrect.",
}: DetailPageProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-border/60 text-center shadow-lg rounded-2xl max-w-md mx-auto mt-12 p-8">
          <CardHeader>
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">{notFoundTitle}</CardTitle>
            <CardDescription>{notFoundMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(backTo)} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const detailsPanel = (
    <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card">
      <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 py-6 border-b border-border/60">
        <div className="flex items-center gap-4">
          {hero.initials ? (
            <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center text-xl font-bold text-primary shadow-sm ring-2 ring-primary/20">
              {hero.initials}
            </div>
          ) : hero.icon ? (
            <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center shadow-sm ring-2 ring-primary/20">
              {hero.icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight text-foreground truncate">{hero.name}</h2>
            {hero.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{hero.subtitle}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {hero.status && <StatusChip status={hero.status} />}
              {hero.badges}
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <div className={sections.length > 1 ? "grid gap-6 sm:grid-cols-2" : ""}>
          {sections.map((section, si) => (
            <div key={si} className="space-y-4">
              {section.title && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  {section.titleIcon && <section.titleIcon className="h-4 w-4 text-primary" />}
                  {section.title}
                </h3>
              )}
              <div className="space-y-3">
                {section.fields.map((field, fi) => (
                  <DetailField key={fi} {...field} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const isStandard = layout === "standard";
  const detailColClass = isStandard ? "md:col-span-2" : "lg:col-span-1";
  const contentColClass = isStandard ? "md:col-span-1" : "lg:col-span-2";
  const gridClass = isStandard ? "md:grid-cols-3" : "lg:grid-cols-3";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(backTo)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {adminActions}
        </div>
      </div>

      <div className={`grid gap-6 ${gridClass}`}>
        <div className={`${detailColClass} space-y-6`}>
          {detailsPanel}
        </div>
        <div className={`${contentColClass} space-y-6`}>
          {children}
          {sidebar}
        </div>
      </div>
    </div>
  );
}
