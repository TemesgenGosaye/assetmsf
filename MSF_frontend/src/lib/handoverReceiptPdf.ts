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

/**
 * Deterministic pseudo-random generator seeded from a string, used so the
 * "worn ink" texture and stamp rotation are stable per document (same
 * receipt reference always renders the same stamp) instead of jittering
 * between renders.
 */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** A short, human-legible verification code derived from the document number. */
function verificationCode(docNo: string): string {
  let sum = 0;
  for (let i = 0; i < docNo.length; i++) sum = (sum * 31 + docNo.charCodeAt(i)) >>> 0;
  const code = (sum % 900000) + 100000;
  return `MSF-${code}`;
}

/**
 * A realistic, hand-stamped-looking circular ink seal.
 * Uses feTurbulence + feDisplacementMap to break up the clean vector edges
 * (real rubber stamps are never perfectly crisp), plus a mottled opacity
 * mask so the ink reads as uneven/worn rather than a flat vector fill —
 * and an adjustable "date band" like a genuine dater stamp.
 *
 * Bilingual, matching a real Ethiopian company/office seal: Amharic
 * company name on the top arc, English on the bottom arc, and the
 * originating office named in both languages in the center.
 */
function getOfficialStampHTML(statusText = "VERIFIED", dateLabel = "", refCode = ""): string {
  const rand = seededRandom(refCode || statusText);
  const rotation = (-6 + rand() * 3).toFixed(1);
  const inkColor = "#1c355e";
  const amharicFont = "'Noto Serif Ethiopic', 'Noto Sans Ethiopic', Georgia, serif";
  const latinFont = "Georgia, 'Times New Roman', serif";

  return `
    <div style="position: absolute; right: 42px; bottom: 22px; width: 280px; height: 280px; pointer-events: none; z-index: 50;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="280" height="280"
           style="transform: rotate(${rotation}deg);">
        <defs>
          <!--
            These paths are true circles concentric with the seal (radius
            385, same center as everything else at 500,500). That keeps the
            curved text riding evenly in the band between the outer rings
            (338–428) at every point along the arc, so it can never dip
            inward and collide with the inner content.
          -->
          <path id="topArc" d="M 115,500 A 385,385 0 0,1 885,500" fill="none"/>
          <path id="bottomArc" d="M 115,500 A 385,385 0 0,0 885,500" fill="none"/>

          <!-- Distressed / hand-inked edge texture -->
          <filter id="stampTexture" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.045" numOctaves="3" seed="11" result="edgeNoise"/>
            <feDisplacementMap in="SourceGraphic" in2="edgeNoise" scale="7" xChannelSelector="R" yChannelSelector="G"/>
          </filter>

          <!-- Uneven ink saturation (worn / partially re-inked look) -->
          <filter id="inkMottle" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="4" result="grain"/>
            <feColorMatrix in="grain" type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.35 0.35 0.35 0 -0.14" result="grainAlpha"/>
            <feComposite in="SourceGraphic" in2="grainAlpha" operator="out" result="worn"/>
            <feMerge>
              <feMergeNode in="SourceGraphic"/>
              <feMergeNode in="worn"/>
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#stampTexture)" fill="none" stroke="${inkColor}">
          <g filter="url(#inkMottle)">
            <!-- outer ring system -->
            <circle cx="500" cy="500" r="460" stroke-width="20"/>
            <circle cx="500" cy="500" r="428" stroke-width="4"/>
            <circle cx="500" cy="500" r="338" stroke-width="7"/>
            <circle cx="500" cy="500" r="312" stroke-width="4" stroke-dasharray="16 13"/>

            <!-- bilingual seal: Amharic company name (top arc) + Amharic office name (bottom arc) -->
            <text fill="${inkColor}" stroke="none" font-family="${amharicFont}" font-size="52" font-weight="700" letter-spacing="2">
              <textPath href="#topArc" startOffset="50%" text-anchor="middle">መተሐራ ስኳር ፋብሪካ</textPath>
            </text>
            <text fill="${inkColor}" stroke="none" font-family="${amharicFont}" font-size="34" font-weight="700" letter-spacing="1">
              <textPath href="#bottomArc" startOffset="50%" text-anchor="middle">የፋሲሊቲ ማኔጅመንት ጽ/ቤት</textPath>
            </text>

            <circle cx="115" cy="500" r="10" fill="${inkColor}" stroke="none"/>
            <circle cx="885" cy="500" r="10" fill="${inkColor}" stroke="none"/>

            <text x="500" y="415" text-anchor="middle" fill="${inkColor}" stroke="none" font-family="${latinFont}" font-size="60" font-weight="800" letter-spacing="9">M.S.F.</text>

            <line x1="285" y1="452" x2="715" y2="452" stroke-width="4"/>
            <circle cx="500" cy="452" r="6" fill="${inkColor}" stroke="none"/>

            <!-- English lines, center: company name + office name -->
            <text x="500" y="500" text-anchor="middle" fill="${inkColor}" stroke="none" font-family="${latinFont}" font-size="23" font-weight="700" letter-spacing="1">METAHARA SUGAR FACTORY</text>
            <text x="500" y="538" text-anchor="middle" fill="${inkColor}" stroke="none" font-family="${latinFont}" font-size="21" font-weight="700" letter-spacing="1">FACILITY MANAGEMENT OFFICE</text>

            <line x1="285" y1="568" x2="715" y2="568" stroke-width="4"/>
            <circle cx="500" cy="568" r="6" fill="${inkColor}" stroke="none"/>

            <!-- adjustable date band, like a genuine dater stamp -->
            <rect x="360" y="588" width="280" height="58" fill="none" stroke="${inkColor}" stroke-width="3"/>
            <text x="500" y="630" text-anchor="middle" fill="${inkColor}" stroke="none" font-family="${latinFont}" font-size="34" font-weight="700" letter-spacing="1">${esc(dateLabel)}</text>

            <text x="500" y="705" text-anchor="middle" fill="${inkColor}" stroke="none" font-family="${latinFont}" font-size="40" font-weight="800" letter-spacing="2">${esc(statusText)}</text>

            <text x="500" y="750" text-anchor="middle" fill="${inkColor}" stroke="none" font-family="${latinFont}" font-size="19" font-weight="600" letter-spacing="1">REF. ${esc(refCode)}</text>
          </g>
        </g>
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
  const statusLabel = "VERIFIED";
  const refCode = verificationCode(r.doc_number || houseNo || empName);
  const stampDate = handoverDate.toUpperCase();
  const issuedOn = fmtDate(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Handover Receipt – ${esc(r.doc_number)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;600;700&family=Noto+Serif+Ethiopic:wght@500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body {
    font-family: "Source Serif 4", "Noto Sans Ethiopic", "Noto Sans", Georgia, serif;
    font-size: 9.5pt;
    color: #1a1a2e;
    line-height: 1.6;
    background: #fff;
    padding: 10mm 12mm 6mm;
    position: relative;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---- Brand accent bar (matches EAMS navy/brass identity) ---- */
  .accent-bar {
    height: 4px;
    width: 100%;
    background: linear-gradient(90deg, #0a1f33 0%, #0a1f33 70%, #e8c874 100%);
    margin-bottom: 4mm;
  }

  .hdr {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #111;
    margin-bottom: 6mm;
  }
  .hdr td {
    border: 1px solid #111;
    padding: 7px 9px;
    vertical-align: middle;
  }
  .hdr .logo-cell { width: 12%; text-align: center; }
  .hdr .logo-cell img { width: 54px; height: 54px; object-fit: contain; }
  .hdr .name-cell { width: 56%; text-align: center; }
  .hdr .name-cell .amharic-label { font-size: 8.5pt; color: #475569; font-weight: 500; font-family: "Noto Sans Ethiopic", sans-serif; }
  .hdr .name-cell .amharic-name { font-family: "Noto Serif Ethiopic", serif; font-size: 14pt; font-weight: 700; color: #0a1f33; line-height: 1.25; margin-top: 1px; }
  .hdr .name-cell .english-name { font-size: 10pt; font-weight: 700; color: #1e293b; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 1px; }
  .hdr .meta-cell { width: 32%; font-size: 8pt; color: #1e293b; line-height: 1.5; padding: 5px 8px; font-family: "Noto Sans Ethiopic", sans-serif; }
  .hdr .meta-cell div { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid #e2e8f0; padding: 1.5px 0; }
  .hdr .meta-cell div:last-child { border-bottom: none; }
  .hdr .meta-cell span:first-child { color: #64748b; }

  .title-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #111;
    margin-bottom: 5mm;
    background: #f8fafc;
  }
  .title-table td {
    border: 1px solid #111;
    padding: 7px 12px;
    text-align: center;
    font-weight: 700;
    font-size: 11pt;
    font-family: "Noto Sans Ethiopic", sans-serif;
  }

  .ref-strip {
    display: flex;
    justify-content: space-between;
    font-size: 8.3pt;
    color: #334155;
    border-bottom: 1px dashed #cbd5e1;
    padding-bottom: 4px;
    margin-bottom: 6mm;
    font-family: "Noto Sans Ethiopic", sans-serif;
  }
  .ref-strip b { color: #0a1f33; }

  .body-section {
    margin-bottom: 7mm;
    font-family: "Noto Sans Ethiopic", sans-serif;
    font-size: 10pt;
    line-height: 2.1;
    text-align: justify;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #111;
    margin-bottom: 7mm;
    font-size: 9pt;
    font-family: "Noto Sans Ethiopic", sans-serif;
  }
  .items-table th, .items-table td {
    border: 1px solid #111;
    padding: 6px 8px;
    text-align: left;
  }
  .items-table th { background: #f1f5f9; font-weight: 700; }

  .signature-section {
    margin-top: 12mm;
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-family: "Noto Sans Ethiopic", sans-serif;
  }
  .signature-box {
    text-align: left;
    width: 240px;
    font-size: 9.5pt;
    line-height: 1.5;
  }
  .signature-box .title {
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #64748b;
    font-size: 7.8pt;
    font-weight: 700;
    margin-bottom: 18px;
  }
  .signature-box .name { font-weight: 700; color: #0a1f33; font-family: "Noto Serif Ethiopic", serif; }
  .signature-box .sign-line { border-top: 1px solid #111; margin-top: 26px; padding-top: 4px; }
  .signature-box .date-field { color: #94a3b8; font-size: 7.8pt; margin-top: 6px; }

  .cc-section {
    margin-top: 9mm;
    font-size: 9.3pt;
    border-top: 1px dashed #cbd5e1;
    padding-top: 9px;
    font-family: "Noto Sans Ethiopic", sans-serif;
  }
  .cc-section .cc-title { font-weight: 700; margin-bottom: 3px; }

  .footer-banner {
    margin-top: 8mm;
    border-top: 1.5px solid #111;
    border-bottom: 1.5px solid #111;
    text-align: center;
    padding: 6px;
    font-size: 8.2pt;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    background: #f1f5f9;
    font-family: "Noto Sans Ethiopic", sans-serif;
  }
</style>
</head>
<body>

  <div class="accent-bar"></div>

  <!-- OFFICIAL STAMP WATERMARK / OVERLAY -->
  ${getOfficialStampHTML(statusLabel, stampDate, refCode)}

  <!-- HEADER -->
  <table class="hdr">
    <tr>
      <td class="logo-cell">
        <img src="${MSF_LOGO_URL}" alt="MSF Logo" onerror="this.style.display='none'" />
      </td>
      <td class="name-cell">
        <div class="amharic-label">የድርጅቱ ስም / Company Name:</div>
        <div class="amharic-name">መታሐራ ስኳር ፋብሪካ</div>
        <div class="english-name">Metahara Sugar Factory</div>
      </td>
      <td class="meta-cell">
        <div><span>Form No.</span><strong>${formNo}</strong></div>
        <div><span>Issue No.</span><strong>${issueNo}</strong></div>
        <div><span>Page</span><strong>${pageNo}</strong></div>
        <div><span>Issued</span><strong>${issuedOn}</strong></div>
      </td>
    </tr>
  </table>

  <!-- TITLE TABLE -->
  <table class="title-table">
    <tr>
      <td>የቤ.ት ርክክብ ማረጋገጫ ፎርም (House Handover &amp; Receipt Form)</td>
    </tr>
  </table>

  <div class="ref-strip">
    <span>Document No: <b>${formNo}</b></span>
    <span>House No: <b>${esc(houseNo)}</b></span>
    <span>Status: <b>${esc(statusLabel)}</b></span>
  </div>

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
        <td> በሮችና መስኮቶች (Doors &amp; Windows)</td>
        <td>ጥሩ (Good)</td>
        <td>—</td>
      </tr>
      <tr>
        <td>3</td>
        <td> የኤሌክትሪክና የውሃ መስመሮች (Electrical &amp; Plumbing)</td>
        <td>ጥሩ (Good)</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>

  <!-- SIGNATURES -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="title">Received by — Employee</div>
      <div class="sign-line">
        <div class="name">${esc(empName)}</div>
        <div class="date-field">Date: ${esc(handoverDate)}</div>
      </div>
    </div>
    <div class="signature-box">
      <div class="title">Verified by — Inspector</div>
      <div class="sign-line">
        <div class="name">${esc(inspector)}</div>
        <div class="date-field">Date: ______________</div>
      </div>
    </div>
  </div>

  <!-- CC -->
  <div class="cc-section">
    <div class="cc-title">ግልባጭ:-</div>
    <div>ለቤቶች አስተዳደር መድረክ</div>
    <div>Document No: <strong>${formNo}</strong> &nbsp;|&nbsp; Handover Date: <strong>${handoverDate}</strong></div>
  </div>

  <!-- FOOTER -->
  <div class="footer-banner">
    Please make sure this is the correct issue before use
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