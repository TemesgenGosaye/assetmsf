import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ColumnChooser, {
  type ColumnDef,
} from "@/components/table/ColumnChooser";
import { ReportExportMenu, type ReportExportMenuProps } from "@/components/table/ReportExportMenu";

type Props = {
  columns: ColumnDef[];
  visibleCols: string[];
  onVisibleColsChange: (cols: string[]) => void;
  canAdd: boolean;
  onAddClick: () => void;
  exportProps?: ReportExportMenuProps;
};

export default function AssetPageHeader({
  columns,
  visibleCols,
  onVisibleColsChange,
  canAdd,
  onAddClick,
  exportProps,
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-10 shadow-sm sm:px-12 sm:py-12">
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Asset Management | የቋሚ ንብረት አስተዳደር
          </h1>
          <p className="text-lg text-muted-foreground">
            Track and manage all your organization's assets
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportProps && <ReportExportMenu {...exportProps} />}
          <ColumnChooser
            columns={columns}
            visible={visibleCols}
            onChange={onVisibleColsChange}
          />
          <Button
            size="sm"
            onClick={onAddClick}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
            disabled={!canAdd}
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>
      <div className="absolute right-0 top-0 -z-10 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent" />
    </div>
  );
}

