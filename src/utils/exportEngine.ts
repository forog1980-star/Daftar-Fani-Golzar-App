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
  TableLayoutType,
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

// Soft, refined, print-friendly palette (works clearly in both color and black-and-white print)
const PALETTE = {
  inkNavy: '263B54', // Primary headings & bold text (soft slate-navy, crisp in B&W)
  inkMuted: '526377', // Secondary labels & dates
  textBody: '222B35', // Crisp readable body text
  headerFill: 'F2E7C9', // Soft warm sand-gold header fill (ink-friendly, sharp in B&W)
  bannerFill: 'FAF7EE', // Ultra-light warm ivory letterhead banner
  keyFill: 'EBF0F5', // Soft cool mist-slate for summary keys & section titles
  zebraFill: 'F9F8F4', // Gentle paper-cream alternating zebra row
  narrativeFill: 'FAF9F5', // Soft narrative box background
  borderStrong: '7E92A8', // Soft slate-navy outer table border
  borderGold: 'C2A866', // Muted warm gold accent border
  borderInner: 'CFC9B8', // Subtle warm-gray grid lines
  white: 'FFFFFF',
};

// ISO A4 Portrait dimensions in twips (210mm x 297mm)
const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const A4_MARGIN_TWIP = 850; // ~15mm margins
const A4_CONTENT_WIDTH_TWIP = A4_WIDTH_TWIP - A4_MARGIN_TWIP * 2; // 10206 twips

// Standard Persian B Zar font name across Windows, Office, WPS, Android Office & LibreOffice
const BZAR_FONT = 'B Zar';
const BZAR_14PT = 28; // 14pt in OOXML half-points
const BZAR_16PT = 32; // 16pt
const BZAR_12PT = 24; // 12pt

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Create a soft colored canvas pattern that stays unmistakably distinct in BOTH color and B&W print
function createPrintFriendlyPattern(
  baseCtx: CanvasRenderingContext2D,
  bgColor: string,
  patternType: 'dots' | 'diagonal' | 'solid' | 'cross'
): string | CanvasPattern {
  if (patternType === 'solid') return bgColor;

  const tile = document.createElement('canvas');
  tile.width = 14;
  tile.height = 14;
  const tctx = tile.getContext('2d');
  if (!tctx) return bgColor;

  tctx.fillStyle = bgColor;
  tctx.fillRect(0, 0, 14, 14);

  if (patternType === 'dots') {
    tctx.fillStyle = 'rgba(38, 59, 84, 0.22)';
    tctx.beginPath();
    tctx.arc(4, 4, 1.4, 0, Math.PI * 2);
    tctx.arc(11, 11, 1.4, 0, Math.PI * 2);
    tctx.fill();
  } else if (patternType === 'diagonal') {
    tctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    tctx.lineWidth = 1.6;
    tctx.beginPath();
    tctx.moveTo(-2, 14);
    tctx.lineTo(14, -2);
    tctx.moveTo(5, 16);
    tctx.lineTo(16, 5);
    tctx.stroke();
  } else if (patternType === 'cross') {
    tctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    tctx.lineWidth = 1.1;
    tctx.beginPath();
    tctx.moveTo(0, 7);
    tctx.lineTo(14, 7);
    tctx.stroke();
  }

  return baseCtx.createPattern(tile, 'repeat') ?? bgColor;
}

