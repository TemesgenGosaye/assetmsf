import React, { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileJson, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  exportToPDF,
  exportToExcel,
  exportToCSV,
  exportToPrint,
  ExportConfig,
  ExportColumn,
} from "@/lib/exportService";

export interface ReportExportMenuProps {
  title: string;
  fileName: string;
  columns: ExportColumn[];
  getRows: () => (string | number | null | undefined)[][] | Promise<(string | number | null | undefined)[][]>;
  getSelectedRows?: () => (string | number | null | undefined)[][] | Promise<(string | number | null | undefined)[][]>;
  totalCount: number;
  selectedCount?: number;
  filters?: string;
  disabled?: boolean;
}

export function ReportExportMenu({
  title,
  fileName,
  columns,
  getRows,
  getSelectedRows,
  totalCount,
  selectedCount = 0,
  filters,
  disabled = false,
}: ReportExportMenuProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = async (
    format: "pdf" | "excel" | "csv" | "print",
    useSelected: boolean
  ) => {
    if (isExporting) return;

    try {
      setIsExporting(`${format}-${useSelected ? "selected" : "all"}`);
      const rawRows = useSelected && getSelectedRows ? await getSelectedRows() : await getRows();
      const rows = Array.isArray(rawRows) ? rawRows : [];
      
      const config: ExportConfig = {
        title,
        fileName,
        columns,
        rows,
        filters,
        recordCount: rows.length,
      };

      if (format === "pdf") {
        await exportToPDF(config);
      } else if (format === "excel") {
        await exportToExcel(config);
      } else if (format === "csv") {
        exportToCSV(config);
      } else if (format === "print") {
        exportToPrint(config);
      }

      toast.success(`${format.toUpperCase()} export generated successfully (${rows.length} records).`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Failed to generate ${format.toUpperCase()} export.`);
    } finally {
      setIsExporting(null);
    }
  };

  const hasSelection = selectedCount > 0 && !!getSelectedRows;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || totalCount === 0}
          className="h-8 rounded-full border-border bg-background px-2.5 text-xs font-medium text-foreground/90 shadow-sm hover:bg-muted hover:text-foreground"
          aria-label="Export report"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="hidden lg:inline ml-1.5">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Export Report
        </DropdownMenuLabel>
        
        {hasSelection && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="text-xs cursor-pointer"
                disabled={!!isExporting}
                onClick={() => handleExport("pdf", true)}
              >
                <FileText className="mr-2 h-3.5 w-3.5 text-primary" />
                Selected to PDF ({selectedCount})
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer"
                disabled={!!isExporting}
                onClick={() => handleExport("excel", true)}
              >
                <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-green-600" />
                Selected to Excel ({selectedCount})
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer"
                disabled={!!isExporting}
                onClick={() => handleExport("csv", true)}
              >
                <FileJson className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                Selected to CSV ({selectedCount})
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer"
                disabled={!!isExporting}
                onClick={() => handleExport("print", true)}
              >
                <Printer className="mr-2 h-3.5 w-3.5 text-foreground" />
                Selected to Print ({selectedCount})
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-xs cursor-pointer"
            disabled={!!isExporting}
            onClick={() => handleExport("pdf", false)}
          >
            <FileText className="mr-2 h-3.5 w-3.5 text-primary" />
            {hasSelection ? "All to PDF" : "PDF Report"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs cursor-pointer"
            disabled={!!isExporting}
            onClick={() => handleExport("excel", false)}
          >
            <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-green-600" />
            {hasSelection ? "All to Excel" : "Excel Spreadsheet"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs cursor-pointer"
            disabled={!!isExporting}
            onClick={() => handleExport("csv", false)}
          >
            <FileJson className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            {hasSelection ? "All to CSV" : "CSV File"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs cursor-pointer"
            disabled={!!isExporting}
            onClick={() => handleExport("print", false)}
          >
            <Printer className="mr-2 h-3.5 w-3.5 text-foreground" />
            {hasSelection ? "All to Print" : "Print"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

