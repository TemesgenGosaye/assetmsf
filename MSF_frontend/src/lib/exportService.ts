import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

export type ExportColumn = {
  header: string;
  key: string;
  align?: "left" | "center" | "right";
  width?: number; // PDF column width hint
};

export type ExportConfig = {
  title: string;
  fileName: string;
  columns: ExportColumn[];
  rows: (string | number | null | undefined)[][];
  filters?: string;
  recordCount: number;
  companyName?: string;
  systemName?: string;
};

const DEFAULT_COMPANY = "Metahara Sugar Factory";
const DEFAULT_SYSTEM = "MSF Asset & Housing Management System";
const MSF_LOGO_URL = "/msf_logo.jpg";

/** Load the MSF logo and return a base64 data URL */
async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch(MSF_LOGO_URL);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Load the MSF logo and return an ArrayBuffer (for ExcelJS) */
async function loadLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(MSF_LOGO_URL);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

export async function exportToPDF(config: ExportConfig) {
  const company = config.companyName || DEFAULT_COMPANY;
  const system = config.systemName || DEFAULT_SYSTEM;
  const generatedAt = new Date().toLocaleString();

  const orientation = config.columns.length > 5 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // --- Logo ---
  const logoBase64 = await loadLogoBase64();
  const LOGO_H = 14;  // mm
  const LOGO_W = 28;  // mm (aspect ~2:1)
  const LOGO_X = pageWidth - 14 - LOGO_W;
  const LOGO_Y = 8;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "JPEG", LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
    } catch {
      // Silently skip if the image fails
    }
  }

  // --- Branding Header ---
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(company, 14, 15);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(system, 14, 21);

  doc.setDrawColor(204, 124, 94); // Primary Accent
  doc.setLineWidth(0.8);
  doc.line(14, 25, pageWidth - 14, 25);

  // --- Title & Metadata Block ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(`Report: ${config.title}`, 14, 31);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${generatedAt}`, 14, 36);
  doc.text(`Total Records: ${config.recordCount}`, 14, 41);
  if (config.filters) {
    doc.text(`Filters: ${config.filters}`, 14, 46);
  }

  const startY = config.filters ? 51 : 46;

  // --- Table ---
  autoTable(doc, {
    startY,
    head: [config.columns.map(c => c.header)],
    body: config.rows.map(row => row.map(cell => cell == null ? "" : String(cell))),
    theme: "striped",
    headStyles: {
      fillColor: [204, 124, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: config.columns.reduce((acc, col, i) => {
      if (col.align) acc[i] = { halign: col.align as any };
      return acc;
    }, {} as any),
    margin: { top: 25, bottom: 18, left: 14, right: 14 },
  });

  // --- Footer: "Page X of Y" on every page ---
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.text(`Confidential — ${company}`, 14, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  doc.save(`${config.fileName}.pdf`);
}

export async function exportToExcel(config: ExportConfig) {
  const company = config.companyName || DEFAULT_COMPANY;
  const system = config.systemName || DEFAULT_SYSTEM;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = system;
  workbook.created = new Date();

  const sheetName = config.title.substring(0, 30).replace(/[\\/*?:[\]]/g, "");
  const sheet = workbook.addWorksheet(sheetName || "Export");

  // --- Try to embed logo ---
  const logoBuffer = await loadLogoBuffer();
  let logoRows = 0;

  if (logoBuffer) {
    try {
      const imageId = workbook.addImage({
        buffer: logoBuffer,
        extension: "jpeg",
      });
      // Place logo in top-right area (columns D-F, rows 1-4)
      sheet.addImage(imageId, {
        tl: { col: 3, row: 0 },
        br: { col: 6, row: 4 },
        editAs: "oneCell",
      });
      logoRows = 4; // reserve space for the logo
    } catch {
      // Skip logo if embedding fails
    }
  }

  // --- Metadata rows (left side, same rows as logo) ---
  // We'll add blank rows up to logoRows first, then add metadata as overlapping text
  // For simplicity, add rows from row 1 then push content down if logo exists
  const metaStartRow = 1;

  const addMeta = (text: string) => sheet.addRow([text]);

  addMeta(company);
  addMeta(system);
  addMeta("");
  addMeta(`Report: ${config.title}`);
  addMeta(`Generated: ${new Date().toLocaleString()}`);
  addMeta(`Total Records: ${config.recordCount}`);
  if (config.filters) {
    addMeta(`Filters: ${config.filters}`);
  }
  sheet.addRow([]);

  // Style metadata
  sheet.getCell("A1").font = { size: 14, bold: true, color: { argb: "FF1E293B" } };
  sheet.getCell("A2").font = { size: 10, italic: true, color: { argb: "FF64748B" } };
  sheet.getCell("A4").font = { size: 12, bold: true, color: { argb: "FF0F172A" } };

  // --- Header row ---
  const headerRowIdx = sheet.lastRow ? sheet.lastRow.number + 1 : 1;
  const headerRow = sheet.getRow(headerRowIdx);

  config.columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCC7C5E" } };
    cell.alignment = { vertical: "middle", horizontal: col.align || "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCC7C5E" } },
      bottom: { style: "medium", color: { argb: "FFB06246" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });
  headerRow.height = 24;

  // Track max lengths for auto column widths
  const colWidths = config.columns.map(c => Math.max(12, c.header.length + 3));

  // --- Data rows ---
  config.rows.forEach((row) => {
    const sheetRow = sheet.addRow(row.map(c => c == null ? "" : String(c)));
    sheetRow.height = 20;

    config.columns.forEach((col, idx) => {
      const cell = sheetRow.getCell(idx + 1);
      const valStr = cell.value == null ? "" : String(cell.value);
      colWidths[idx] = Math.max(colWidths[idx], Math.min(50, valStr.length + 2));

      if (col.align) {
        cell.alignment = { horizontal: col.align as any, vertical: "middle" };
      } else {
        cell.alignment = { vertical: "middle" };
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFF1F5F9" } },
        bottom: { style: "thin", color: { argb: "FFF1F5F9" } },
        left: { style: "thin", color: { argb: "FFF1F5F9" } },
        right: { style: "thin", color: { argb: "FFF1F5F9" } },
      };
    });
  });

  // Set calculated widths
  config.columns.forEach((_, idx) => {
    sheet.getColumn(idx + 1).width = colWidths[idx];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${config.fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

export function exportToCSV(config: ExportConfig) {
  const company = config.companyName || DEFAULT_COMPANY;
  const system = config.systemName || DEFAULT_SYSTEM;

  const metadata = [
    `# ${company}`,
    `# ${system}`,
    `# Report: ${config.title}`,
    `# Generated: ${new Date().toLocaleString()}`,
    `# Total Records: ${config.recordCount}`,
    ...(config.filters ? [`# Filters: ${config.filters}`] : []),
    "#",
  ].join("\n");

  const headers = config.columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(",");
  const body = config.rows
    .map(row =>
      row
        .map(cell => {
          const str = cell == null ? "" : String(cell);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  // Include UTF-8 BOM (\uFEFF) for native Excel compatibility
  const content = `\uFEFF${metadata}\n${headers}\n${body}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${config.fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

export function exportToPrint(config: ExportConfig) {
  const company = config.companyName || DEFAULT_COMPANY;
  const system = config.systemName || DEFAULT_SYSTEM;

  // Use absolute URL so the print window can load the logo
  const logoSrc = `${window.location.origin}/msf_logo.jpg`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${config.title} - ${company}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; }
        .header { margin-bottom: 20px; border-bottom: 2px solid #cc7c5e; padding-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; flex-direction: column; }
        .header-logo { height: 56px; width: auto; object-fit: contain; }
        .company { font-size: 22px; font-weight: 800; margin: 0; color: #0f172a; }
        .system { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
        .report-title { font-size: 18px; font-weight: 700; margin: 16px 0 6px 0; color: #0f172a; }
        .metadata-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 12px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .metadata-item { color: #475569; }
        .metadata-item strong { color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
        th { background-color: #cc7c5e; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
        .footer-logo { height: 28px; width: auto; opacity: 0.55; }
        @media print {
          @page { margin: 15mm; size: auto; }
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1 class="company">${company}</h1>
          <p class="system">${system}</p>
        </div>
        <img class="header-logo" src="${logoSrc}" alt="MSF Logo" onerror="this.style.display='none'" />
      </div>

      <div class="report-title">${config.title}</div>
      <div class="metadata-grid">
        <div class="metadata-item"><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
        <div class="metadata-item"><strong>Total Records:</strong> ${config.recordCount}</div>
        ${config.filters ? `<div class="metadata-item"><strong>Filters:</strong> ${config.filters}</div>` : ""}
      </div>

      <table>
        <thead>
          <tr>
            ${config.columns.map(c => `<th${c.align ? ` style="text-align:${c.align}"` : ""}>${c.header}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${config.rows
            .map(
              row => `
            <tr>
              ${row
                .map((cell, idx) => {
                  const align = config.columns[idx]?.align;
                  return `<td${align ? ` style="text-align:${align}"` : ""}>${cell == null ? "" : String(cell)}</td>`;
                })
                .join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <div>Confidential — ${company}</div>
        <img class="footer-logo" src="${logoSrc}" alt="MSF Logo" onerror="this.style.display='none'" />
        <div>Printed from ${system}</div>
      </div>

      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