function renderDonutChartPng(donut?: ExportDonutChartData): RenderedChartPng | null {
  if (!donut || donut.segments.length === 0 || typeof document === 'undefined') return null;

  const logicalW = 760;
  const logicalH = 344;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = logicalW * scale;
  canvas.height = logicalH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);

  // Soft white card background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.strokeStyle = `#${PALETTE.borderInner}`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, logicalW - 16, logicalH - 16);

  // Gentle warm-gold top accent line
  ctx.fillStyle = `#${PALETTE.borderGold}`;
  ctx.fillRect(8, 8, logicalW - 16, 4);

  // Title (RTL right-aligned, B Zar font)
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = `#${PALETTE.inkNavy}`;
  ctx.font = 'bold 18px "B Zar", "BZar", "Zar", Tahoma, sans-serif';
  ctx.fillText(donut.title, logicalW - 28, 46);

  // Soft colors with wide luminance separation + distinct textures for both color & B&W print
  const sliceThemes: Array<{ color: string; pattern: 'dots' | 'diagonal' | 'solid' | 'cross' }> = [
    { color: '#E6CA80', pattern: 'dots' },
    { color: '#6E9E89', pattern: 'diagonal' },
    { color: '#3F5D7D', pattern: 'solid' },
    { color: '#B4C3D4', pattern: 'cross' },
  ];

  // Donut on left-center so RTL legend sits naturally on the right
  const cx = 185;
  const cy = 196;
  const outerR = 104;
  const innerR = 60;
  const totalVal = donut.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);

  if (totalVal > 0) {
    let startAngle = -Math.PI / 2;
    donut.segments.forEach((seg, idx) => {
      const val = Math.max(0, seg.value);
      if (val <= 0) return;
      const sliceAngle = (val / totalVal) * Math.PI * 2;
      const theme = sliceThemes[idx % sliceThemes.length];
      const fillStyle = createPrintFriendlyPattern(ctx, theme.color, theme.pattern);

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = '#8A96A3';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = '#8A96A3';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
    ctx.closePath();
    ctx.fillStyle = '#EFECE4';
    ctx.fill();
  }

  // Center text
  ctx.textAlign = 'center';
  ctx.fillStyle = `#${PALETTE.inkNavy}`;
  ctx.font = 'bold 18px "B Zar", "BZar", "Zar", Tahoma, sans-serif';
  ctx.fillText(donut.centerValue, cx, cy - 2);
  ctx.fillStyle = `#${PALETTE.inkMuted}`;
  ctx.font = '13px "B Zar", "BZar", "Zar", Tahoma, sans-serif';
  ctx.fillText(donut.centerLabel, cx, cy + 20);

  // RTL Legend on the right side
  const legendRightX = logicalW - 30;
  let rowY = 96;
  const rowGap = 62;

  donut.segments.forEach((seg, idx) => {
    const theme = sliceThemes[idx % sliceThemes.length];
    const swatchFill = createPrintFriendlyPattern(ctx, theme.color, theme.pattern);

    ctx.fillStyle = `#${PALETTE.zebraFill}`;
    ctx.fillRect(340, rowY - 22, legendRightX - 332, 48);
    ctx.strokeStyle = `#${PALETTE.borderInner}`;
    ctx.lineWidth = 1;
    ctx.strokeRect(340, rowY - 22, legendRightX - 332, 48);

    ctx.fillStyle = swatchFill;
    ctx.fillRect(legendRightX - 24, rowY - 10, 18, 18);
    ctx.strokeStyle = '#526377';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(legendRightX - 24, rowY - 10, 18, 18);

    ctx.textAlign = 'right';
    ctx.fillStyle = `#${PALETTE.inkNavy}`;
    ctx.font = 'bold 15px "B Zar", "BZar", "Zar", Tahoma, sans-serif';
    ctx.fillText(seg.label, legendRightX - 34, rowY - 1);

    ctx.fillStyle = `#${PALETTE.inkMuted}`;
    ctx.font = '14px "B Zar", "BZar", "Zar", Tahoma, sans-serif';
    ctx.fillText(`${seg.formattedValue}  (${seg.percentText})`, legendRightX - 34, rowY + 19);

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

const CELL_MARGINS = {
  top: 85,
  bottom: 85,
  left: 100,
  right: 100,
};

const SOFT_TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 8, color: PALETTE.borderStrong },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: PALETTE.borderStrong },
  left: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
  right: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
};

function rtlTextRun(text: string, options?: { bold?: boolean; size?: number; color?: string }) {
  return new TextRun({
    text: text || '—',
    font: {
      name: BZAR_FONT,
      cs: BZAR_FONT,
      ascii: BZAR_FONT,
      hAnsi: BZAR_FONT,
      eastAsia: BZAR_FONT,
    },
    size: options?.size ?? BZAR_14PT,
    bold: options?.bold ?? false,
    color: options?.color ?? PALETTE.textBody,
    rightToLeft: true,
    language: {
      bidirectional: 'fa-IR',
    },
  });
}

// Pure <w:bidi/> paragraph with NO conflicting <w:jc w:val="left"/> so every Word processor
// (Microsoft Word, Honor Docs, WPS Office, LibreOffice, Google Docs, Apple Pages) aligns RIGHT.
function makeRtlParagraph(
  children: Array<TextRun | ImageRun>,
  spacing?: { before?: number; after?: number },
  keepNext?: boolean
) {
  return new Paragraph({
    bidirectional: true,
    spacing,
    keepNext,
    children,
  });
}

function makeRtlTableCell(
  text: string,
  options?: {
    bold?: boolean;
    color?: string;
    fill?: string;
    size?: number;
    widthDxa?: number;
    keepNext?: boolean;
  }
) {
  return new TableCell({
    verticalAlign: VerticalAlignTable.CENTER,
    margins: CELL_MARGINS,
    width:
      options?.widthDxa !== undefined
        ? { size: options.widthDxa, type: WidthType.DXA }
        : undefined,
    shading: options?.fill ? { type: ShadingType.SOLID, color: options.fill } : undefined,
    children: [
      makeRtlParagraph(
        [
          rtlTextRun(text, {
            bold: options?.bold,
            color: options?.color,
            size: options?.size ?? BZAR_14PT,
          }),
        ],
        { before: 20, after: 20 },
        options?.keepNext
      ),
    ],
  });
}

// Compute smart proportional column widths in twips (sum === A4_CONTENT_WIDTH_TWIP)
// so project codes never wrap awkwardly and title/description columns have comfortable space.
function computeSmartColumnWidths(
  headers: string[],
  rows: string[][],
  totalWidth = A4_CONTENT_WIDTH_TWIP
): number[] {
  const count = headers.length;
  if (count <= 0) return [totalWidth];
  if (count === 1) return [totalWidth];

  const weights = headers.map((header, idx) => {
    const h = header.trim();
    if (h.includes('کد') || h === 'شماره') return 1.45;
    if (h.includes('درصد') || h === 'سال' || h === 'اولویت') return 0.92;
    if (h.includes('عنوان') || h.includes('نام پروژه') || h.includes('موضوع') || h.includes('شرح')) {
      return 2.05;
    }
    if (h.includes('توضیحات') || h.includes('نتیجه')) return 1.75;
    if (h.includes('تاریخ') || h.includes('مهلت') || h.includes('وضعیت') || h.includes('نوع')) {
      return 1.08;
    }
    // Estimate from sample data
    const sampleMax = Math.max(
      h.length,
      ...rows.slice(0, 12).map((r) => String(r[idx] ?? '').length)
    );
    return Math.max(1.0, Math.min(1.85, sampleMax / 12));
  });

  const sumWeight = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w, idx) => {
    const h = headers[idx].trim();
    const minW = h.includes('کد') ? 1180 : 920;
    return Math.max(minW, Math.round((w / sumWeight) * totalWidth));
  });
  const diff = totalWidth - widths.reduce((a, b) => a + b, 0);
  widths[0] += diff;
  return widths;
}

