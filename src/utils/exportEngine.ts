import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from 'docx';
import JSZip from 'jszip';
import { LetterheadConfig, SignatureSnapshot } from '../types';
import { formatJalaliDate, sanitizeCsvOrXml, todayIsoDate } from './format';

export interface ExportDonutSegment {
  label: string;
  value: number;
  formattedValue: string;
  percentText: string;
  color: string;
}

export interface ExportDonutChartData {
  title: string;
  centerLabel: string;
  centerValue: string;
  segments: ExportDonutSegment[];
}

export interface ExportTablePayload {
  title: string;
  subtitle?: string;
  documentNumber?: string;
  date?: string;
  letterhead: LetterheadConfig;
  narrativeParagraphs?: string[];
  donutChartData?: ExportDonutChartData;
  summaryRows?: Array<{ label: string; value: string }>;
  headers: string[];
  rows: string[][];
  notes?: string;
  signatures?: SignatureSnapshot[];
}

interface RenderedChartPng {
  bytes: Uint8Array;
  dataUrl: string;
  width: number;
  height: number;
}

// Unified Monochromatic Royal Navy Report Palette (سرمه‌ای رسمی هماهنگ)
const PALETTE = {
  navyDeep: '1D3250',
  navyMid: '2E4A73',
  bannerBg: 'E4ECF6',
  keyBg: 'EEF3FA',
  zebraBg: 'F7FAFD',
  borderOuter: '1D3250',
  borderInner: 'C3D2E4',
  textPrimary: '1E293B',
  textMuted: '4F6076',
  white: 'FFFFFF',
};

// ISO A4 Portrait dimensions in twips (210mm x 297mm)
const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function renderDonutChartPng(donut?: ExportDonutChartData): RenderedChartPng | null {
  if (!donut || donut.segments.length === 0 || typeof document === 'undefined') return null;

  const logicalW = 760;
  const logicalH = 340;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = logicalW * scale;
  canvas.height = logicalH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);

  // Clean card background matching cohesive Royal Navy palette
  ctx.fillStyle = `#${PALETTE.white}`;
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.strokeStyle = `#${PALETTE.borderInner}`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, logicalW - 16, logicalH - 16);

  // Top subtle navy accent strip
  ctx.fillStyle = `#${PALETTE.navyDeep}`;
  ctx.fillRect(8, 8, logicalW - 16, 4);

  // Title (RTL right-aligned, Zar font)
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = `#${PALETTE.navyDeep}`;
  ctx.font = 'bold 18px "Zar", "B Zar", Tahoma, sans-serif';
  ctx.fillText(donut.title, logicalW - 28, 46);

  // Cohesive monochromatic shades for donut slices
  const monochromaticShades = ['#1D3250', '#386394', '#7FA4CC', '#B7CDE4'];

  // Donut on the left-center side so RTL legend sits cleanly on the right
  const cx = 185;
  const cy = 194;
  const outerR = 104;
  const innerR = 62;
  const totalVal = donut.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);

  if (totalVal > 0) {
    let startAngle = -Math.PI / 2;
    donut.segments.forEach((seg, idx) => {
      const val = Math.max(0, seg.value);
      if (val <= 0) return;
      const sliceAngle = (val / totalVal) * Math.PI * 2;
      const fillColor = monochromaticShades[idx % monochromaticShades.length];
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      startAngle += sliceAngle;
    });
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
    ctx.closePath();
    ctx.fillStyle = '#E4ECF6';
    ctx.fill();
  }

  // Center text
  ctx.textAlign = 'center';
  ctx.fillStyle = `#${PALETTE.navyDeep}`;
  ctx.font = 'bold 18px "Zar", "B Zar", Tahoma, sans-serif';
  ctx.fillText(donut.centerValue, cx, cy - 2);
  ctx.fillStyle = `#${PALETTE.textMuted}`;
  ctx.font = '13px "Zar", "B Zar", Tahoma, sans-serif';
  ctx.fillText(donut.centerLabel, cx, cy + 20);

  // RTL Legend on the right side
  const legendRightX = logicalW - 30;
  let rowY = 94;
  const rowGap = 62;

  donut.segments.forEach((seg, idx) => {
    const swatchColor = monochromaticShades[idx % monochromaticShades.length];

    // Soft row card
    ctx.fillStyle = `#${PALETTE.zebraBg}`;
    ctx.fillRect(340, rowY - 22, legendRightX - 332, 48);
    ctx.strokeStyle = `#${PALETTE.borderInner}`;
    ctx.lineWidth = 1;
    ctx.strokeRect(340, rowY - 22, legendRightX - 332, 48);

    // Color swatch on right
    ctx.fillStyle = swatchColor;
    ctx.fillRect(legendRightX - 20, rowY - 9, 14, 14);

    // Segment label
    ctx.textAlign = 'right';
    ctx.fillStyle = `#${PALETTE.navyDeep}`;
    ctx.font = 'bold 15px "Zar", "B Zar", Tahoma, sans-serif';
    ctx.fillText(seg.label, legendRightX - 30, rowY - 1);

    // Value & percent below label
    ctx.fillStyle = `#${PALETTE.textMuted}`;
    ctx.font = '14px "Zar", "B Zar", Tahoma, sans-serif';
    ctx.fillText(`${seg.formattedValue}  (${seg.percentText})`, legendRightX - 30, rowY + 19);

    rowY += rowGap;
  });

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) return null;

  return {
    bytes: base64ToUint8Array(base64),
    dataUrl,
    width: logicalW,
    height: logicalH,
  };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

