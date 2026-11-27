import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import JSZip from 'jszip';
import { LetterheadConfig, SignatureSnapshot } from '../types';
import { formatJalaliDate, sanitizeCsvOrXml, todayIsoDate } from './format';

export interface ExportTablePayload {
  title: string;
  subtitle?: string;
  documentNumber?: string;
  date?: string;
  letterhead: LetterheadConfig;
  summaryRows?: Array<{ label: string; value: string }>;
  headers: string[];
  rows: string[][];
  notes?: string;
  signatures?: SignatureSnapshot[];
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
    color: options?.color ?? '2B3033',
    rightToLeft: true,
  });
}

export async function exportToWordDocx(payload: ExportTablePayload, fileName: string): Promise<void> {
  const children: Array<Paragraph | Table> = [];

  // Selectable Organizational Letterhead
  children.push(
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        rtlTextRun(payload.letterhead.organizationName, { bold: true, size: ZAR_16PT }),
      ],
    })
  );

  if (payload.letterhead.unitName) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [rtlTextRun(payload.letterhead.unitName, { bold: true, size: ZAR_14PT })],
      })
    );
  }

  if (payload.letterhead.subtitle) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [rtlTextRun(payload.letterhead.subtitle, { size: ZAR_12PT, color: '5B6268' })],
      })
    );
  }

  if (payload.letterhead.showDateAndNumber) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        children: [
          rtlTextRun(
            `تاریخ: ${formatJalaliDate(payload.date || todayIsoDate())}   |   شماره: ${payload.documentNumber || 'ثبت محلی'}`,
            { size: ZAR_12PT, color: '5B6268' }
          ),
        ],
      })
    );
  }

  // Document Title
  children.push(
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { before: 120, after: 140 },
      children: [rtlTextRun(payload.title, { bold: true, size: ZAR_16PT, color: '243B5A' })],
    })
  );

  if (payload.subtitle) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 160 },
        children: [rtlTextRun(payload.subtitle, { size: ZAR_14PT, color: '5B6268' })],
      })
    );
  }

  // Key-value summary rows
  if (payload.summaryRows && payload.summaryRows.length > 0) {
    const summaryTableRows = payload.summaryRows.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: 'F3EFE6' },
              children: [
                new Paragraph({
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT,
                  children: [rtlTextRun(item.label, { bold: true })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT,
                  children: [rtlTextRun(item.value)],
                }),
              ],
            }),
          ],
        })
    );

    children.push(
      new Table({
        visuallyRightToLeft: true,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2DDD0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2DDD0' },
        },
        rows: summaryTableRows,
      })
    );
    children.push(new Paragraph({ bidirectional: true, spacing: { after: 160 }, children: [] }));
  }

  // Main Data Table (RTL)
  if (payload.headers.length > 0) {
    const headerRow = new TableRow({
      tableHeader: true,
      children: payload.headers.map(
        (h) =>
          new TableCell({
            shading: { type: ShadingType.SOLID, color: 'EAE5D8' },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                children: [rtlTextRun(h, { bold: true })],
              }),
            ],
          })
      ),
    });

    const dataRows = payload.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cellText) =>
              new TableCell({
                children: [
                  new Paragraph({
                    bidirectional: true,
                    alignment: AlignmentType.RIGHT,
                    children: [rtlTextRun(cellText)],
                  }),
                ],
              })
          ),
        })
    );

    children.push(
      new Table({
        visuallyRightToLeft: true,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2DDD0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2DDD0' },
        },
        rows: [headerRow, ...dataRows],
      })
    );
  }

  if (payload.notes) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 180, after: 120 },
        children: [rtlTextRun(`توضیحات: ${payload.notes}`)],
      })
    );
  }

  // Historical Signatures Table (Section 13)
  if (payload.letterhead.showSignaturesFooter && payload.signatures && payload.signatures.length > 0) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 240, after: 100 },
        children: [rtlTextRun('امضاکنندگان و نظرات (ثبت تاریخی):', { bold: true })],
      })
    );

    const sigRows = [
      new TableRow({
        tableHeader: true,
        children: ['نام و نام خانوادگی', 'سمت', 'تاریخ', 'وضعیت امضا', 'نظر'].map(
          (lbl) =>
            new TableCell({
              shading: { type: ShadingType.SOLID, color: 'F3EFE6' },
              children: [
                new Paragraph({
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT,
                  children: [rtlTextRun(lbl, { bold: true })],
                }),
              ],
            })
        ),
      }),
      ...payload.signatures.map(
        (sig) =>
          new TableRow({
            children: [
              sig.snapshotFullName,
              sig.snapshotRoleTitle,
              sig.signedDate ? formatJalaliDate(sig.signedDate) : '—',
              sig.isSignedConfirmed ? 'تأیید و امضاشده' : 'صرفاً درج نام (فاقد امضای معتبر)',
              sig.comment || '—',
            ].map(
              (val) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      bidirectional: true,
                      alignment: AlignmentType.RIGHT,
                      children: [rtlTextRun(val)],
                    }),
                  ],
                })
            ),
          })
      ),
    ];

    children.push(
      new Table({
        visuallyRightToLeft: true,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CFC9B8' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2DDD0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2DDD0' },
        },
        rows: sigRows,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
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

// Generates a spec-compliant RTL Excel (.xlsx) workbook with Zar 14pt font & Persian table formatting
export async function exportToExcelXlsx(payload: ExportTablePayload, fileName: string): Promise<void> {
  const zip = new JSZip();

  const allRows: Array<{ cells: string[]; styleIdx: number }> = [];
  allRows.push({ cells: [payload.letterhead.organizationName], styleIdx: 2 });
  if (payload.letterhead.unitName) {
    allRows.push({ cells: [payload.letterhead.unitName], styleIdx: 2 });
  }
  allRows.push({ cells: [payload.title], styleIdx: 2 });
  if (payload.letterhead.showDateAndNumber) {
    allRows.push({
      cells: [
        `تاریخ گزارش: ${formatJalaliDate(payload.date || todayIsoDate())}`,
        `شماره: ${payload.documentNumber || 'ثبت محلی'}`,
      ],
      styleIdx: 0,
    });
  }
  allRows.push({ cells: [''], styleIdx: 0 });

  if (payload.summaryRows && payload.summaryRows.length > 0) {
    for (const s of payload.summaryRows) {
      allRows.push({ cells: [s.label, s.value], styleIdx: 0 });
    }
    allRows.push({ cells: [''], styleIdx: 0 });
  }

  if (payload.headers.length > 0) {
    allRows.push({ cells: payload.headers, styleIdx: 1 });
    for (const r of payload.rows) {
      allRows.push({ cells: r, styleIdx: 3 });
    }
  }

  if (payload.notes) {
    allRows.push({ cells: [''], styleIdx: 0 });
    allRows.push({ cells: ['توضیحات', payload.notes], styleIdx: 0 });
  }

  if (payload.letterhead.showSignaturesFooter && payload.signatures && payload.signatures.length > 0) {
    allRows.push({ cells: [''], styleIdx: 0 });
    allRows.push({
      cells: ['نام و نام خانوادگی', 'سمت', 'تاریخ', 'وضعیت امضا', 'نظر'],
      styleIdx: 1,
    });
    for (const sig of payload.signatures) {
      allRows.push({
        cells: [
          sig.snapshotFullName,
          sig.snapshotRoleTitle,
          sig.signedDate ? formatJalaliDate(sig.signedDate) : '—',
          sig.isSignedConfirmed ? 'تأیید و امضاشده' : 'صرفاً درج نام (فاقد امضای معتبر)',
          sig.comment || '—',
        ],
        styleIdx: 3,
      });
    }
  }

  const maxCols = Math.max(1, ...allRows.map((r) => r.cells.length));
  const colWidths = Array.from({ length: maxCols }, (_, ci) => {
    const maxLen = Math.max(
      14,
      ...allRows.map((r) => (r.cells[ci] ? String(r.cells[ci]).length : 0))
    );
    return Math.min(48, Math.round(maxLen * 1.35 + 4));
  });

  const colsXml = colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const sheetDataXml = allRows
    .map((rowObj, rIdx) => {
      const rNum = rIdx + 1;
      const cellsXml = rowObj.cells
        .map((val, cIdx) => {
          const ref = `${colLetter(cIdx)}${rNum}`;
          return `<c r="${ref}" t="inlineStr" s="${rowObj.styleIdx}"><is><t>${sanitizeCsvOrXml(val)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rNum}" ht="26" customHeight="1">${cellsXml}</row>`;
    })
    .join('');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
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

  // Explicit Zar 14pt fonts, RTL readingOrder="2", borders, and clean milky header fill
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="14"/><name val="Zar"/></font>
    <font><b/><sz val="14"/><name val="Zar"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAE5D8"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCFC9B8"/></left>
      <right style="thin"><color rgb="FFCFC9B8"/></right>
      <top style="thin"><color rgb="FFCFC9B8"/></top>
      <bottom style="thin"><color rgb="FFCFC9B8"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0" rightToLeft="1"/>
  </sheetViews>
  <cols>${colsXml}</cols>
  <sheetData>${sheetDataXml}</sheetData>
</worksheet>`
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

// Build clean RTL A4 printable HTML document
export function buildPrintableReportHtml(payload: ExportTablePayload): string {
  const esc = sanitizeCsvOrXml;
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
    @page { size: A4; margin: 16mm; }
    body {
      font-family: 'Zar', 'B Zar', Tahoma, Arial, sans-serif;
      font-size: 13pt;
      line-height: 1.75;
      color: #2B3033;
      direction: rtl;
      margin: 0;
      padding: 16px;
      background: #FFFFFF;
    }
    .letterhead {
      text-align: center;
      border-bottom: 1.5px solid #243B5A;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .letterhead h1 { margin: 0; font-size: 15pt; color: #1D3250; }
    .letterhead h2 { margin: 2px 0; font-size: 13pt; font-weight: normal; color: #354F73; }
    .letterhead p { margin: 2px 0; font-size: 11pt; color: #5B6268; }
    .doc-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11pt;
      color: #5B6268;
      margin-bottom: 12px;
    }
    .doc-title { font-size: 14pt; font-weight: bold; color: #243B5A; margin: 8px 0 12px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11.5pt;
    }
    th, td {
      border: 1px solid #BDB7A7;
      padding: 6px 8px;
      text-align: right;
      vertical-align: top;
    }
    th { background: #F3EFE6; font-weight: bold; color: #243B5A; }
    .meta-table th { width: 32%; }
    .notes { margin-top: 10px; padding: 8px 10px; border: 1px solid #D4CEBF; font-size: 11.5pt; }
    .sig-block h3 { font-size: 13pt; margin: 16px 0 6px; color: #243B5A; }
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
  </div>
  ${
    payload.letterhead.showDateAndNumber
      ? `<div class="doc-meta">
          <span>تاریخ: ${esc(formatJalaliDate(payload.date || todayIsoDate()))}</span>
          <span>شماره: ${esc(payload.documentNumber || 'ثبت محلی')}</span>
        </div>`
      : ''
  }
  <div class="doc-title">${esc(payload.title)}</div>
  ${payload.subtitle ? `<p>${esc(payload.subtitle)}</p>` : ''}
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