// CRITICAL UNIVERSAL RTL TABLE BUILDER:
// Mobile Office apps (Honor Docs, WPS Mobile, Polaris, QuickLook, Google Docs) ignore <w:bidiVisual/>.
// By OMITTING visuallyRightToLeft (<w:bidiVisual/>) and placing columns in explicit visual Left-to-Right order
// (reversing logical RTL columns so column 0 sits on the FAR RIGHT and last column sits on the FAR LEFT),
// 100% of BOTH desktop (Microsoft Word, LibreOffice) AND mobile viewers (Honor Docs, WPS, Google Docs)
// render every table cleanly Right-to-Left!
function buildUniversalRtlWordTable(options: {
  logicalHeaders?: string[];
  logicalRows: Array<{
    cells: Array<{ text: string; bold?: boolean; color?: string; fill?: string; size?: number }>;
    keepNext?: boolean;
  }>;
  logicalColWidths: number[];
  headerFontSize?: number;
}): Table {
  const visualColWidths = [...options.logicalColWidths].reverse();
  const tableRows: TableRow[] = [];

  if (options.logicalHeaders && options.logicalHeaders.length > 0) {
    const visualHeaders = [...options.logicalHeaders].reverse();
    tableRows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: visualHeaders.map((h, i) =>
          makeRtlTableCell(h, {
            bold: true,
            color: PALETTE.inkNavy,
            fill: PALETTE.headerFill,
            size: options.headerFontSize ?? BZAR_12PT,
            widthDxa: visualColWidths[i],
            keepNext: true,
          })
        ),
      })
    );
  }

  options.logicalRows.forEach((rowDef) => {
    const visualCells = [...rowDef.cells].reverse();
    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: visualCells.map((cell, i) =>
          makeRtlTableCell(cell.text, {
            bold: cell.bold,
            color: cell.color,
            fill: cell.fill,
            size: cell.size ?? BZAR_12PT,
            widthDxa: visualColWidths[i],
            keepNext: rowDef.keepNext,
          })
        ),
      })
    );
  });

  return new Table({
    // Intentionally omit visuallyRightToLeft (<w:bidiVisual/>) because columns are already
    // placed in visual RTL order (Rightmost = first logical RTL column), guaranteeing
    // identical RTL rendering across Microsoft Word, Honor Docs, WPS, Google Docs & LibreOffice!
    layout: TableLayoutType.FIXED,
    columnWidths: visualColWidths,
    width: { size: A4_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
    borders: SOFT_TABLE_BORDERS,
    rows: tableRows,
  });
}

