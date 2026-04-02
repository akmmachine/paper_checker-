
import { jsPDF } from "jspdf";
import autoTable, { applyPlugin } from "jspdf-autotable";
import { Paper, QuestionData, QuestionStatus } from "../types";
import { resolvedCorrectOptionIndices } from "./mcqCorrectIndices";

// Vite bundles jsPDF as a module; autotable only self-registers if window.jsPDF exists.
applyPlugin(jsPDF);

const txt = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
};

function correctLettersFromOriginal(o: QuestionData["original"]): Set<string> {
  const s = new Set<string>();
  if (o.options?.length && Array.isArray(o.correctOptionIndices) && o.correctOptionIndices.length > 0) {
    for (const i of o.correctOptionIndices) {
      if (typeof i === "number" && i >= 0 && i < o.options.length) s.add(String.fromCharCode(65 + i));
    }
    if (s.size > 0) return s;
  }
  const ans = o.correctAnswer?.trim();
  if (ans && /^[A-Z]$/i.test(ans)) {
    s.add(ans.toUpperCase());
    return s;
  }
  const idx = o.correctOptionIndex;
  if (typeof idx === "number" && o.options && idx >= 0 && idx < o.options.length) {
    s.add(String.fromCharCode(65 + idx));
  }
  return s;
}

function getAuditLogs(q: QuestionData): Array<{ type?: string; message?: string; severity?: string }> {
  if (!q.audit) return [];
  const a = q.audit as { logs?: unknown; auditLogs?: unknown };
  const raw = a.logs ?? a.auditLogs;
  return Array.isArray(raw) ? (raw as Array<{ type?: string; message?: string; severity?: string }>) : [];
}

function redlineQuestion(q: QuestionData): string {
  return txt(q.audit?.redlines?.question) || txt(q.audit?.clean?.question) || txt(q.original?.question);
}

function redlineSolution(q: QuestionData): string {
  return txt(q.audit?.redlines?.solution) || txt(q.audit?.clean?.solution) || txt(q.original?.solution);
}

function redlineOptions(q: QuestionData): string[] {
  const ro = q.audit?.redlines?.options;
  const co = q.audit?.clean?.options;
  const oo = q.original?.options;
  if (Array.isArray(ro) && ro.length) return ro.map((x) => txt(x));
  if (Array.isArray(co) && co.length) return co.map((x) => txt(x));
  if (Array.isArray(oo) && oo.length) return oo.map((x) => txt(x));
  return [];
}

function redlineCorrectLetters(q: QuestionData): Set<string> {
  const s = new Set<string>();
  const opts = redlineOptions(q);
  const n = opts.length;
  if (n <= 0) return s;

  const indices = resolvedCorrectOptionIndices({ original: q.original, audit: q.audit });
  for (const i of indices) {
    if (i >= 0 && i < n) s.add(String.fromCharCode(65 + i));
  }
  if (s.size > 0) return s;

  const ra = q.audit?.redlines?.correctAnswer?.trim();
  if (ra && /^[A-Z]$/i.test(ra)) s.add(ra.toUpperCase());
  return s;
}

/**
 * Helper to render text with <del> and <ins> tags in a way that jsPDF can handle.
 * Since jsPDF doesn't support HTML, we split the text and render parts with colors.
 * This is a simplified version that works within a fixed width.
 */
const renderTrackedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  defaultColor: number[] = [30, 30, 30]
): number => {
  const safe = txt(text);
  const parts = safe.split(/(<del>.*?<\/del>|<ins>.*?<\/ins>)/g);
  let currentX = x;
  let currentY = y;
  const lineHeight = 5;

  doc.setFontSize(9);

  parts.forEach((part) => {
    if (!part) return;

    let color = defaultColor;
    let isDel = false;
    let content = part;

    if (part.startsWith("<del>")) {
      color = [239, 68, 68];
      isDel = true;
      content = part.replace(/<\/?del>/g, "");
    } else if (part.startsWith("<ins>")) {
      color = [34, 197, 94];
      content = part.replace(/<\/?ins>/g, "");
    }

    doc.setTextColor(color[0], color[1], color[2]);

    const lines = content.split("\n");
    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        currentX = x;
        currentY += lineHeight;
      }

      const words = line.split(/(\s+)/);
      words.forEach((word) => {
        if (!word) return;

        const wordWidth = doc.getTextWidth(word);

        if (currentX + wordWidth > x + maxWidth && word.trim().length > 0) {
          currentX = x;
          currentY += lineHeight;
        }

        doc.text(word, currentX, currentY);

        if (isDel && word.trim().length > 0) {
          doc.setDrawColor(color[0], color[1], color[2]);
          doc.setLineWidth(0.2);
          doc.line(currentX, currentY - 1, currentX + wordWidth, currentY - 1);
        }

        currentX += wordWidth;
      });
    });
  });

  doc.setTextColor(30, 30, 30);
  return currentY + lineHeight;
};

function safePdfBasename(title: string): string {
  const base = txt(title).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 120);
  return base || "Audit_Report";
}

