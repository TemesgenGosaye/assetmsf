import type { HandoverReceipt } from "@/services/houseHandoverReceipt";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const MSF_LOGO_URL = "/msf_logo.jpg";

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function esc(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dotVal(val: string, len = 180): string {
  return `<span style="display:inline-block;min-width:${len}px;border-bottom:1px dotted #64748b;font-weight:600;color:#0f172a;padding:0 4px;">${esc(val)}</span>`;
}

function getOfficialStampHTML(statusText = "VERIFIED"): string {
  return `
    <div style="position: absolute; right: 45px; bottom: 25px; width: 300px; height: 300px; pointer-events: none; opacity: 0.92; transform: rotate(-4deg); z-index: 50;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="300" height="300">
        <defs>
          <path id="topArc" d="M 155,500 A 345,345 0 0,1 845,500" fill="none"/>
          <path id="bottomArc" d="M 155,500 A 345,345 0 0,0 845,500" fill="none"/>
        </defs>
        <circle cx="500" cy="500" r="455" fill="none" stroke="#172B4D" stroke-width="18"/>
        <circle cx="500" cy="500" r="425" fill="none" stroke="#172B4D" stroke-width="5"/>
        <circle cx="500" cy="500" r="340" fill="none" stroke="#172B4D" stroke-width="8"/>
        <circle cx="500" cy="500" r="315" fill="none" stroke="#172B4D" stroke-width="5" stroke-dasharray="18 14"/>
        <text fill="#172B4D" font-family="Arial, Helvetica, sans-serif" font-size="55" font-weight="700" letter-spacing="2">
          <textPath href="#topArc" startOffset="50%" text-anchor="middle">METAHARA SUGAR FACTORY</textPath>
        </text>
        <text fill="#172B4D" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" letter-spacing="1">
          <textPath href="#bottomArc" startOffset="50%" text-anchor="middle">FACILITY &amp; HOUSE ADMINISTRATION</textPath>
        </text>
        <circle cx="150" cy="500" r="12" fill="#172B4D"/>
        <circle cx="850" cy="500" r="12" fill="#172B4D"/>
        <text x="500" y="430" text-anchor="middle" fill="#172B4D" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="800" letter-spacing="12">M.S.F.</text>
        <line x1="300" y1="470" x2="700" y2="470" stroke="#172B4D" stroke-width="5"/>
        <circle cx="500" cy="470" r="8" fill="#172B4D"/>
        <text x="500" y="545" text-anchor="middle" fill="#172B4D" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700">FACILITY &amp; HOUSE</text>
        <text x="500" y="590" text-anchor="middle" fill="#172B4D" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700">ADMINISTRATION</text>
        <line x1="300" y1="630" x2="700" y2="630" stroke="#172B4D" stroke-width="5"/>
        <circle cx="500" cy="630" r="8" fill="#172B4D"/>
        <text x="500" y="705" text-anchor="middle" fill="#172B4D" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" letter-spacing="2">${esc(statusText)}</text>
        <text x="500" y="785" text-anchor="middle" fill="#172B4D" font-family="Arial, Helvetica, sans-serif" font-size="55">★</text>
      </svg>
    </div>
  `;
}

function buildReceiptHTML(r: HandoverReceipt): string {
  const formNo = esc(r.doc_number || "OF/MSF/HRSM/291");
  const issueNo = "2";
  const pageNo = "Page 1 of 1";
  const empName = r.employee_name || "—";
  const empId = r.employee_id || "—";
  const houseNo = r.house_number || "—";
  const houseLoc = r.house_location || "—";
  const houseType = r.house_type || "—";
  const handoverDate = fmtDate(r.handover_date || r.created_at);
  const condition = r.overall_condition || "Good";
  const notes = r.notes || "None";
  const inspector = r.inspector_name || "Authorized Inspector";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Handover Receipt – ${esc(r.doc_number)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body {
    font-family: "Noto Sans Ethiopic", "Noto Sans", "Segoe UI", Arial, sans-serif;
    font-size: 9.5pt;
    color: #1a1a2e;
    line-height: 1.5;
    background: #fff;
    padding: 10mm 12mm;
    position: relative;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .hdr {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #111;
    margin-bottom: 12mm;
  }
  .hdr td {
    border: 1px solid #111;
    padding: 6px 8px;
    vertical-align: middle;
  }
  .hdr .logo-cell { width: 12%; text-align: center; }
  .hdr .logo-cell img { width: 52px; height: 52px; object-fit: contain; }
  .hdr .name-cell { width: 58%; text-align: center; }
  .hdr .name-cell .amharic-label { font-size: 8.5pt; color: #444; font-weight: 500; }
  .hdr .name-cell .amharic-name { font-size: 13pt; font-weight: 700; color: #0f172a; line-height: 1.2; margin-top: 1px; }
  .hdr .name-cell .english-name { font-size: 10.5pt; font-weight: 700; color: #1e293b; letter-spacing: 0.3px; }
  .hdr .meta-cell { width: 30%; font-size: 8.5pt; color: #1e293b; line-height: 1.4; padding: 4px 6px; }
  .hdr .meta-cell div { display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding: 1px 0; }
  .hdr .meta-cell div:last-child { border-bottom: none; }

  .title-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #111;
    margin-bottom: 16px;
    background: #f8fafc;
  }
  .title-table td {
    border: 1px solid #111;
    padding: 6px 12px;
    text-align: center;
    font-weight: 700;
    font-size: 11pt;
  }
  .body-section {
    margin-bottom: 20px;
    font-size: 10pt;
    line-height: 2.1;
    text-align: justify;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #111;
    margin-bottom: 20px;
    font-size: 9pt;
  }
  .items-table th, .items-table td {
    border: 1px solid #111;
    padding: 6px 8px;
    text-align: left;
  }
  .items-table th { background: #f1f5f9; font-weight: 700; }
  
  .signature-section {
    margin-top: 30px;
    width: 100%;
    display: flex;
    justify-content: space-between;
  }
  .signature-box {
    text-align: left;
    width: 220px;
    font-size: 9.5pt;
    line-height: 1.5;
  }
  .signature-box .title { font-weight: 700; margin-bottom: 2px; }
  .signature-box .name { font-weight: 700; color: #0f172a; }

  .footer-banner {
    margin-top: 30px;
    border-top: 1.5px solid #111;
    border-bottom: 1.5px solid #111;
    text-align: center;
    padding: 6px;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: #f1f5f9;
  }
</style>
</head>
<body>

  <!-- OFFICIAL STAMP WATERMARK / OVERLAY -->
  ${getOfficialStampHTML("VERIFIED")}

  <!-- HEADER -->
  <table class="hdr">
    <tr>
      <td class="logo-cell">
        <img src="${MSF_LOGO_URL}" alt="MSF Logo" onerror="this.style.display='none'" />
      </td>
      <td class="name-cell">
        <div class="amharic-label">የድርጅቱ ስም / Company Name:</div>
        <div class="amharic-name">መታሐራ ስኳር ፋብሪካ</div>
        <div class="english-name">METAHARA SUGAR FACTORY</div>
      </td>
      <td class="meta-cell">
        <div><span>Form No:</span><strong>${formNo}</strong></div>
        <div><span>Issue No:</span><strong>${issueNo}</strong></div>
        <div><span>Page:</span><strong>${pageNo}</strong></div>
      </td>
    </tr>
  </table>

  <!-- TITLE TABLE -->
  <table class="title-table">
    <tr>
      <td>የቤ.ት ርክክብ ማረጋገጫ ፎርም (House Handover & Receipt Form)</td>
    </tr>
  </table>

  <!-- BODY CONTENT -->
  <div class="body-section">
    <p>
      <strong>ለሰው ሃብት ሥራ አመራር ቡድን</strong><br/>
      <strong>መድረክ፡</strong>
    </p>
    <br/>
    <p>
      ይህ መረጃ የተሰጠው አቶ/ወ/ሮ ${dotVal(empName, 220)} (Emp ID: ${dotVal(empId, 100)}) ከድርጅቱ ጋር
      ባላቸው የሥራ ግንኙነት መሠረት የድርጅቱ ቤት ቁጥር ${dotVal(houseNo, 90)} (አይነት: ${dotVal(houseType, 60)}, ቦታ: ${dotVal(houseLoc, 100)}) በዕለቱ ${dotVal(handoverDate, 120)} ርክክብ የተፈጸመ መሆኑን እናረጋግጣለን።
    </p>
    <br/>
    <p>
      የቤቱ አጠቃላይ ሁኔታ (${dotVal(condition, 140)}) ሆኖ ተረክበዋል። ልዩ ማስታወሻዎች: ${dotVal(notes, 250)}።
    </p>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 10%;">ተ.ቁ</th>
        <th style="width: 45%;">የንብረት ዓይነት / Description</th>
        <th style="width: 25%;">ሁኔታ / Condition</th>
        <th style="width: 20%;">ምልከታ / Remarks</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>መኖሪያ ቤት ቁጥር (House Unit ${esc(houseNo)})</td>
        <td>${esc(condition)}</td>
        <td>የተረጋገጠ</td>
      </tr>
      <tr>
        <td>2</td>
        <td> በሮችና መስኮቶች (Doors & Windows)</td>
        <td>ጥሩ (Good)</td>
        <td>—</td>
      </tr>
      <tr>
        <td>3</td>
        <td> የኤሌክትሪክና የውሃ መስመሮች (Electrical & Plumbing)</td>
        <td>ጥሩ (Good)</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>

  <!-- SIGNATURES -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="title">የተረከበው ሠራተኛ (Employee)</div>
      <br/>
      <div class="name">${esc(empName)}</div>
      <div style="border-bottom: 1px solid #111; margin-top: 24px;"></div>
    </div>
    <div class="signature-box">
      <div class="title">ያረጋገጠው/የተቆጣጠረው (Inspector)</div>
      <br/>
      <div class="name">${esc(inspector)}</div>
      <div style="border-bottom: 1px solid #111; margin-top: 24px;"></div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer-banner">
    PLEASE MAKE SURE THAT THIS IS THE CORRECT ISSUE BEFORE USE
  </div>

</body>
</html>`;
}

export function printHandoverReceipt(receipt: HandoverReceipt): void {
  const html = buildReceiptHTML(receipt);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export async function downloadHandoverReceiptPdf(receipt: HandoverReceipt): Promise<void> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.minHeight = "297mm";
  container.style.background = "#ffffff";
  container.style.zIndex = "-1000";

  const iframe = document.createElement("iframe");
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "none";
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";

  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error("Unable to access iframe document");

    iframeDoc.open();
    iframeDoc.write(buildReceiptHTML(receipt));
    iframeDoc.close();

    await new Promise((resolve) => setTimeout(resolve, 800));
    if (iframeDoc.fonts) await iframeDoc.fonts.ready;

    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    const safeDocNum = (receipt.doc_number || "receipt").replace(/[/\\?%*:|"<>]/g, "_");
    const safeEmpName = (receipt.employee_name || "employee").replace(/[/\\?%*:|"<>]/g, "_");
    pdf.save(`Handover_Receipt_${safeDocNum}_${safeEmpName}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