// Ensure Word OOXML section, tables, paragraphs, and default styles are 100% strictly RTL & Right-Aligned:
// - <w:sectPr><w:bidi/> for RTL section flow
// - <w:tblPr> gets <w:jc w:val="right"/> (in schema-valid position right after <w:tblW .../>)
// - Every <w:pPr> with <w:bidi/> (except explicitly centered chart paragraphs) gets explicit <w:jc w:val="right"/>
//   so BOTH desktop MS Word/LibreOffice AND mobile WPS/Honor Docs/Google Docs align every cell & paragraph RIGHT
// - word/styles.xml <w:pPrDefault> and Normal style carry <w:bidi/><w:jc w:val="right"/>
async function enforceDocxStrictRtlXml(blob: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(blob);

  const docXmlFile = zip.file('word/document.xml');
  if (docXmlFile) {
    let docXml = await docXmlFile.async('string');

    // 1. Section-level RTL
    if (docXml.includes('<w:sectPr>') && !docXml.includes('<w:sectPr><w:bidi/>')) {
      docXml = docXml.replace('<w:sectPr>', '<w:sectPr><w:bidi/>');
    }

    // 2. Table-level right alignment (<w:jc w:val="right"/> immediately after <w:tblW .../> per CT_TblPr schema)
    docXml = docXml.replace(/<w:tblPr>[\s\S]*?<\/w:tblPr>/g, (tblPr) => {
      if (tblPr.includes('<w:jc ')) return tblPr;
      if (/<w:tblW\b[^>]*\/>/.test(tblPr)) {
        return tblPr.replace(/(<w:tblW\b[^>]*\/>)/, '$1<w:jc w:val="right"/>');
      }
      return tblPr.replace('<w:tblPr>', '<w:tblPr><w:jc w:val="right"/>');
    });

    // 3. Explicit physical right alignment (<w:jc w:val="right"/>) on every RTL paragraph & table cell
    //    (preserving intentional <w:jc w:val="center"/> used for the donut chart image)
    docXml = docXml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, (pPr) => {
      if (pPr.includes('w:val="center"')) return pPr;
      let next = pPr;
      if (!next.includes('<w:bidi/>') && !next.includes('<w:bidi ')) {
        next = next.replace('<w:pPr>', '<w:pPr><w:bidi/>');
      }
      // Replace any accidental left/start justification with absolute visual right alignment
      if (/<w:jc\b[^>]*\/>/.test(next)) {
        next = next.replace(/<w:jc\b[^>]*\/>/, '<w:jc w:val="right"/>');
      } else {
        next = next.replace('</w:pPr>', '<w:jc w:val="right"/></w:pPr>');
      }
      return next;
    });

    zip.file('word/document.xml', docXml);
  }

  const stylesXmlFile = zip.file('word/styles.xml');
  if (stylesXmlFile) {
    let stylesXml = await stylesXmlFile.async('string');
    if (stylesXml.includes('<w:pPrDefault><w:pPr>')) {
      stylesXml = stylesXml.replace(/<w:pPrDefault><w:pPr>[\s\S]*?<\/w:pPr><\/w:pPrDefault>/, (blk) => {
        let next = blk;
        if (!next.includes('<w:bidi/>')) {
          next = next.replace('<w:pPr>', '<w:pPr><w:bidi/>');
        }
        if (!next.includes('<w:jc ')) {
          next = next.replace('</w:pPr>', '<w:jc w:val="right"/></w:pPr>');
        }
        return next;
      });
    } else if (stylesXml.includes('<w:pPrDefault/>')) {
      stylesXml = stylesXml.replace(
        '<w:pPrDefault/>',
        '<w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr></w:pPrDefault>'
      );
    }

    // Also ensure the Normal default paragraph style carries <w:bidi/><w:jc w:val="right"/>
    stylesXml = stylesXml.replace(
      /<w:style\b[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/,
      (styleBlock) => {
        let next = styleBlock;
        if (next.includes('<w:pPr>')) {
          if (!next.includes('<w:bidi/>') && !next.includes('<w:bidi ')) {
            next = next.replace('<w:pPr>', '<w:pPr><w:bidi/>');
          }
          if (!next.includes('<w:jc ')) {
            next = next.replace('</w:pPr>', '<w:jc w:val="right"/></w:pPr>');
          }
          return next;
        }
        return next.replace('</w:style>', '<w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr></w:style>');
      }
    );
    zip.file('word/styles.xml', stylesXml);
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function exportToWordDocx(payload: ExportTablePayload, fileName: string): Promise<void> {
  const children: Array<Paragraph | Table> = [];

  // Formal Text-Only Letterhead Box (100% RTL, B Zar font, soft warm ivory/gold styling, NO emblem)
  const letterheadParagraphs: Paragraph[] = [
    makeRtlParagraph(
      [
        rtlTextRun(payload.letterhead.organizationName, {
          bold: true,
          size: BZAR_16PT,
          color: PALETTE.inkNavy,
        }),
      ],
      { after: 40 }
    ),
  ];

  if (payload.letterhead.unitName) {
    letterheadParagraphs.push(
      makeRtlParagraph(
        [
          rtlTextRun(payload.letterhead.unitName, {
            bold: true,
            size: BZAR_14PT,
            color: PALETTE.inkMuted,
          }),
        ],
        { after: 40 }
      )
    );
  }

  if (payload.letterhead.subtitle) {
    letterheadParagraphs.push(
      makeRtlParagraph(
        [
          rtlTextRun(payload.letterhead.subtitle, {
            size: BZAR_12PT,
            color: PALETTE.inkMuted,
          }),
        ],
        { after: 40 }
      )
    );
  }

  if (payload.letterhead.showDateAndNumber) {
    letterheadParagraphs.push(
      makeRtlParagraph(
        [
          rtlTextRun(
            `تاریخ گزارش: ${formatJalaliDate(payload.date || todayIsoDate())}   |   شماره: ${payload.documentNumber || 'ثبت محلی'}`,
            { size: BZAR_12PT, color: PALETTE.inkMuted }
          ),
        ],
        { before: 40, after: 0 }
      )
    );
  }

  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      columnWidths: [A4_CONTENT_WIDTH_TWIP],
      width: { size: A4_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: PALETTE.borderGold },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: PALETTE.borderGold },
        left: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
        right: { style: BorderStyle.SINGLE, size: 12, color: PALETTE.borderStrong },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: A4_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, color: PALETTE.bannerFill },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: letterheadParagraphs,
            }),
          ],
        }),
      ],
    })
  );

  // Document Title (RTL)
  children.push(
    makeRtlParagraph(
      [rtlTextRun(payload.title, { bold: true, size: BZAR_16PT, color: PALETTE.inkNavy })],
      { before: 180, after: 120 },
      true
    )
  );

  if (payload.subtitle) {
    children.push(
      makeRtlParagraph(
        [rtlTextRun(payload.subtitle, { size: BZAR_14PT, color: PALETTE.inkMuted })],
        { after: 140 }
      )
    );
  }

  // Narrative Paragraphs (گزارش متنی راست‌چین با فونت B Zar ۱۴)
  if (payload.narrativeParagraphs && payload.narrativeParagraphs.length > 0) {
    children.push(
      makeRtlParagraph(
        [rtlTextRun('گزارش متنی و تحلیلی', { bold: true, size: BZAR_14PT, color: PALETTE.inkNavy })],
        { before: 80, after: 80 },
        true
      )
    );

    const narrativeParagraphNodes = payload.narrativeParagraphs.map((para) =>
      makeRtlParagraph([rtlTextRun(para, { size: BZAR_14PT, color: PALETTE.textBody })], {
        before: 30,
        after: 70,
      })
    );

    children.push(
      new Table({
        layout: TableLayoutType.FIXED,
        columnWidths: [A4_CONTENT_WIDTH_TWIP],
        width: { size: A4_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
          left: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.borderInner },
          right: { style: BorderStyle.SINGLE, size: 10, color: PALETTE.borderGold },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: PALETTE.white },
        },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: A4_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
                shading: { type: ShadingType.SOLID, color: PALETTE.narrativeFill },
                margins: { top: 100, bottom: 100, left: 140, right: 160 },
                children: narrativeParagraphNodes,
              }),
            ],
          }),
        ],
      })
    );
    children.push(makeRtlParagraph([], { after: 120 }));
  }

  // Embedded Donut Chart PNG + Universal Visual-RTL Breakdown Table
  if (payload.donutChartData && payload.donutChartData.segments.length > 0) {
    const renderedChart = renderDonutChartPng(payload.donutChartData);
    children.push(
      makeRtlParagraph(
        [
          rtlTextRun(payload.donutChartData.title, {
            bold: true,
            size: BZAR_14PT,
            color: PALETTE.inkNavy,
          }),
        ],
        { before: 100, after: 80 },
        true
      )
    );

    if (renderedChart) {
      children.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.CENTER,
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

    children.push(
      buildUniversalRtlWordTable({
        logicalHeaders: ['بخش وضعیت بودجه', 'مبلغ (ریال)', 'سهم / درصد'],
        logicalColWidths: [4082, 4082, 2042],
        headerFontSize: BZAR_14PT,
        logicalRows: payload.donutChartData.segments.map((seg, idx) => ({
          cells: [
            {
              text: seg.label,
              fill: idx % 2 === 1 ? PALETTE.zebraFill : PALETTE.white,
              size: BZAR_14PT,
            },
            {
              text: seg.formattedValue,
              fill: idx % 2 === 1 ? PALETTE.zebraFill : PALETTE.white,
              size: BZAR_14PT,
            },
            {
              text: seg.percentText,
              fill: idx % 2 === 1 ? PALETTE.zebraFill : PALETTE.white,
              size: BZAR_14PT,
            },
          ],
        })),
      })
    );
    children.push(makeRtlParagraph([], { after: 140 }));
  }

  // Key-value summary rows (Universal Visual-RTL: Key on the RIGHT, Value on the LEFT; kept together cleanly)
  if (payload.summaryRows && payload.summaryRows.length > 0) {
    children.push(
      buildUniversalRtlWordTable({
        logicalColWidths: [3674, 6532],
        logicalRows: payload.summaryRows.map((item, idx) => ({
          keepNext: idx < payload.summaryRows!.length - 1,
          cells: [
            {
              text: item.label,
              bold: true,
              color: PALETTE.inkNavy,
              fill: PALETTE.keyFill,
              size: BZAR_14PT,
            },
            {
              text: item.value,
              fill: idx % 2 === 1 ? PALETTE.zebraFill : PALETTE.white,
              size: BZAR_14PT,
            },
          ],
        })),
      })
    );
    children.push(makeRtlParagraph([], { after: 140 }));
  }

  // Main Data Table (Universal Visual-RTL: First logical column on the FAR RIGHT, last on the FAR LEFT)
  if (payload.headers.length > 0) {
    const mainColWidths = computeSmartColumnWidths(payload.headers, payload.rows);
    children.push(
      buildUniversalRtlWordTable({
        logicalHeaders: payload.headers,
        logicalColWidths: mainColWidths,
        headerFontSize: BZAR_12PT,
        logicalRows: payload.rows.map((row, idx) => ({
          cells: payload.headers.map((_, i) => ({
            text: row[i] ?? '—',
            fill: idx % 2 === 1 ? PALETTE.zebraFill : PALETTE.white,
            size: BZAR_12PT,
          })),
        })),
      })
    );
  }

  if (payload.notes) {
    children.push(
      makeRtlParagraph([rtlTextRun(`توضیحات: ${payload.notes}`)], { before: 160, after: 100 })
    );
  }

  // Historical Signatures Table (Universal Visual-RTL)
  if (payload.letterhead.showSignaturesFooter && payload.signatures && payload.signatures.length > 0) {
    children.push(
      makeRtlParagraph(
        [
          rtlTextRun('امضاکنندگان و نظرات (ثبت تاریخی)', {
            bold: true,
            color: PALETTE.inkNavy,
          }),
        ],
        { before: 220, after: 100 },
        true
      )
    );

    const sigHeaders = ['نام و نام خانوادگی', 'سمت', 'تاریخ', 'وضعیت امضا', 'نظر'];
    const sigRowsData = payload.signatures.map((sig) => [
      sig.snapshotFullName,
      sig.snapshotRoleTitle,
      sig.signedDate ? formatJalaliDate(sig.signedDate) : '—',
      sig.isSignedConfirmed ? 'تأیید و امضاشده' : 'صرفاً درج نام (فاقد امضای معتبر)',
      sig.comment || '—',
    ]);
    const sigColWidths = computeSmartColumnWidths(sigHeaders, sigRowsData);

    children.push(
      buildUniversalRtlWordTable({
        logicalHeaders: sigHeaders,
        logicalColWidths: sigColWidths,
        headerFontSize: BZAR_12PT,
        logicalRows: sigRowsData.map((row, idx) => ({
          cells: row.map((val) => ({
            text: val,
            fill: idx % 2 === 1 ? PALETTE.zebraFill : PALETTE.white,
            size: BZAR_12PT,
          })),
        })),
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: {
              name: BZAR_FONT,
              cs: BZAR_FONT,
              ascii: BZAR_FONT,
              hAnsi: BZAR_FONT,
              eastAsia: BZAR_FONT,
            },
            size: BZAR_14PT,
            color: PALETTE.textBody,
            rightToLeft: true,
            language: {
              bidirectional: 'fa-IR',
            },
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
            margin: {
              top: A4_MARGIN_TWIP,
              right: A4_MARGIN_TWIP,
              bottom: A4_MARGIN_TWIP,
              left: A4_MARGIN_TWIP,
            },
          },
        },
        children,
      },
    ],
  });

  const rawBlob = await Packer.toBlob(doc);
  const strictRtlBlob = await enforceDocxStrictRtlXml(rawBlob);
  triggerBlobDownload(strictRtlBlob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
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
  /** Logical layout mode so 2-col summary / 3-col donut / 5-col signature rows span full A4 width cleanly */
  spanLayout?: 'summary' | 'donut' | 'signatures';
}

