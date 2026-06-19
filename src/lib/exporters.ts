import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

export function exportToPdf(title: string, rows: Record<string, any>[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString("pt-BR"), 14, 22);
  if (rows.length) {
    autoTable(doc, {
      startY: 28,
      head: [Object.keys(rows[0])],
      body: rows.map((r) => Object.values(r).map(String)),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [88, 80, 236] },
    });
  }
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

type PdfTableSection = {
  title: string;
  rows: Record<string, any>[];
};

type PdfReportOptions = {
  title: string;
  subtitle?: string;
  summaryRows?: Record<string, any>[];
  sections?: PdfTableSection[];
  chartSelector?: string;
};

const PAGE = {
  marginX: 14,
  marginY: 14,
  width: 210,
  height: 297,
};

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  if (y + needed <= PAGE.height - PAGE.marginY) return y;
  doc.addPage();
  return PAGE.marginY;
}

function addTable(doc: jsPDF, title: string, rows: Record<string, any>[], startY: number) {
  if (!rows.length) return startY;

  let y = ensureSpace(doc, startY, 24);
  doc.setFontSize(12);
  doc.setTextColor(24, 24, 27);
  doc.text(title, PAGE.marginX, y);

  autoTable(doc, {
    startY: y + 5,
    head: [Object.keys(rows[0])],
    body: rows.map((row) => Object.values(row).map((value) => String(value ?? "-"))),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [88, 80, 236], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    margin: { left: PAGE.marginX, right: PAGE.marginX },
  });

  return ((doc as any).lastAutoTable?.finalY ?? y) + 10;
}

async function captureCharts(selector: string) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const captures = [];

  for (const card of cards) {
    const title = card.dataset.pdfChartCard ?? "Grafico";
    const canvas = await html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    captures.push({
      title,
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return captures;
}

export async function exportDashboardPdf({
  title,
  subtitle,
  summaryRows = [],
  sections = [],
  chartSelector = "[data-pdf-chart-card]",
}: PdfReportOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generatedAt = new Date().toLocaleString("pt-BR");
  const charts = await captureCharts(chartSelector);

  doc.setFillColor(88, 80, 236);
  doc.rect(0, 0, PAGE.width, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, PAGE.marginX, 14);
  doc.setFontSize(9);
  doc.text(subtitle ? `${subtitle} | ${generatedAt}` : generatedAt, PAGE.marginX, 22);

  let y = 40;
  if (summaryRows.length) {
    y = addTable(doc, "Resumo de indicadores", summaryRows, y);
  }

  if (charts.length) {
    doc.setFontSize(12);
    doc.setTextColor(24, 24, 27);
    y = ensureSpace(doc, y, 12);
    doc.text("Graficos do painel", PAGE.marginX, y);
    y += 6;

    for (const chart of charts) {
      const maxWidth = PAGE.width - PAGE.marginX * 2;
      const imageHeight = Math.min(78, (chart.height / chart.width) * maxWidth);
      y = ensureSpace(doc, y, imageHeight + 10);
      doc.addImage(chart.dataUrl, "PNG", PAGE.marginX, y, maxWidth, imageHeight);
      y += imageHeight + 8;
    }
  }

  for (const section of sections) {
    y = addTable(doc, section.title, section.rows, y);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(`be.move BI - pagina ${page} de ${pageCount}`, PAGE.marginX, PAGE.height - 8);
  }

  doc.save(`${sanitizeFilename(title)}.pdf`);
}

export function exportToExcel(filename: string, sheets: Record<string, Record<string, any>[]>) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
