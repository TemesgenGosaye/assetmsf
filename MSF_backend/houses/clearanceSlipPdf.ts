import type { TerminationTransaction } from "@/services/houseApplication";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const MSF_LOGO_URL = `${window.location.origin}/msf_logo.jpg`;

const FORM_NO = "OF/MSF/HRSM/293";
const ISSUE_NO = "2";
const PAGE_NO = "Page 1 of 1";

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function esc(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dotVal(value: unknown, width = 180): string {
  const safeValue =
    value === null || value === undefined || String(value).trim() === ""
      ? "—"
      : String(value);

  return `
    <span
      class="field-value"
      style="min-width:${width}px"
    >
      ${esc(safeValue)}
    </span>
  `;
}

function money(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "ETB 0.00";
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return `ETB ${numeric.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `ETB ${esc(value)}`;
}

function safeFilename(value: string): string {
  return value
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
}

function getOfficialStampHTML(
  statusText: "VERIFIED" | "APPROVED" = "VERIFIED",
): string {
  const ink = "#292927";

  return `
    <div class="official-stamp">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
        aria-label="Metahara Sugar Factory official verification stamp"
      >
        <defs>
          <path
            id="stampTopArc"
            d="M 175 500 A 325 325 0 0 1 825 500"
            fill="none"
          />
          <path
            id="stampBottomArc"
            d="M 195 650 A 310 310 0 0 0 805 650"
            fill="none"
          />
          <filter id="stampRoughness">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="2"
              seed="8"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter id="inkFade">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.035"
              numOctaves="2"
              seed="14"
              result="noise"
            />
            <feComposite
              in="SourceGraphic"
              in2="noise"
              operator="arithmetic"
              k1="0.45"
              k2="0.8"
              k3="0.1"
              k4="0"
            />
          </filter>
        </defs>

        <g
          fill="none"
          stroke="${ink}"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#stampRoughness)"
        >
          <circle cx="500" cy="500" r="450" stroke-width="19" />
          <circle cx="500" cy="500" r="425" stroke-width="6" />
          <circle cx="500" cy="500" r="340" stroke-width="8" />
          <circle
            cx="500"
            cy="500"
            r="365"
            stroke-width="2.5"
            stroke-dasharray="5 8 18 5 3 10"
            opacity="0.75"
          />
        </g>

        <text
          fill="${ink}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="49"
          font-weight="800"
          letter-spacing="2"
          filter="url(#inkFade)"
        >
          <textPath
            href="#stampTopArc"
            startOffset="50%"
            text-anchor="middle"
          >
            METAHARA SUGAR FACTORY
          </textPath>
        </text>

        <text
          fill="${ink}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="31"
          font-weight="700"
          letter-spacing="1.2"
          filter="url(#inkFade)"
        >
          <textPath
            href="#stampBottomArc"
            startOffset="50%"
            text-anchor="middle"
          >
            FACILITY &amp; HOUSE ADMINISTRATION
          </textPath>
        </text>

        <g fill="${ink}">
          <circle cx="165" cy="500" r="11" />
          <circle cx="835" cy="500" r="11" />
        </g>

        <g
          fill="${ink}"
          stroke="${ink}"
          filter="url(#inkFade)"
        >
          <text
            x="500"
            y="330"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="83"
            font-weight="900"
            letter-spacing="12"
            stroke="none"
          >
            M.S.F.
          </text>

          <line
            x1="330"
            y1="365"
            x2="670"
            y2="365"
            stroke-width="6"
          />

          <circle
            cx="500"
            cy="365"
            r="8"
            stroke="none"
          />

          <text
            x="500"
            y="440"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="35"
            font-weight="800"
            letter-spacing="1.2"
            stroke="none"
          >
            FACILITY &amp; HOUSE
          </text>

          <text
            x="500"
            y="486"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="35"
            font-weight="800"
            letter-spacing="1.2"
            stroke="none"
          >
            ADMINISTRATION
          </text>

          <line
            x1="330"
            y1="520"
            x2="670"
            y2="520"
            stroke-width="6"
          />

          <circle
            cx="500"
            cy="520"
            r="8"
            stroke="none"
          />

          <text
            x="500"
            y="590"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="52"
            font-weight="900"
            letter-spacing="4"
            stroke="none"
          >
            ${esc(statusText)}
          </text>

          <text
            x="500"
            y="665"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="48"
            stroke="none"
          >
            ★
          </text>
        </g>

        <g
          fill="${ink}"
          opacity="0.35"
        >
          <circle cx="270" cy="250" r="2.5"/>
          <circle cx="310" cy="735" r="2"/>
          <circle cx="700" cy="275" r="2"/>
          <circle cx="760" cy="690" r="2.5"/>
          <circle cx="235" cy="590" r="1.8"/>
          <circle cx="790" cy="570" r="1.7"/>
          <circle cx="400" cy="180" r="1.5"/>
          <circle cx="620" cy="805" r="2"/>
        </g>
      </svg>
    </div>
  `;
}

function buildClearanceSlipHTML(
  transaction: TerminationTransaction,
): string {
  const employeeName = transaction.employee_name || "—";
  const houseNo = transaction.house_number || "—";
  const terminationNo = transaction.termination_no || "—";
  const caseName = transaction.case_name || transaction.case_category || "—";
  const effectiveDate = fmtDate(transaction.effective_date);
  const damageCosts = money(transaction.damage_costs);
  const outstandingIssues = transaction.outstanding_issues || "None";
  const statusLabel = transaction.status === "Completed" ? "APPROVED" : "VERIFIED";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Housing Clearance &amp; Handover Slip - ${esc(terminationNo)}</title>
<style>
@page {
  size: A4 portrait;
  margin: 0;
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body {
  width: 210mm;
  min-height: 297mm;
}
body {
  position: relative;
  background: #ffffff;
  color: #111827;
  font-family: "Noto Sans Ethiopic", "Noto Sans", "Segoe UI", Arial, Helvetica, sans-serif;
  font-size: 9.5pt;
  line-height: 1.55;
  padding: 10mm 12mm 9mm 12mm;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.official-stamp {
  position: absolute;
  right: 13mm;
  bottom: 18mm;
  width: 47mm;
  height: 47mm;
  z-index: 50;
  pointer-events: none;
  opacity: 0.78;
  transform: rotate(-4.2deg);
  mix-blend-mode: multiply;
  filter: contrast(1.12) saturate(0.15);
}
.official-stamp svg {
  display: block;
  width: 100%;
  height: 100%;
}

.document-header {
  width: 100%;
  border-collapse: collapse;
  border: 1.5px solid #111827;
  margin-bottom: 7mm;
}
.document-header td {
  border: 1px solid #111827;
  vertical-align: middle;
  padding: 5px 7px;
}
.logo-cell {
  width: 14%;
  text-align: center;
}
.logo-cell img {
  width: 52px;
  height: 52px;
  object-fit: contain;
  display: inline-block;
}
.company-cell {
  width: 56%;
  text-align: center;
  line-height: 1.25;
}
.company-label {
  font-size: 7.5pt;
  color: #475569;
  font-weight: 600;
  margin-bottom: 2px;
}
.company-amharic {
  font-size: 13pt;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 2px;
}
.company-english {
  font-size: 10.5pt;
  font-weight: 800;
  letter-spacing: 0.35px;
  color: #1e293b;
}
.document-meta {
  width: 30%;
  font-size: 8pt;
  color: #1e293b;
}
.document-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
  border-bottom: 1px solid #cbd5e1;
}
.document-meta-row:last-child {
  border-bottom: none;
}
.document-meta-label {
  color: #64748b;
  font-weight: 500;
}
.document-meta-value {
  color: #0f172a;
  font-weight: 800;
  text-align: right;
}

.title-box {
  width: 100%;
  border: 1.5px solid #111827;
  background: #f8fafc;
  text-align: center;
  padding: 7px 10px;
  margin-bottom: 8mm;
}
.title-amharic {
  font-size: 10.5pt;
  font-weight: 800;
  color: #111827;
  line-height: 1.45;
}
.title-english {
  font-size: 9pt;
  font-weight: 700;
  color: #475569;
  margin-top: 2px;
  letter-spacing: 0.25px;
}

.recipient-block {
  margin-bottom: 6mm;
  font-size: 10pt;
  line-height: 1.7;
}
.recipient-title {
  font-weight: 800;
  color: #111827;
}
.recipient-platform {
  font-weight: 700;
  color: #334155;
}

.body-section {
  font-size: 10.2pt;
  line-height: 2.05;
  text-align: justify;
  color: #111827;
}
.body-section p {
  margin-bottom: 5mm;
}

.field-value {
  display: inline-block;
  border-bottom: 1px dotted #475569;
  padding: 0 4px 1px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  vertical-align: baseline;
}

.transaction-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 4mm;
  margin-bottom: 8mm;
  font-size: 8.8pt;
}
.transaction-table th,
.transaction-table td {
  border: 1px solid #94a3b8;
  padding: 5px 7px;
  text-align: left;
}
.transaction-table th {
  width: 22%;
  background: #f1f5f9;
  color: #334155;
  font-weight: 800;
}
.transaction-table td {
  color: #0f172a;
  font-weight: 600;
}

.signature-section {
  margin-top: 12mm;
  display: flex;
  justify-content: flex-end;
  page-break-inside: avoid;
}
.signature-box {
  width: 72mm;
  font-size: 9.5pt;
  line-height: 1.5;
}
.signature-title {
  font-weight: 800;
  margin-bottom: 9mm;
}
.signature-name {
  font-weight: 800;
  color: #0f172a;
  border-bottom: 1px solid #334155;
  padding-bottom: 2px;
  margin-bottom: 2px;
}
.signature-role {
  color: #475569;
  font-size: 8.5pt;
}

.cc-section {
  margin-top: 9mm;
  padding-top: 5mm;
  border-top: 1px dashed #94a3b8;
  font-size: 8.8pt;
  line-height: 1.65;
}
.cc-title {
  font-weight: 800;
  margin-bottom: 1mm;
}

.footer-banner {
  position: absolute;
  left: 12mm;
  right: 12mm;
  bottom: 7mm;
  border-top: 1px solid #111827;
  border-bottom: 1px solid #111827;
  padding: 4px 6px;
  text-align: center;
  font-size: 7.5pt;
  font-weight: 800;
  letter-spacing: 0.45px;
  color: #1e293b;
  background: #f8fafc;
}
</style>
</head>
<body>

  ${getOfficialStampHTML(statusLabel)}

  <table class="document-header">
    <tr>
      <td class="logo-cell">
        <img
          src="${MSF_LOGO_URL}"
          alt="Metahara Sugar Factory Logo"
          onerror="this.style.display='none'"
        />
      </td>
      <td class="company-cell">
        <div class="company-label">የድርጅቱ ስም / Company Name</div>
        <div class="company-amharic">መታሐራ ስኳር ፋብሪካ</div>
        <div class="company-english">METAHARA SUGAR FACTORY</div>
      </td>
      <td class="document-meta">
        <div class="document-meta-row">
          <span class="document-meta-label">Form No:</span>
          <span class="document-meta-value">${esc(FORM_NO)}</span>
        </div>
        <div class="document-meta-row">
          <span class="document-meta-label">Issue No:</span>
          <span class="document-meta-value">${esc(ISSUE_NO)}</span>
        </div>
        <div class="document-meta-row">
          <span class="document-meta-label">Page:</span>
          <span class="document-meta-value">${esc(PAGE_NO)}</span>
        </div>
      </td>
    </tr>
  </table>

  <div class="title-box">
    <div class="title-amharic">የቤ.ት ርክክብ ማረጋገጫ እና ክሊራንስ ፎርም</div>
    <div class="title-english">HOUSING CLEARANCE &amp; HANDOVER SLIP</div>
  </div>

  <div class="recipient-block">
    <div class="recipient-title">ለሰው ሃብት ሥራ አመራር ቡድን</div>
    <div class="recipient-platform">መድረክ፡</div>
  </div>

  <div class="body-section">
    <p>
      ይህ መረጃ የተሰጠው አቶ/ወ/ሮ
      ${dotVal(employeeName, 210)}
      ከድርጅቱ ጋር የነበራቸው የሥራ ሁኔታ
      ${dotVal(caseName, 125)}
      በመቋረጡ/በመዘዋወሩ የድርጅቱ ቤት ቁጥር
      ${dotVal(houseNo, 85)}
      ያስረከቡ መሆናቸውን እናረጋግጣለን።
    </p>
    <p>
      በመሆኑም ሲያስረክብ የተረጋገጠው የጉዳት ግምገማ ድምር
      ${dotVal(damageCosts, 105)}
      እና ቀሪ ጉዳዮች
      ${dotVal(outstandingIssues, 170)}
      መኖራቸውን/አለመኖራቸውን አረጋግጠን ንብረቱ ጸድቆ ተረክበናል።
    </p>
  </div>

  <table class="transaction-table">
    <tbody>
      <tr>
        <th>Termination Reference</th>
        <td>${esc(terminationNo)}</td>
        <th>Effective Date</th>
        <td>${esc(effectiveDate)}</td>
      </tr>
      <tr>
        <th>Employee</th>
        <td>${esc(employeeName)}</td>
        <th>House No.</th>
        <td>${esc(houseNo)}</td>
      </tr>
      <tr>
        <th>Termination Case</th>
        <td>${esc(caseName)}</td>
        <th>Clearance Status</th>
        <td>${esc(statusLabel)}</td>
      </tr>
    </tbody>
  </table>

  <div class="signature-section">
    <div class="signature-box">
      <div class="title">ከሰላምታ ጋር</div>
      <div class="name">ሰቦታ ጀርቤ</div>
      <div class="role">የፋ.ሲ.ቲ ማኔጅመንት ቡድኑ መሪ</div>
    </div>
  </div>

  <div class="cc-section">
    <div class="cc-title">ግልባጭ:-</div>
    <div>ለቤቶች አስተዳደር መድረክ</div>
    <div>Termination Ref: <strong>${esc(terminationNo)}</strong> &nbsp; | &nbsp; Effective Date: <strong>${effectiveDate}</strong></div>
  </div>

  <div class="footer-banner">
    PLEASE MAKE SURE THAT THIS IS THE CORRECT ISSUE BEFORE USE
  </div>

</body>
</html>`;
}

export function printClearanceSlip(
  transaction: TerminationTransaction,
): void {
  const html = buildClearanceSlipHTML(transaction);
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) {
    throw new Error("Unable to open print window. Please allow pop-ups for this application.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };
}

export async function downloadClearanceSlipPdf(
  transaction: TerminationTransaction,
): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-100000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  try {
    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) {
      throw new Error("Unable to access PDF rendering document.");
    }
    iframeDocument.open();
    iframeDocument.write(buildClearanceSlipHTML(transaction));
    iframeDocument.close();

    await wait(500);
    if (iframeDocument.fonts) {
      await iframeDocument.fonts.ready;
    }
    await waitForImages(iframeDocument);
    await wait(300);

    const body = iframeDocument.body;
    if (!body) {
      throw new Error("PDF document body was not created.");
    }

    const canvas = await html2canvas(body, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 15000,
      width: body.scrollWidth,
      height: body.scrollHeight,
      windowWidth: body.scrollWidth,
      windowHeight: body.scrollHeight,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("PDF rendering produced an empty canvas.");
    }

    const imageData = canvas.toDataURL("image/jpeg", 0.97);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageRatio = canvas.height / canvas.width;

    let renderWidth = pageWidth;
    let renderHeight = renderWidth * imageRatio;

    if (renderHeight > pageHeight) {
      renderHeight = pageHeight;
      renderWidth = renderHeight / imageRatio;
    }

    const x = (pageWidth - renderWidth) / 2;
    const y = 0;

    pdf.addImage(imageData, "JPEG", x, y, renderWidth, renderHeight, undefined, "FAST");

    const terminationNo = safeFilename(transaction.termination_no || "termination");
    const employee = safeFilename(transaction.employee_name || "employee");
    const filename = `MSF_Housing_Clearance_${terminationNo}_${employee}.pdf`;

    pdf.save(filename);
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForImages(document: Document): Promise<void> {
  const images = Array.from(document.images);
  if (images.length === 0) {
    return;
  }
  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const finish = () => { resolve(); };
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        setTimeout(resolve, 10000);
      });
    }),
  );
}

export function getClearanceSlipHTML(
  transaction: TerminationTransaction,
): string {
  return buildClearanceSlipHTML(transaction);
}