// Zar 14pt = 28 half-points in OOXML
const ZAR_FONT = 'Zar';
const ZAR_14PT = 28;
const ZAR_16PT = 32;
const ZAR_12PT = 24;

const CELL_MARGINS = {
  top: 90,
  bottom: 90,
  left: 120,
  right: 120,
};

const COHESIVE_TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 8, color: PALETTE.borderOuter },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: PALETTE.borderOuter },
  left: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
  right: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
};

function rtlTextRun(text: string, options?: { bold?: boolean; size?: number; color?: string }) {
  return new TextRun({
    text: text || '—',
    font: {
      name: ZAR_FONT,
      cs: ZAR_FONT,
      ascii: ZAR_FONT,
      hAnsi: ZAR_FONT,
    },
    size: options?.size ?? ZAR_14PT,
    bold: options?.bold ?? false,
    color: options?.color ?? PALETTE.textPrimary,
    rightToLeft: true,
  });
}

function makeRtlTableCell(
  text: string,
  options?: {
    bold?: boolean;
    color?: string;
    fill?: string;
    size?: number;
    widthPct?: number;
  }
) {
  return new TableCell({
    verticalAlign: VerticalAlignTable.CENTER,
    margins: CELL_MARGINS,
    width:
      options?.widthPct !== undefined
        ? { size: options.widthPct, type: WidthType.PERCENTAGE }
        : undefined,
    shading: options?.fill ? { type: ShadingType.SOLID, color: options.fill } : undefined,
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 20, after: 20 },
        children: [
          rtlTextRun(text, {
            bold: options?.bold,
            color: options?.color,
            size: options?.size ?? ZAR_14PT,
          }),
        ],
      }),
    ],
  });
}

