import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { PurchaseOrder } from '../api/types';

const BRAND_MINT = '#00ffc2';
const INDIGO = '#0e0447';

function newDoc(title: string, subtitle?: string): jsPDF {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(INDIGO);
  doc.text('MedLine', 14, 18);
  doc.setFontSize(12);
  doc.setTextColor('#333333');
  doc.text(title, 14, 27);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor('#666666');
    doc.text(subtitle, 14, 33);
  }
  doc.setDrawColor(BRAND_MINT);
  doc.setLineWidth(0.6);
  doc.line(14, 37, 196, 37);
  return doc;
}

function footer(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor('#999999');
    doc.text(
      `Generado el ${new Date().toLocaleString('es')} · MedLine · Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }
}

// Exporta cualquier listado tabular a PDF (usado por Auditoría, Movimientos, etc.).
export function exportTableToPdf(options: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const { title, subtitle, columns, rows, filename } = options;
  const doc = newDoc(title, subtitle);
  autoTable(doc, {
    startY: 42,
    head: [columns],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [14, 4, 71], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });
  footer(doc);
  doc.save(filename);
}

// Documento formal de una orden de compra, con sus líneas y estado de recepción.
export function exportPurchaseOrderPdf(order: PurchaseOrder) {
  const doc = newDoc(`Orden de Compra ${order.code}`, `Estado: ${order.status}`);

  autoTable(doc, {
    startY: 42,
    body: [
      ['Proveedor', order.supplier?.name ?? 'Sin asignar'],
      ['Creada por', order.createdBy?.fullName ?? '—'],
      ['Fecha de creación', new Date(order.createdAt).toLocaleString('es')],
      ['Aprobada por', order.approvedBy?.fullName ?? '—'],
      ['Fecha de aprobación', order.approvedAt ? new Date(order.approvedAt).toLocaleString('es') : '—'],
      ...(order.status === 'REJECTED'
        ? [
            ['Rechazada por', order.rejectedBy?.fullName ?? '—'],
            ['Motivo del rechazo', order.rejectionReason ?? '—'],
          ]
        : []),
      ...(order.receivedAt ? [['Fecha de recepción', new Date(order.receivedAt).toLocaleString('es')]] : []),
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });

  const afterInfoY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: afterInfoY,
    head: [['Medicamento', 'Recomendada', 'Pedida', 'Recibida']],
    body: order.lines.map((l) => [l.item.name, l.recommendedQty, l.orderedQty, l.receivedQty]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [14, 4, 71], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  footer(doc);
  doc.save(`${order.code}.pdf`);
}