// Generates a 100% spec-compliant A4 RTL Excel (.xlsx) workbook with:
// - B Zar font everywhere (with charset="178" for Persian)
// - Complete OOXML styles.xml (<cellStyleXfs> + <cellStyles> + xfId="0")
// - <bookViews> + <sheetView rightToLeft="1" tabSelected="1"/> so Column A starts on the RIGHT
// - readingOrder="2" & horizontal="right" on EVERY cell style
// - Full-width aligned RTL tables (summary, donut, main data, signatures)
// - Soft warm gold/cream & muted slate-navy palette readable in BOTH color and B&W printing
// - Explicit A4 Portrait print setup (paperSize="9", fitToWidth="1")
export async function exportToExcelXlsx(payload: ExportTablePayload, fileName: string): Promise<void> {
  const zip = new JSZip();

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

  // Narrative Paragraphs
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

  // Donut Breakdown Table (spans full A4 width)
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
      spanLayout: 'donut',
    });
    payload.donutChartData.segments.forEach((seg, idx) => {
      allRows.push({
        cells: [seg.label, seg.formattedValue, seg.percentText],
        styleIdx: idx % 2 === 1 ? 4 : 3,
        height: 26,
        spanLayout: 'donut',
      });
    });
    allRows.push({ cells: [''], styleIdx: 0, height: 12 });
  }

  // Summary Table (spans full A4 width)
  if (payload.summaryRows && payload.summaryRows.length > 0) {
    allRows.push({
      cells: ['شاخص خلاصه وضعیت', 'مقدار'],
      styleIdx: 1,
      height: 28,
      spanLayout: 'summary',
    });
    payload.summaryRows.forEach((s, idx) => {
      allRows.push({
        cells: [s.label, s.value],
        cellStyles: [5, idx % 2 === 1 ? 4 : 3],
        styleIdx: 3,
        height: 26,
        spanLayout: 'summary',
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
      spanLayout: 'signatures',
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
        spanLayout: 'signatures',
      });
    });
  }

  const maxCols = Math.max(2, ...allRows.map((r) => r.cells.length));

  const colWidths = Array.from({ length: maxCols }, (_, ci) => {
    const maxLen = Math.max(
      14,
      ...allRows
        .filter((r) => !r.mergeFullWidth && !r.spanLayout)
        .map((r) => (r.cells[ci] ? Math.min(34, String(r.cells[ci]).length) : 0))
    );
    return Math.min(36, Math.round(maxLen * 1.25 + 4));
  });

  const colsXml = colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const mergeRefs: string[] = [];

  const getSpansForLayout = (layout: ExcelRowSpec['spanLayout']): Array<[number, number]> | null => {
    if (!layout) return null;
    if (layout === 'summary') {
      if (maxCols >= 4) {
        return [
          [0, 1],
          [2, maxCols - 1],
        ];
      }
      return [
        [0, 0],
        [1, maxCols - 1],
      ];
    }
    if (layout === 'donut') {
      if (maxCols >= 5) {
        return [
          [0, 1],
          [2, maxCols - 2],
          [maxCols - 1, maxCols - 1],
        ];
      }
      if (maxCols === 4) {
        return [
          [0, 0],
          [1, 2],
          [3, 3],
        ];
      }
      return [
        [0, 0],
        [1, 1],
        [2, 2],
      ];
    }
    if (layout === 'signatures' && maxCols > 5) {
      return [
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        [4, maxCols - 1],
      ];
    }
    return null;
  };

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

      const spans = getSpansForLayout(rowObj.spanLayout);
      if (spans) {
        const cellsParts: string[] = [];
        spans.forEach(([startCol, endCol], logicalIdx) => {
          const st = rowObj.cellStyles?.[logicalIdx] ?? rowObj.styleIdx;
          const cellValue = rowObj.cells[logicalIdx] ?? '';
          if (endCol > startCol) {
            mergeRefs.push(`${colLetter(startCol)}${rNum}:${colLetter(endCol)}${rNum}`);
          }
          for (let c = startCol; c <= endCol; c++) {
            const ref = `${colLetter(c)}${rNum}`;
            const val = c === startCol ? cellValue : '';
            cellsParts.push(
              `<c r="${ref}" t="inlineStr" s="${st}"><is><t>${sanitizeCsvOrXml(val)}</t></is></c>`
            );
          }
        });
        return `<row r="${rNum}" ht="${rowHeight}" customHeight="1">${cellsParts.join('')}</row>`;
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
  const lastColLetter = colLetter(maxCols - 1);
  const totalRowsCount = Math.max(1, allRows.length);

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
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="15000" activeTab="0"/>
  </bookViews>
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

  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="14"/><color rgb="FF${PALETTE.textBody}"/><name val="${BZAR_FONT}"/><family val="2"/><charset val="178"/></font>
    <font><b/><sz val="14"/><color rgb="FF${PALETTE.inkNavy}"/><name val="${BZAR_FONT}"/><family val="2"/><charset val="178"/></font>
    <font><b/><sz val="15"/><color rgb="FF${PALETTE.inkNavy}"/><name val="${BZAR_FONT}"/><family val="2"/><charset val="178"/></font>
    <font><sz val="13"/><color rgb="FF${PALETTE.inkMuted}"/><name val="${BZAR_FONT}"/><family val="2"/><charset val="178"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.headerFill}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.bannerFill}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.keyFill}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.zebraFill}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${PALETTE.narrativeFill}"/></patternFill></fill>
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
      <left style="thin"><color rgb="FF${PALETTE.borderGold}"/></left>
      <right style="medium"><color rgb="FF${PALETTE.borderStrong}"/></right>
      <top style="medium"><color rgb="FF${PALETTE.borderGold}"/></top>
      <bottom style="medium"><color rgb="FF${PALETTE.borderStrong}"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`
  );

  if (renderedChart) {
    const anchorRow = allRows.length + 1;
    const widthEmu = Math.round(580 * 9525);
    const heightEmu = Math.round(((renderedChart.height / renderedChart.width) * 580) * 9525);

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
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`
    );
  }

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <dimension ref="A1:${lastColLetter}${totalRowsCount}"/>
  <sheetViews>
    <sheetView tabSelected="1" rightToLeft="1" workbookViewId="0" showGridLines="1">
      <selection activeCell="A1" sqref="A1"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="24"/>
  <cols>${colsXml}</cols>
  <sheetData>${sheetDataXml}</sheetData>
  ${mergeCellsXml}
  <printOptions horizontalCentered="1"/>
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