export async function exportToWordDocx(payload: ExportTablePayload, fileName: string): Promise<void> {
  const children: Array<Paragraph | Table> = [];

  // Formal Text-Only Letterhead Box (100% RTL, Zar font, cohesive Royal Navy palette, NO emblem)
  const letterheadParagraphs: Paragraph[] = [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      children: [
        rtlTextRun(payload.letterhead.organizationName, {
          bold: true,
          size: ZAR_16PT,
          color: PALETTE.navyDeep,
        }),
      ],
    }),
  ];

  if (payload.letterhead.unitName) {
    letterheadParagraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [
          rtlTextRun(payload.letterhead.unitName, {
            bold: true,
            size: ZAR_14PT,
            color: PALETTE.navyMid,
          }),
        ],
      })
    );
  }

  if (payload.letterhead.subtitle) {
    letterheadParagraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [
          rtlTextRun(payload.letterhead.subtitle, {
            size: ZAR_12PT,
            color: PALETTE.textMuted,
          }),
        ],
      })
    );
  }

  if (payload.letterhead.showDateAndNumber) {
    letterheadParagraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 40, after: 0 },
        children: [
          rtlTextRun(
            `تاریخ گزارش: ${formatJalaliDate(payload.date || todayIsoDate())}   |   شماره: ${payload.documentNumber || 'ثبت محلی'}`,
            { size: ZAR_12PT, color: PALETTE.textMuted }
          ),
        ],
      })
    );
  }

  children.push(
    new Table({
      visuallyRightToLeft: true,
      alignment: AlignmentType.RIGHT,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 12, color: PALETTE.navyDeep },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: PALETTE.navyDeep },
        left: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
        right: { style: BorderStyle.SINGLE, size: 12, color: PALETTE.navyDeep },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: PALETTE.bannerBg },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: letterheadParagraphs,
            }),
          ],
        }),
      ],
    })
  );

  // Document Title (RTL Right-Aligned)
  children.push(
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { before: 180, after: 120 },
      children: [rtlTextRun(payload.title, { bold: true, size: ZAR_16PT, color: PALETTE.navyDeep })],
    })
  );

  if (payload.subtitle) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 140 },
        children: [rtlTextRun(payload.subtitle, { size: ZAR_14PT, color: PALETTE.textMuted })],
      })
    );
  }

  // Narrative Paragraphs (گزارش متنی راست‌چین با فونت زر ۱۴)
  if (payload.narrativeParagraphs && payload.narrativeParagraphs.length > 0) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 80, after: 80 },
        children: [
          rtlTextRun('گزارش متنی و تحلیلی', {
            bold: true,
            size: ZAR_14PT,
            color: PALETTE.navyDeep,
          }),
        ],
      })
    );

    const narrativeParagraphNodes = payload.narrativeParagraphs.map(
      (para) =>
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 30, after: 70 },
          children: [rtlTextRun(para, { size: ZAR_14PT, color: PALETTE.textPrimary })],
        })
    );

    children.push(
      new Table({
        visuallyRightToLeft: true,
        alignment: AlignmentType.RIGHT,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
          left: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
          right: { style: BorderStyle.SINGLE, size: 10, color: PALETTE.navyMid },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.SOLID, color: PALETTE.zebraBg },
                margins: { top: 100, bottom: 100, left: 140, right: 160 },
                children: narrativeParagraphNodes,
              }),
            ],
          }),
        ],
      })
    );
    children.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 120 }, children: [] }));
  }

  // Embedded Donut Chart PNG + Structured Breakdown Table (گزارش دوناتی)
  if (payload.donutChartData && payload.donutChartData.segments.length > 0) {
    const renderedChart = renderDonutChartPng(payload.donutChartData);
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 100, after: 80 },
        children: [
          rtlTextRun(payload.donutChartData.title, {
            bold: true,
            size: ZAR_14PT,
            color: PALETTE.navyDeep,
          }),
        ],
      })
    );

    if (renderedChart) {
      children.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { after: 140 },
          children: [
            new ImageRun({
              type: 'png',
              data: renderedChart.bytes,
              transformation: {
                width: 560,
                height: Math.round((renderedChart.height / renderedChart.width) * 560),
              },
            }),
          ],
        })
      );
    }

    const donutHeaderRow = new TableRow({
      tableHeader: true,
      children: ['بخش وضعیت بودجه', 'مبلغ (ریال)', 'سهم / درصد'].map((h) =>
        makeRtlTableCell(h, { bold: true, color: PALETTE.white, fill: PALETTE.navyDeep })
      ),
    });

    const donutDataRows = payload.donutChartData.segments.map(
      (seg, idx) =>
        new TableRow({
          children: [seg.label, seg.formattedValue, seg.percentText].map((val) =>
            makeRtlTableCell(val, {
              fill: idx % 2 === 1 ? PALETTE.zebraBg : PALETTE.white,
            })
          ),
        })
    );

    children.push(
      new Table({
        visuallyRightToLeft: true,
        alignment: AlignmentType.RIGHT,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: COHESIVE_TABLE_BORDERS,
        rows: [donutHeaderRow, ...donutDataRows],
      })
    );
    children.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 140 }, children: [] }));
  }

  // Key-value summary rows (RTL table)
  if (payload.summaryRows && payload.summaryRows.length > 0) {
    const summaryTableRows = payload.summaryRows.map(
      (item, idx) =>
        new TableRow({
          children: [
            makeRtlTableCell(item.label, {
              bold: true,
              color: PALETTE.navyDeep,
              fill: PALETTE.keyBg,
              widthPct: 36,
            }),
            makeRtlTableCell(item.value, {
              fill: idx % 2 === 1 ? PALETTE.zebraBg : PALETTE.white,
              widthPct: 64,
            }),
          ],
        })
    );

    children.push(
      new Table({
        visuallyRightToLeft: true,
        alignment: AlignmentType.RIGHT,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: COHESIVE_TABLE_BORDERS,
        rows: summaryTableRows,
      })
    );
    children.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 140 }, children: [] }));
  }

  // Main Data Table (100% RTL — Cohesive Royal Navy Monochromatic Styling)
  if (payload.headers.length > 0) {
    const headerRow = new TableRow({
      tableHeader: true,
      children: payload.headers.map((h) =>
        makeRtlTableCell(h, { bold: true, color: PALETTE.white, fill: PALETTE.navyDeep })
      ),
    });

    const dataRows = payload.rows.map(
      (row, idx) =>
        new TableRow({
          children: row.map((cellText) =>
            makeRtlTableCell(cellText, {
              fill: idx % 2 === 1 ? PALETTE.zebraBg : PALETTE.white,
            })
          ),
        })
    );

    children.push(
      new Table({
        visuallyRightToLeft: true,
        alignment: AlignmentType.RIGHT,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: COHESIVE_TABLE_BORDERS,
        rows: [headerRow, ...dataRows],
      })
    );
  }

  if (payload.notes) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 160, after: 100 },
        children: [rtlTextRun(`توضیحات: ${payload.notes}`)],
      })
    );
  }

  // Historical Signatures Table
  if (payload.letterhead.showSignaturesFooter && payload.signatures && payload.signatures.length > 0) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 220, after: 100 },
        children: [
          rtlTextRun('امضاکنندگان و نظرات (ثبت تاریخی)', {
            bold: true,
            color: PALETTE.navyDeep,
          }),
        ],
      })
    );

    const sigRows = [
      new TableRow({
        tableHeader: true,
        children: ['نام و نام خانوادگی', 'سمت', 'تاریخ', 'وضعیت امضا', 'نظر'].map((lbl) =>
          makeRtlTableCell(lbl, { bold: true, color: PALETTE.white, fill: PALETTE.navyDeep })
        ),
      }),
      ...payload.signatures.map(
        (sig, idx) =>
          new TableRow({
            children: [
              sig.snapshotFullName,
              sig.snapshotRoleTitle,
              sig.signedDate ? formatJalaliDate(sig.signedDate) : '—',
              sig.isSignedConfirmed ? 'تأیید و امضاشده' : 'صرفاً درج نام (فاقد امضای معتبر)',
              sig.comment || '—',
            ].map((val) =>
              makeRtlTableCell(val, {
                fill: idx % 2 === 1 ? PALETTE.zebraBg : PALETTE.white,
              })
            ),
          })
      ),
    ];

    children.push(
      new Table({
        visuallyRightToLeft: true,
        alignment: AlignmentType.RIGHT,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: COHESIVE_TABLE_BORDERS,
        rows: sigRows,
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: {
              name: ZAR_FONT,
              cs: ZAR_FONT,
              ascii: ZAR_FONT,
              hAnsi: ZAR_FONT,
            },
            size: ZAR_14PT,
            color: PALETTE.textPrimary,
            rightToLeft: true,
          },
          paragraph: {
            alignment: AlignmentType.RIGHT,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: A4_WIDTH_TWIP,
              height: A4_HEIGHT_TWIP,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 850, right: 850, bottom: 850, left: 850 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
}

// Column index to Excel letter (0 -> A, 25 -> Z, 26 -> AA)
function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

interface ExcelRowSpec {
  cells: string[];
  cellStyles?: number[];
  styleIdx: number;
  height?: number;
  mergeFullWidth?: boolean;
}

// Generates a spec-compliant A4 RTL Excel (.xlsx) workbook with Zar 14pt font,
// cohesive monochromatic Royal Navy palette, full-width merged headers, bordered RTL tables & optional Donut chart PNG.
export async function exportToExcelXlsx(payload: ExportTablePayload, fileName: string): Promise<void> {
  const zip = new JSZip();

  // Style indices defined in xl/styles.xml below:
  // 0: Normal blank/plain RTL Zar 14pt
  // 1: Deep Navy Table Header (Bold White Zar 14pt, #1D3250 fill)
  // 2: Letterhead / Report Title Banner (Bold Deep Navy Zar 15pt, #E4ECF6 fill)
  // 3: Data Cell — White (#FFFFFF fill, #C3D2E4 border)
  // 4: Data Cell — Zebra Mist (#F7FAFD fill, #C3D2E4 border)
  // 5: Summary Key / Section Banner (Bold Deep Navy Zar 14pt, #EEF3FA fill)
  // 6: Narrative Paragraph Box (#F7FAFD fill, #C3D2E4 border)
  // 7: Metadata / Subtitle Row (Muted Navy Zar 13pt, #FFFFFF fill)

  const allRows: ExcelRowSpec[] = [];

  // Formal Text-Only Letterhead (No emblem, full-width merged RTL rows)
  allRows.push({
    cells: [payload.letterhead.organizationName],
    styleIdx: 2,
    height: 32,
    mergeFullWidth: true,
  });
  if (payload.letterhead.unitName) {
    allRows.push({
      cells: [payload.letterhead.unitName],
      styleIdx: 5,
      height: 28,
      mergeFullWidth: true,
    });
  }
  if (payload.letterhead.subtitle) {
    allRows.push({
      cells: [payload.letterhead.subtitle],
      styleIdx: 7,
      height: 24,
      mergeFullWidth: true,
    });
  }
  if (payload.letterhead.showDateAndNumber) {
    allRows.push({
      cells: [
        `تاریخ گزارش: ${formatJalaliDate(payload.date || todayIsoDate())}   |   شماره: ${payload.documentNumber || 'ثبت محلی'}`,
      ],
      styleIdx: 7,
      height: 24,
      mergeFullWidth: true,
    });
  }

  allRows.push({
    cells: [payload.title],
    styleIdx: 1,
    height: 32,
    mergeFullWidth: true,
  });
  allRows.push({ cells: [''], styleIdx: 0, height: 12 });

  // Narrative Paragraphs (گزارش متنی — full-width merged RTL rows)
  if (payload.narrativeParagraphs && payload.narrativeParagraphs.length > 0) {
    allRows.push({
      cells: ['گزارش متنی و تحلیلی'],
      styleIdx: 5,
      height: 28,
      mergeFullWidth: true,
    });
    for (const para of payload.narrativeParagraphs) {
      const estimatedLines = Math.max(2, Math.ceil(para.length / 72));
      allRows.push({
        cells: [para],
        styleIdx: 6,
        height: Math.min(96, estimatedLines * 24 + 10),
        mergeFullWidth: true,
      });
    }
    allRows.push({ cells: [''], styleIdx: 0, height: 12 });
  }

  // Donut Breakdown Table (گزارش دوناتی)
  const renderedChart = renderDonutChartPng(payload.donutChartData);
  if (payload.donutChartData && payload.donutChartData.segments.length > 0) {
    allRows.push({
      cells: [payload.donutChartData.title],
      styleIdx: 5,
      height: 28,
      mergeFullWidth: true,
    });
    allRows.push({
      cells: ['بخش وضعیت بودجه', 'مبلغ (ریال)', 'سهم / درصد'],
      styleIdx: 1,
      height: 28,
    });
    payload.donutChartData.segments.forEach((seg, idx) => {
      allRows.push({
        cells: [seg.label, seg.formattedValue, seg.percentText],
        styleIdx: idx % 2 === 1 ? 4 : 3,
        height: 26,
      });
    });
    allRows.push({ cells: [''], styleIdx: 0, height: 12 });
  }

  // Summary Table
  if (payload.summaryRows && payload.summaryRows.length > 0) {
    allRows.push({ cells: ['شاخص خلاصه وضعیت', 'مقدار'], styleIdx: 1, height: 28 });
    payload.summaryRows.forEach((s, idx) => {
      allRows.push({
        cells: [s.label, s.value],
        cellStyles: [5, idx % 2 === 1 ? 4 : 3],
        styleIdx: 3,
        height: 26,
      });
    });
    allRows.push({ cells: [''], styleIdx: 0, height: 12 });
  }

  // Main Data Table
  if (payload.headers.length > 0) {
    allRows.push({ cells: payload.headers, styleIdx: 1, height: 30 });
    payload.rows.forEach((r, idx) => {
      allRows.push({
        cells: r,
        styleIdx: idx % 2 === 1 ? 4 : 3,
        height: 26,
      });
    });
  }

  if (payload.notes) {
    allRows.push({ cells: [''], styleIdx: 0, height: 12 });
    allRows.push({
      cells: [`توضیحات: ${payload.notes}`],
      styleIdx: 6,
      height: 36,
      mergeFullWidth: true,
    });
  }

  if (payload.letterhead.showSignaturesFooter && payload.signatures && payload.signatures.length > 0) {
    allRows.push({ cells: [''], styleIdx: 0, height: 12 });
    allRows.push({
      cells: ['امضاکنندگان و نظرات (ثبت تاریخی)'],
      styleIdx: 5,
      height: 28,
      mergeFullWidth: true,
    });
    allRows.push({
      cells: ['نام و نام خانوادگی', 'سمت', 'تاریخ', 'وضعیت امضا', 'نظر'],
      styleIdx: 1,
      height: 28,
    });
    payload.signatures.forEach((sig, idx) => {
      allRows.push({
        cells: [
          sig.snapshotFullName,
          sig.snapshotRoleTitle,
          sig.signedDate ? formatJalaliDate(sig.signedDate) : '—',
          sig.isSignedConfirmed ? 'تأیید و امضاشده' : 'صرفاً درج نام (فاقد امضای معتبر)',
          sig.comment || '—',
        ],
        styleIdx: idx % 2 === 1 ? 4 : 3,
        height: 26,
      });
    });
  }

  const maxCols = Math.max(3, ...allRows.map((r) => r.cells.length));

  // Compute balanced column widths ignoring merged full-width banners so A4 portrait fits comfortably
  const colWidths = Array.from({ length: maxCols }, (_, ci) => {
    const maxLen = Math.max(
      14,
      ...allRows
        .filter((r) => !r.mergeFullWidth)
        .map((r) => (r.cells[ci] ? Math.min(34, String(r.cells[ci]).length) : 0))
    );
    return Math.min(36, Math.round(maxLen * 1.25 + 4));
  });

  const colsXml = colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const mergeRefs: string[] = [];

  const sheetDataXml = allRows
    .map((rowObj, rIdx) => {
      const rNum = rIdx + 1;
      const rowHeight = rowObj.height ?? 26;

      if (rowObj.mergeFullWidth && maxCols > 1) {
        const lastCol = colLetter(maxCols - 1);
        mergeRefs.push(`A${rNum}:${lastCol}${rNum}`);
        const cellsXml = Array.from({ length: maxCols }, (_, cIdx) => {
          const ref = `${colLetter(cIdx)}${rNum}`;
          const val = cIdx === 0 ? rowObj.cells[0] ?? '' : '';
          return `<c r="${ref}" t="inlineStr" s="${rowObj.styleIdx}"><is><t>${sanitizeCsvOrXml(val)}</t></is></c>`;
        }).join('');
        return `<row r="${rNum}" ht="${rowHeight}" customHeight="1">${cellsXml}</row>`;
      }

      const cellsXml = rowObj.cells
        .map((val, cIdx) => {
          const ref = `${colLetter(cIdx)}${rNum}`;
          const st = rowObj.cellStyles?.[cIdx] ?? rowObj.styleIdx;
          return `<c r="${ref}" t="inlineStr" s="${st}"><is><t>${sanitizeCsvOrXml(val)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rNum}" ht="${rowHeight}" customHeight="1">${cellsXml}</row>`;
    })
    .join('');

  const mergeCellsXml =
    mergeRefs.length > 0
      ? `<mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
      : '';

  const hasChartImage = Boolean(renderedChart);

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${hasChartImage ? '<Default Extension="png" ContentType="image/png"/>' : ''}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${hasChartImage ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="گزارش دفتر فنی" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // Explicit Zar 14pt fonts, 100% RTL (horizontal="right" + readingOrder="2"),
  // Cohesive Monochromatic Royal Navy Palette (#1D3250, #E4ECF6, #EEF3FA, #F7FAFD, #C3D2E4)
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="14"/><color rgb="FF${PALETTE.textPrimary}"/><name val="${ZAR_FONT}"/></font>
    <font><b/><sz val="14"/><color rgb="FF${PALETTE.white}"/><name val="${ZAR_FONT}"/></font>
    <font><b/><sz val="15"/><color rgb="FF${PALETTE.navyDeep}"/><name val="${ZAR_FONT}"/></font>
    <font><b/><sz val="14"/><color rgb="FF${PALETTE.navyDeep}"/><name val="${ZAR_FONT}"/></font>
    <font><sz val="13"/><color rgb="FF${PALETTE.textMuted}"/><name val="${ZAR_FONT}"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.navyDeep}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.bannerBg}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.keyBg}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.zebraBg}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.white}"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF${PALETTE.borderInner}"/></left>
      <right style="thin"><color rgb="FF${PALETTE.borderInner}"/></right>
      <top style="thin"><color rgb="FF${PALETTE.borderInner}"/></top>
      <bottom style="thin"><color rgb="FF${PALETTE.borderInner}"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF${PALETTE.navyDeep}"/></left>
      <right style="medium"><color rgb="FF${PALETTE.navyDeep}"/></right>
      <top style="medium"><color rgb="FF${PALETTE.navyDeep}"/></top>
      <bottom style="medium"><color rgb="FF${PALETTE.navyDeep}"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="2" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="4" fillId="6" borderId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`
  );

  if (renderedChart) {
    const anchorRow = allRows.length + 1;
    const widthEmu = Math.round(620 * 9525);
    const heightEmu = Math.round(((renderedChart.height / renderedChart.width) * 620) * 9525);

    zip.file('xl/media/image1.png', renderedChart.bytes);

    zip.file(
      'xl/drawings/_rels/drawing1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`
    );

    zip.file(
      'xl/drawings/drawing1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>0</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>${anchorRow}</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="${widthEmu}" cy="${heightEmu}"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="BudgetDonutChart"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
        </a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`
    );

    zip.file(
      'xl/worksheets/_rels/sheet1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`
    );
  }

  // Strict OOXML worksheet schema order: sheetPr -> sheetViews -> cols -> sheetData -> mergeCells -> pageMargins -> pageSetup (paperSize="9" = A4) -> drawing
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews>
    <sheetView workbookViewId="0" rightToLeft="1" showGridLines="1"/>
  </sheetViews>
  <cols>${colsXml}</cols>
  <sheetData>${sheetDataXml}</sheetData>
  ${mergeCellsXml}
  <pageMargins left="0.5" right="0.5" top="0.65" bottom="0.65" header="0.3" footer="0.3"/>
  <pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0" horizontalDpi="300" verticalDpi="300"/>
  ${hasChartImage ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

// Build clean RTL A4 printable HTML document (Formal text letterhead without emblem, Zar 14pt, cohesive Royal Navy palette)
export function buildPrintableReportHtml(payload: ExportTablePayload): string {
  const esc = sanitizeCsvOrXml;
  const narrativeHtml =
    payload.narrativeParagraphs && payload.narrativeParagraphs.length > 0
      ? `<div class="narrative-box">
          <h3>گزارش متنی و تحلیلی</h3>
          ${payload.narrativeParagraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>`
      : '';

  const renderedChart = renderDonutChartPng(payload.donutChartData);
  const donutHtml =
    payload.donutChartData && payload.donutChartData.segments.length > 0
      ? `<div class="chart-block">
          ${renderedChart ? `<img src="${renderedChart.dataUrl}" alt="${esc(payload.donutChartData.title)}" class="chart-img" />` : ''}
          <table>
            <thead>
              <tr><th>بخش وضعیت بودجه</th><th>مبلغ (ریال)</th><th>سهم / درصد</th></tr>
            </thead>
            <tbody>
              ${payload.donutChartData.segments
                .map(
                  (seg) =>
                    `<tr><td>${esc(seg.label)}</td><td>${esc(seg.formattedValue)}</td><td>${esc(seg.percentText)}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '';

  const summaryHtml =
    payload.summaryRows && payload.summaryRows.length > 0
      ? `<table class="meta-table">
          <tbody>
            ${payload.summaryRows
              .map(
                (r) =>
                  `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : '';

  const mainTableHtml =
    payload.headers.length > 0
      ? `<table>
          <thead>
            <tr>${payload.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${payload.rows
              .map(
                (r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : '';

  const signaturesHtml =
    payload.letterhead.showSignaturesFooter && payload.signatures && payload.signatures.length > 0
      ? `<div class="sig-block">
          <h3>امضاکنندگان و نظرات (ثبت تاریخی)</h3>
          <table>
            <thead>
              <tr>
                <th>نام و نام خانوادگی</th>
                <th>سمت</th>
                <th>تاریخ</th>
                <th>وضعیت امضا</th>
                <th>نظر</th>
              </tr>
            </thead>
            <tbody>
              ${payload.signatures
                .map(
                  (s) => `<tr>
                    <td>${esc(s.snapshotFullName)}</td>
                    <td>${esc(s.snapshotRoleTitle)}</td>
                    <td>${esc(s.signedDate ? formatJalaliDate(s.signedDate) : '—')}</td>
                    <td>${s.isSignedConfirmed ? 'تأیید و امضاشده' : 'صرفاً درج نام (فاقد امضای معتبر)'}</td>
                    <td>${esc(s.comment || '—')}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '';

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(payload.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: 'Zar', 'B Zar', Tahoma, Arial, sans-serif;
      font-size: 14pt;
      line-height: 1.75;
      color: #${PALETTE.textPrimary};
      direction: rtl;
      text-align: right;
      margin: 0;
      padding: 16px;
      background: #FFFFFF;
    }
    .letterhead {
      text-align: right;
      background: #${PALETTE.bannerBg};
      border: 1px solid #${PALETTE.borderInner};
      border-top: 3px solid #${PALETTE.navyDeep};
      border-right: 4px solid #${PALETTE.navyDeep};
      padding: 12px 16px;
      margin-bottom: 14px;
    }
    .letterhead h1 { margin: 0; font-size: 16pt; color: #${PALETTE.navyDeep}; }
    .letterhead h2 { margin: 2px 0; font-size: 14pt; font-weight: bold; color: #${PALETTE.navyMid}; }
    .letterhead p { margin: 2px 0; font-size: 12pt; color: #${PALETTE.textMuted}; }
    .doc-meta {
      margin-top: 6px;
      font-size: 12pt;
      color: #${PALETTE.textMuted};
    }
    .doc-title { font-size: 15pt; font-weight: bold; color: #${PALETTE.navyDeep}; margin: 10px 0 12px; text-align: right; }
    .narrative-box {
      margin-bottom: 14px;
      padding: 10px 14px;
      border: 1px solid #${PALETTE.borderInner};
      border-right: 4px solid #${PALETTE.navyMid};
      background: #${PALETTE.zebraBg};
      text-align: right;
    }
    .narrative-box h3 { margin: 0 0 6px; font-size: 14pt; color: #${PALETTE.navyDeep}; }
    .narrative-box p { margin: 4px 0; font-size: 13.5pt; }
    .chart-block { margin-bottom: 14px; text-align: right; }
    .chart-img { max-width: 100%; height: auto; margin-bottom: 10px; border: 1px solid #${PALETTE.borderInner}; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 13pt;
      direction: rtl;
    }
    th, td {
      border: 1px solid #${PALETTE.borderInner};
      padding: 6px 8px;
      text-align: right;
      vertical-align: middle;
    }
    th { background: #${PALETTE.navyDeep}; font-weight: bold; color: #FFFFFF; border-color: #${PALETTE.navyDeep}; }
    tbody tr:nth-child(even) td { background: #${PALETTE.zebraBg}; }
    .meta-table th { width: 34%; background: #${PALETTE.keyBg}; color: #${PALETTE.navyDeep}; border-color: #${PALETTE.borderInner}; }
    .notes { margin-top: 10px; padding: 8px 12px; border: 1px solid #${PALETTE.borderInner}; background: #${PALETTE.zebraBg}; font-size: 13pt; text-align: right; }
    .sig-block h3 { font-size: 14pt; margin: 16px 0 6px; color: #${PALETTE.navyDeep}; text-align: right; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <h1>${esc(payload.letterhead.organizationName)}</h1>
    ${payload.letterhead.unitName ? `<h2>${esc(payload.letterhead.unitName)}</h2>` : ''}
    ${payload.letterhead.subtitle ? `<p>${esc(payload.letterhead.subtitle)}</p>` : ''}
    ${
      payload.letterhead.showDateAndNumber
        ? `<div class="doc-meta">تاریخ گزارش: ${esc(formatJalaliDate(payload.date || todayIsoDate()))} &nbsp;|&nbsp; شماره: ${esc(payload.documentNumber || 'ثبت محلی')}</div>`
        : ''
    }
  </div>
  <div class="doc-title">${esc(payload.title)}</div>
  ${payload.subtitle ? `<p>${esc(payload.subtitle)}</p>` : ''}
  ${narrativeHtml}
  ${donutHtml}
  ${summaryHtml}
  ${mainTableHtml}
  ${payload.notes ? `<div class="notes"><strong>توضیحات:</strong> ${esc(payload.notes)}</div>` : ''}
  ${signaturesHtml}
</body>
</html>`;
}

export function downloadPrintableReportHtml(payload: ExportTablePayload, fileName: string): void {
  const html = buildPrintableReportHtml(payload);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerBlobDownload(blob, fileName.endsWith('.html') ? fileName : `${fileName}.html`);
}

export function exportToPdfPrint(payload: ExportTablePayload): void {
  const html = buildPrintableReportHtml(payload);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2000);
    }, 250);
  }
}

export function exportToJson(data: unknown, fileName: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  triggerBlobDownload(blob, fileName.endsWith('.json') ? fileName : `${fileName}.json`);
}