export const generateAuditPDF = (paper: Paper): void => {
  try {
    if (!paper?.questions?.length) {
      alert("No questions to export.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const colWidth = (pageWidth - margin * 3) / 2;

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Academic Audit Report", margin, 25);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Paper ID: ${txt(paper.id)}`, margin, 35);
    doc.text(`Title: ${txt(paper.title)}`, margin, 40);
    doc.text(`Auditor: ${txt(paper.creatorName)}`, margin, 45);
    doc.text(`Date: ${new Date(paper.createdAt).toLocaleDateString()}`, margin, 50);
    doc.text(`Status: ${txt(paper.status)}`, margin, 55);

    let yPos = 65;

    paper.questions.forEach((q, index) => {
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(245, 247, 250);
      doc.rect(margin, yPos, pageWidth - margin * 2, 10, "F");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text(`Question ${index + 1}: ${txt(q.topic)}`, margin + 5, yPos + 7);
      yPos += 15;

      const startY = yPos;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("ORIGINAL CONTENT", margin, yPos);
      yPos += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const oq = txt(q.original?.question);
      const originalLines = doc.splitTextToSize(oq || "—", colWidth);
      doc.text(originalLines, margin, yPos);
      let leftY = yPos + originalLines.length * 5 + 5;

      const origOpts = q.original?.options;
      if (Array.isArray(origOpts) && origOpts.length > 0) {
        origOpts.forEach((opt, i) => {
          const optLines = doc.splitTextToSize(`${String.fromCharCode(65 + i)}) ${txt(opt)}`, colWidth);
          doc.text(optLines, margin + 2, leftY);
          leftY += optLines.length * 5;
        });
        leftY += 2;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Original Solution:", margin, leftY);
      leftY += 5;
      doc.setFont("helvetica", "normal");
      const osol = txt(q.original?.solution);
      const origSolLines = doc.splitTextToSize(osol || "—", colWidth);
      doc.text(origSolLines, margin, leftY);
      leftY += origSolLines.length * 5 + 10;

      let rightY = startY;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("CORRECTED (TRACKED)", margin + colWidth + margin, rightY);
      rightY += 7;

      if (q.audit) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        rightY = renderTrackedText(
          doc,
          redlineQuestion(q),
          margin + colWidth + margin,
          rightY,
          colWidth
        );
        rightY += 5;

        const rOpts = redlineOptions(q);
        if (rOpts.length > 0) {
          const origCorrect = correctLettersFromOriginal(q.original);
          const auditCorrect = redlineCorrectLetters(q);

          rOpts.forEach((opt, i) => {
            const char = String.fromCharCode(65 + i);
            const prefix = `${char}) `;

            let color = [30, 30, 30];
            doc.setFont("helvetica", "normal");

            if (auditCorrect.has(char)) {
              color = [34, 197, 94];
              doc.setFont("helvetica", "bold");
            } else if (origCorrect.has(char) && !auditCorrect.has(char)) {
              color = [239, 68, 68];
              doc.setFont("helvetica", "bold");
            }

            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(prefix, margin + colWidth + margin, rightY);

            const prefixW = doc.getTextWidth(prefix);
            rightY = renderTrackedText(
              doc,
              opt,
              margin + colWidth + margin + prefixW,
              rightY,
              colWidth - prefixW,
              color
            );
            doc.setTextColor(30, 30, 30);
          });
          rightY += 2;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Corrected Solution:", margin + colWidth + margin, rightY);
        rightY += 5;
        doc.setFont("helvetica", "normal");
        rightY = renderTrackedText(
          doc,
          redlineSolution(q),
          margin + colWidth + margin,
          rightY,
          colWidth
        );
        rightY += 5;

        const st = q.audit.status;
        const statusColor =
          st === QuestionStatus.APPROVED ? [34, 197, 94] : [239, 68, 68];
        doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.rect(margin + colWidth + margin, rightY, 30, 6);
        doc.setFontSize(7);
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(txt(st), margin + colWidth + margin + 15, rightY + 4, { align: "center" });
        rightY += 12;
      } else {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150);
        doc.text("Audit pending...", margin + colWidth + margin, rightY);
        rightY += 10;
      }

      yPos = Math.max(leftY, rightY);

      const logs = getAuditLogs(q);
      if (logs.length > 0) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }
        autoTable(doc, {
          startY: yPos,
          head: [["Audit Logs / Observations"]],
          body: logs.map((log) => [
            `[${txt(log.severity)}] ${txt(log.type)}: ${txt(log.message)}`,
          ]),
          margin: { left: margin },
          theme: "plain",
          styles: { fontSize: 7, cellPadding: 1 },
          headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: "bold" },
        });
        const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
        yPos = (last?.finalY ?? yPos) + 10;
      }

      doc.setDrawColor(230);
      doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
      yPos += 5;
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
        align: "center",
      });
      doc.text("Generated by Paper Checker AI", margin, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`${safePdfBasename(paper.title)}_Audit_Report.pdf`);
  } catch (e) {
    console.error("PDF export failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    alert(`Could not generate PDF.\n\n${msg}`);
  }
};