// Build clean RTL A4 printable HTML document (B Zar 14pt, soft warm sand/gold + slate palette, color & B&W print-friendly, NO emblem)
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
      font-family: 'B Zar', 'BZar', 'Zar', Tahoma, Arial, sans-serif;
      font-size: 14pt;
      line-height: 1.75;
      color: #${PALETTE.textBody};
      direction: rtl;
      text-align: right;
      margin: 0;
      padding: 16px;
      background: #FFFFFF;
    }
    .letterhead {
      text-align: right;
      background: #${PALETTE.bannerFill};
      border: 1px solid #${PALETTE.borderInner};
      border-top: 2.5px solid #${PALETTE.borderGold};
      border-bottom: 2px solid #${PALETTE.borderGold};
      border-right: 4px solid #${PALETTE.borderStrong};
      padding: 12px 16px;
      margin-bottom: 14px;
    }
    .letterhead h1 { margin: 0; font-size: 16pt; color: #${PALETTE.inkNavy}; }
    .letterhead h2 { margin: 2px 0; font-size: 14pt; font-weight: bold; color: #${PALETTE.inkMuted}; }
    .letterhead p { margin: 2px 0; font-size: 12pt; color: #${PALETTE.inkMuted}; }
    .doc-meta {
      margin-top: 6px;
      font-size: 12pt;
      color: #${PALETTE.inkMuted};
    }
    .doc-title { font-size: 15pt; font-weight: bold; color: #${PALETTE.inkNavy}; margin: 10px 0 12px; text-align: right; }
    .narrative-box {
      margin-bottom: 14px;
      padding: 10px 14px;
      border: 1px solid #${PALETTE.borderInner};
      border-right: 4px solid #${PALETTE.borderGold};
      background: #${PALETTE.narrativeFill};
      text-align: right;
    }
    .narrative-box h3 { margin: 0 0 6px; font-size: 14pt; color: #${PALETTE.inkNavy}; }
    .narrative-box p { margin: 4px 0; font-size: 13.5pt; }
    .chart-block { margin-bottom: 14px; text-align: center; }
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
    th { background: #${PALETTE.headerFill}; font-weight: bold; color: #${PALETTE.inkNavy}; border-color: #${PALETTE.borderGold}; }
    tbody tr:nth-child(even) td { background: #${PALETTE.zebraFill}; }
    .meta-table th { width: 34%; background: #${PALETTE.keyFill}; color: #${PALETTE.inkNavy}; border-color: #${PALETTE.borderInner}; }
    .notes { margin-top: 10px; padding: 8px 12px; border: 1px solid #${PALETTE.borderInner}; background: #${PALETTE.narrativeFill}; font-size: 13pt; text-align: right; }
    .sig-block h3 { font-size: 14pt; margin: 16px 0 6px; color: #${PALETTE.inkNavy}; text-align: right; }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
