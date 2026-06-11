import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

export function exportToExcel(filename: string, sheets: Record<string, Record<string, any>[]>) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
