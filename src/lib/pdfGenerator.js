/**
 * Weekly PDF Report Generator
 *
 * Arabic in jsPDF: the core fonts (helvetica, times, courier) are Latin-only
 * WinAnsi and have neither Arabic glyphs nor shaping, so doc.text("تقرير")
 * came out as mojibake. Baking a TTF in would still leave us without bidi/RTL
 * handling.
 *
 * Instead we lay the report out as a real RTL DOM node in the app -- the
 * browser shapes Arabic and applies bidi correctly -- rasterise it with
 * html2canvas and place the image into a jsPDF page, sliced across pages when
 * it is taller than one A4 sheet. Every downstream call site keeps working
 * unchanged because we still return a real jsPDF instance.
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import moment from "moment";

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const DOM_WIDTH_PX = 794; // A4 @ 96dpi
const RENDER_SCALE = 2;

const COLORS = {
  accent: "#0d9488",
  primary: "#0f172a",
  muted: "#64748b",
  success: "#16a34a",
  warning: "#ea580c",
  danger: "#dc2626",
  border: "#e2e8f0",
  bg: "#f8fafc",
  white: "#ffffff",
};

const ARABIC_FONT_STACK =
  '"Cairo", "Noto Naskh Arabic", "Readex Pro", "Segoe UI", "Tahoma", "Arial", sans-serif';

// Arabic defaults; the caller may override per language so the report follows
// the UI language instead of being Arabic-only.
const DEFAULT_LABELS = {
  title: "تقرير الأسبوع الصحي",
  adherenceTitle: "تقرير الالتزام بالأدوية",
  taken: "تم أخذها",
  skipped: "تم تخطيها",
  missed: "فائتة",
  pending: "معلقة",
  legendTaken: "تم الأخذ",
  legendSkipped: "تم التخطي",
  legendMissed: "فائت",
  legendPending: "معلق",
  adherenceRate: "معدل الالتزام",
  rateExcellent: "ممتاز! استمر على هذا النحو",
  rateGood: "جيد، يمكن تحسينه",
  ratePoor: "يحتاج اهتمامًا",
  vitalsTitle: "العلامات الحيوية",
  vitalsNone: "لا توجد قراءات مسجلة هذا الأسبوع",
  bloodPressure: "ضغط الدم",
  bloodSugar: "سكر الدم",
  weight: "الوزن",
  lastReading: "آخر قراءة",
  average: "المتوسط",
  detailTitle: "تفاصيل الجرعات اليومية",
  colDate: "التاريخ",
  colTime: "الوقت",
  colMedication: "الدواء",
  colStatus: "الحالة",
  colNote: "ملاحظة",
  statusTaken: "تم الأخذ",
  statusSkipped: "تم التخطي",
  statusMissed: "فائت",
  statusPending: "معلق",
  emptyLogs: "لا توجد جرعات مسجلة في هذه الفترة",
  moreEntries: (n) => `... و ${n} إدخالات أخرى`,
  footer: (when) => `توليد بواسطة رفيق الدواء • ${when}`,
  noRecipient: "بدون اسم",
};

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function buildReportHtml({ doseLogs, vitalSigns, recipientName, weekStart, weekEnd, labels }) {
  const L = { ...DEFAULT_LABELS, ...(labels || {}) };

  const taken = doseLogs.filter((l) => l.status === "taken").length;
  const skipped = doseLogs.filter((l) => l.status === "skipped").length;
  const missed = doseLogs.filter((l) => l.status === "missed").length;
  const pending = doseLogs.filter((l) => l.status === "pending").length;
  const total = doseLogs.length || 1;
  const pct = (n) => Math.round((n / total) * 100);
  const takenPct = pct(taken);
  const skippedPct = pct(skipped);
  const missedPct = pct(missed);
  const pendingPct = pct(pending);

  const dateRange = `${moment(weekStart).format("YYYY/MM/DD")} - ${moment(weekEnd).format("YYYY/MM/DD")}`;

  const card = (label, value, share, color) => `
    <div style="flex:1;border:1px solid ${COLORS.border};border-radius:8px;padding:10px 6px;text-align:center;background:${COLORS.white}">
      <div style="font-size:22px;font-weight:800;color:${color};line-height:1.1">${esc(value)}</div>
      <div style="font-size:11px;color:${COLORS.muted};margin-top:4px">${esc(label)}</div>
      <div style="font-size:12px;font-weight:700;color:${color};margin-top:2px">${esc(share)}%</div>
    </div>`;

  const seg = (share, color) =>
    share <= 0 ? "" : `<div style="width:${share}%;height:10px;background:${color}"></div>`;

  const legend = (label, color) => `
    <div style="display:flex;align-items:center;gap:5px">
      <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${color}"></span>
      <span style="font-size:11px;color:${COLORS.muted}">${esc(label)}</span>
    </div>`;

  const rateText = takenPct >= 80 ? L.rateExcellent : takenPct >= 50 ? L.rateGood : L.ratePoor;
  const rateMark = takenPct >= 80 ? "✓" : takenPct >= 50 ? "!" : "✗";

  const grouped = {};
  (vitalSigns || []).forEach((v) => {
    if (!grouped[v.type]) grouped[v.type] = [];
    grouped[v.type].push(v);
  });
  const typeLabels = {
    blood_pressure: L.bloodPressure,
    blood_sugar: L.bloodSugar,
    weight: L.weight,
  };
  let vitalsHtml = "";
  Object.entries(grouped).forEach(([type, records]) => {
    const sorted = [...records].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const latest = sorted[0];
    let display = "";
    let avg = "";
    if (type === "blood_pressure") {
      display = `${latest.systolic}/${latest.diastolic} mmHg`;
      const s = Math.round(sorted.reduce((acc, r) => acc + (r.systolic || 0), 0) / sorted.length);
      const d = Math.round(sorted.reduce((acc, r) => acc + (r.diastolic || 0), 0) / sorted.length);
      avg = `${L.average}: ${s}/${d}`;
    } else if (type === "blood_sugar") {
      display = `${latest.value} mg/dL`;
      avg = `${L.average}: ${Math.round(sorted.reduce((acc, r) => acc + (r.value || 0), 0) / sorted.length)}`;
    } else if (type === "weight") {
      display = `${latest.weight} kg`;
      avg = `${L.average}: ${(sorted.reduce((acc, r) => acc + (r.weight || 0), 0) / sorted.length).toFixed(1)}`;
    } else {
      display = String(latest.value ?? "-");
    }
    vitalsHtml += `
      <div style="border:1px solid ${COLORS.border};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:${COLORS.white}">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:13px;font-weight:700;color:${COLORS.accent}">${esc(typeLabels[type] || type)}</span>
          <span style="font-size:11px;color:${COLORS.muted}">${esc(avg)}</span>
        </div>
        <div style="font-size:18px;font-weight:800;color:${COLORS.primary};margin-top:4px">${esc(display)}</div>
        <div style="font-size:10px;color:${COLORS.muted};margin-top:2px">${esc(L.lastReading)}: ${esc(moment(latest.created_date).format("YYYY-MM-DD HH:mm"))}</div>
      </div>`;
  });

  const statusLabels = {
    taken: L.statusTaken,
    skipped: L.statusSkipped,
    missed: L.statusMissed,
    pending: L.statusPending,
  };
  const statusColors = {
    taken: COLORS.success,
    skipped: COLORS.warning,
    missed: COLORS.danger,
    pending: COLORS.muted,
  };
  const displayLogs = [...doseLogs]
    .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))
    .slice(0, 30);

  const rowsHtml = displayLogs.length
    ? displayLogs
        .map((log, idx) => {
          const bg = idx % 2 === 0 ? COLORS.bg : COLORS.white;
          const color = statusColors[log.status] || COLORS.muted;
          return `
      <tr style="background:${bg}">
        <td style="padding:5px 6px;border-bottom:1px solid ${COLORS.border};font-size:11px">${esc(log.scheduled_date || "-")}</td>
        <td style="padding:5px 6px;border-bottom:1px solid ${COLORS.border};font-size:11px">${esc(log.scheduled_time || "-")}</td>
        <td style="padding:5px 6px;border-bottom:1px solid ${COLORS.border};font-size:11px">${esc((log.medication_name || "-").substring(0, 24))}</td>
        <td style="padding:5px 6px;border-bottom:1px solid ${COLORS.border};font-size:11px;font-weight:700;color:${color}">${esc(statusLabels[log.status] || log.status || "-")}</td>
        <td style="padding:5px 6px;border-bottom:1px solid ${COLORS.border};font-size:11px;color:${COLORS.muted}">${esc((log.skip_reason || "-").substring(0, 20))}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" style="padding:14px;text-align:center;color:${COLORS.muted};font-size:12px">${esc(L.emptyLogs)}</td></tr>`;

  const moreHtml =
    doseLogs.length > 30
      ? `<div style="text-align:center;font-size:11px;color:${COLORS.muted};margin-top:6px">${esc(L.moreEntries(doseLogs.length - 30))}</div>`
      : "";

  return `
<div dir="rtl" style="font-family:${ARABIC_FONT_STACK};direction:rtl;text-align:right;background:${COLORS.white};width:${DOM_WIDTH_PX}px;box-sizing:border-box">
  <div style="background:${COLORS.accent};color:${COLORS.white};padding:18px 20px;text-align:center">
    <div style="font-size:23px;font-weight:800">${esc(L.title)}</div>
    <div style="font-size:12px;margin-top:6px;opacity:.95">${esc(dateRange)}</div>
    <div style="font-size:13px;margin-top:4px;font-weight:600">${esc(recipientName || L.noRecipient)}</div>
  </div>

  <div style="padding:16px 20px 4px">
    <div style="font-size:16px;font-weight:800;color:${COLORS.primary};margin-bottom:10px">${esc(L.adherenceTitle)}</div>
    <div style="display:flex;gap:6px">
      ${card(L.taken, taken, takenPct, COLORS.success)}
      ${card(L.skipped, skipped, skippedPct, COLORS.warning)}
      ${card(L.missed, missed, missedPct, COLORS.danger)}
      ${card(L.pending, pending, pendingPct, COLORS.muted)}
    </div>
    <div style="display:flex;margin-top:12px;border-radius:5px;overflow:hidden;background:${COLORS.border}">
      ${seg(takenPct, COLORS.success)}
      ${seg(skippedPct, COLORS.warning)}
      ${seg(missedPct, COLORS.danger)}
      ${seg(pendingPct, COLORS.muted)}
    </div>
    <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">
      ${legend(L.legendTaken, COLORS.success)}
      ${legend(L.legendSkipped, COLORS.warning)}
      ${legend(L.legendMissed, COLORS.danger)}
      ${legend(L.legendPending, COLORS.muted)}
    </div>
    <div style="display:flex;align-items:center;gap:12px;border:1px solid ${COLORS.accent};border-radius:8px;padding:10px 14px;margin-top:14px">
      <div style="width:34px;height:34px;border-radius:50%;background:${COLORS.accent};color:${COLORS.white};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800">${esc(rateMark)}</div>
      <div>
        <div style="font-size:15px;font-weight:800;color:${COLORS.primary}">${esc(L.adherenceRate)} ${esc(takenPct)}%</div>
        <div style="font-size:11px;color:${COLORS.muted}">${esc(rateText)}</div>
      </div>
    </div>
  </div>

  <div style="padding:4px 20px 0">
    <div style="height:1px;background:${COLORS.border};margin:14px 0"></div>
    <div style="font-size:16px;font-weight:800;color:${COLORS.primary};margin-bottom:10px">${esc(L.vitalsTitle)}</div>
    ${vitalsHtml || `<div style="font-size:12px;color:${COLORS.muted};padding:8px 0">${esc(L.vitalsNone)}</div>`}
  </div>

  <div style="padding:10px 20px 0">
    <div style="height:1px;background:${COLORS.border};margin:6px 0 14px"></div>
    <div style="font-size:15px;font-weight:800;color:${COLORS.primary};margin-bottom:10px">${esc(L.detailTitle)}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:7px 6px;font-size:11px;color:${COLORS.muted};text-align:center;font-weight:700">${esc(L.colDate)}</th>
          <th style="padding:7px 6px;font-size:11px;color:${COLORS.muted};text-align:center;font-weight:700">${esc(L.colTime)}</th>
          <th style="padding:7px 6px;font-size:11px;color:${COLORS.muted};text-align:center;font-weight:700">${esc(L.colMedication)}</th>
          <th style="padding:7px 6px;font-size:11px;color:${COLORS.muted};text-align:center;font-weight:700">${esc(L.colStatus)}</th>
          <th style="padding:7px 6px;font-size:11px;color:${COLORS.muted};text-align:center;font-weight:700">${esc(L.colNote)}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${moreHtml}
  </div>

  <div style="padding:14px 20px 20px;text-align:center;font-size:10px;color:${COLORS.muted}">
    ${esc(L.footer(moment().format("YYYY-MM-DD HH:mm")))}
  </div>
</div>`;
}

/** Slice a tall canvas into A4-sized pages inside one jsPDF document. */
function canvasToPdf(canvas) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pxPerMm = canvas.width / PAGE_W_MM;
  const pageHpx = Math.max(1, Math.floor(PAGE_H_MM * pxPerMm));
  let offset = 0;
  let first = true;
  while (offset < canvas.height) {
    const sliceH = Math.min(pageHpx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) doc.addPage();
    doc.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, PAGE_W_MM, sliceH / pxPerMm);
    first = false;
    offset += sliceH;
  }
  return doc;
}

export async function generateWeeklyReport({ doseLogs, vitalSigns, recipientName, weekStart, weekEnd, labels }) {
  const logs = doseLogs || [];
  const host = document.createElement("div");
  host.setAttribute("data-rafiq-report", "1");
  // Rendered off-screen but still laid out: display:none would hand html2canvas
  // a zero-sized, blank capture.
  host.style.cssText = `position:fixed;top:0;left:-10000px;z-index:-1;background:#ffffff;width:${DOM_WIDTH_PX}px;`;
  host.innerHTML = buildReportHtml({ doseLogs: logs, vitalSigns, recipientName, weekStart, weekEnd, labels });
  document.body.appendChild(host);

  try {
    // Ensure the Arabic web font is loaded before rasterising: html2canvas draws
    // whatever the browser has, so an unloaded font silently falls back.
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      if (document.fonts?.load) await document.fonts.load("16px Cairo");
    } catch {
      /* best effort */
    }
    const canvas = await html2canvas(host, {
      scale: RENDER_SCALE,
      backgroundColor: "#ffffff",
      width: DOM_WIDTH_PX,
      windowWidth: DOM_WIDTH_PX,
      useCORS: true,
      logging: false,
    });
    return canvasToPdf(canvas);
  } finally {
    host.remove();
  }
}

export function downloadPdf(doc, filename) {
  doc.save(filename);
}

export async function sharePdf(doc, filename) {
  const pdfBlob = doc.output("blob");
  const file = new File([pdfBlob], filename, { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "تقرير الأدوية الأسبوعي",
        text: "مرفق تقرير الالتزام بالأدوية لهذا الأسبوع.",
      });
      return true;
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Share failed:", e);
      }
    }
  }
  return false;
}

export function getWhatsAppShareUrl(pdfDataUrl, text) {
  const encodedText = encodeURIComponent(text || "مرفق تقرير الأدوية الأسبوعي من رفيق الدواء");
  return `https://wa.me/?text=${encodedText}`;
}

export function getEmailShareUrl(subject, text) {
  const encodedSubject = encodeURIComponent(subject || "تقرير الأدوية الأسبوعي - رفيق الدواء");
  const encodedBody = encodeURIComponent(text || "مرفق تقرير الالتزام بالأدوية الأسبوعي من رفيق الدواء.");
  return `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
}
