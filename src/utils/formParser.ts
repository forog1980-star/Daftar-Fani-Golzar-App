import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { FormSectionBlock, FormTableColumn } from '../types';
import { generateId } from './format';

export interface ParsedFormImportResult {
  suggestedTitle: string;
  sourceFileName: string;
  blocks: FormSectionBlock[];
  stats: {
    headings: number;
    fields: number;
    tables: number;
    dividers: number;
    texts: number;
  };
}

const BLANK_OR_ELLIPSIS_REGEX = /(\.{3,}|…{1,}|_{3,}|-{4,}|ـ{3,})/;
const DIVIDER_ONLY_REGEX = /^[\s_\-─━═=•·*]{4,}$/;

function cleanLabelFromBlankLine(raw: string): string {
  return raw
    .replace(BLANK_OR_ELLIPSIS_REGEX, '')
    .replace(/[:：]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessFieldType(label: string): 'text' | 'date' | 'currency' | 'number' | 'textarea' {
  if (/تاریخ/.test(label)) return 'date';
  if (/مبلغ|ریال|اعتبار|هزینه|قیمت|پرداخت|کسر/.test(label)) return 'currency';
  if (/تعداد|مقدار|درصد|شماره|کد/.test(label)) return 'number';
  if (/شرح|توضیح|نظر|ملاحظات|نتیجه/.test(label)) return 'textarea';
  return 'text';
}

function makeFieldKey(label: string, idx: number): string {
  const safe = label.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '').slice(0, 12);
  return `fld_${idx}_${safe || 'item'}`;
}

export async function parseFormFile(file: File): Promise<ParsedFormImportResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx') {
    return parseDocxToFormBlocks(file);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelToFormBlocks(file);
  }
  throw new Error('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل Word (.docx) یا Excel (.xlsx) انتخاب کنید.');
}

async function parseDocxToFormBlocks(file: File): Promise<ParsedFormImportResult> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const xmlText = await zip.file('word/document.xml')?.async('string');
  if (!xmlText) {
    throw new Error('ساختار داخلی فایل Word معتبر نیست (word/document.xml یافت نشد).');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) {
    throw new Error('محتوای قابل استخراج در فایل Word یافت نشد.');
  }

  const blocks: FormSectionBlock[] = [];
  let suggestedTitle = file.name.replace(/\.docx$/i, '');
  let fieldCounter = 1;

  for (const node of Array.from(body.childNodes)) {
    const tag = node.nodeName;

    if (tag === 'w:p') {
      const pEl = node as Element;
      const texts = Array.from(pEl.getElementsByTagName('w:t')).map((t) => t.textContent ?? '');
      const fullText = texts.join('').trim();
      const hasBorder = pEl.getElementsByTagName('w:pBdr').length > 0;
      const pStyle = pEl.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ?? '';
      const isBold = pEl.getElementsByTagName('w:b').length > 0;

      if (!fullText && hasBorder) {
        blocks.push({
          id: generateId('blk'),
          kind: 'divider',
          label: 'جداکننده بخش',
        });
        continue;
      }

      if (!fullText) continue;

      if (DIVIDER_ONLY_REGEX.test(fullText)) {
        blocks.push({
          id: generateId('blk'),
          kind: 'divider',
          label: 'خط جداکننده',
        });
        continue;
      }

      // Check for blank lines / ellipses / colon-only prompt -> proposed field
      if (BLANK_OR_ELLIPSIS_REGEX.test(fullText) || /[:：]\s*$/.test(fullText)) {
        const parts = fullText.split(/(?<=[:：])\s*(?=.+[:：])|\t+/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          const label = cleanLabelFromBlankLine(trimmed) || `فیلد ${fieldCounter}`;
          blocks.push({
            id: generateId('blk'),
            kind: 'field',
            label,
            fieldKey: makeFieldKey(label, fieldCounter++),
            fieldType: guessFieldType(label),
            detectedFromPattern: true,
          });
        }
        continue;
      }

      // Heading detection
      if (/Heading|Title|عنوان/i.test(pStyle) || (isBold && fullText.length < 90)) {
        if (blocks.length === 0) {
          suggestedTitle = fullText;
        }
        blocks.push({
          id: generateId('blk'),
          kind: 'heading',
          label: fullText,
        });
        continue;
      }

      blocks.push({
        id: generateId('blk'),
        kind: 'text',
        label: 'متن راهنما / توضیح',
        content: fullText,
      });
    } else if (tag === 'w:tbl') {
      const tblEl = node as Element;
      const trNodes = Array.from(tblEl.getElementsByTagName('w:tr'));
      if (trNodes.length === 0) continue;

      const extractRowCells = (tr: Element) =>
        Array.from(tr.getElementsByTagName('w:tc')).map((tc) =>
          Array.from(tc.getElementsByTagName('w:t'))
            .map((t) => t.textContent ?? '')
            .join('')
            .trim()
        );

      const firstRow = extractRowCells(trNodes[0]).filter((c) => c.length > 0);
      // Detect key-value 2-column form table vs multi-column data table
      const isKeyValueTable =
        trNodes.length >= 2 &&
        extractRowCells(trNodes[0]).length === 2 &&
        trNodes.every((tr) => {
          const cells = extractRowCells(tr);
          return cells.length === 2 && (cells[1] === '' || BLANK_OR_ELLIPSIS_REGEX.test(cells[1]));
        });

      if (isKeyValueTable) {
        for (const tr of trNodes) {
          const cells = extractRowCells(tr);
          const label = cleanLabelFromBlankLine(cells[0] || `فیلد ${fieldCounter}`);
          if (!label) continue;
          blocks.push({
            id: generateId('blk'),
            kind: 'field',
            label,
            fieldKey: makeFieldKey(label, fieldCounter++),
            fieldType: guessFieldType(label),
            detectedFromPattern: true,
          });
        }
      } else {
        const columns: FormTableColumn[] = (firstRow.length > 0 ? firstRow : ['شرح', 'مقدار', 'توضیحات']).map(
          (header, cIdx) => ({
            key: `col_${cIdx + 1}`,
            label: header || `ستون ${cIdx + 1}`,
            type: /مبلغ|ریال|قیمت/.test(header)
              ? 'currency'
              : /تعداد|مقدار|ردیف/.test(header)
                ? 'number'
                : 'text',
          })
        );
        blocks.push({
          id: generateId('blk'),
          kind: 'table',
          label: `جدول استخراج‌شده (${columns.length} ستون)`,
          fieldKey: `tbl_${fieldCounter++}`,
          columns,
        });
      }
    }
  }

  return summarizeParsedResult(suggestedTitle, file.name, blocks);
}

async function parseExcelToFormBlocks(file: File): Promise<ParsedFormImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('فایل اکسل دارای هیچ کاربرگی نیست.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  const blocks: FormSectionBlock[] = [];
  let suggestedTitle = file.name.replace(/\.(xlsx|xls)$/i, '');
  let fieldCounter = 1;

  let i = 0;
  while (i < matrix.length) {
    const rawRow = (matrix[i] || []).map((cell) => String(cell ?? '').trim());
    const nonEmpty = rawRow.filter((c) => c.length > 0);

    if (nonEmpty.length === 0) {
      i++;
      continue;
    }

    if (nonEmpty.length === 1) {
      const text = nonEmpty[0];
      if (DIVIDER_ONLY_REGEX.test(text)) {
        blocks.push({ id: generateId('blk'), kind: 'divider', label: 'جداکننده بخش' });
      } else if (BLANK_OR_ELLIPSIS_REGEX.test(text) || /[:：]\s*$/.test(text)) {
        const label = cleanLabelFromBlankLine(text) || `فیلد ${fieldCounter}`;
        blocks.push({
          id: generateId('blk'),
          kind: 'field',
          label,
          fieldKey: makeFieldKey(label, fieldCounter++),
          fieldType: guessFieldType(label),
          detectedFromPattern: true,
        });
      } else {
        if (blocks.length === 0) suggestedTitle = text;
        blocks.push({
          id: generateId('blk'),
          kind: text.length < 85 ? 'heading' : 'text',
          label: text.length < 85 ? text : 'توضیحات',
          content: text.length >= 85 ? text : undefined,
        });
      }
      i++;
      continue;
    }

    // Detect Label + Blank/Dots pair row -> proposed field
    const firstNonEmptyIdx = rawRow.findIndex((c) => c.length > 0);
    const secondVal = rawRow[firstNonEmptyIdx + 1] ?? '';
    if (
      nonEmpty.length === 2 &&
      (BLANK_OR_ELLIPSIS_REGEX.test(secondVal) || /[:：]\s*$/.test(rawRow[firstNonEmptyIdx]))
    ) {
      const label = cleanLabelFromBlankLine(rawRow[firstNonEmptyIdx]);
      blocks.push({
        id: generateId('blk'),
        kind: 'field',
        label: label || `فیلد ${fieldCounter}`,
        fieldKey: makeFieldKey(label || 'field', fieldCounter++),
        fieldType: guessFieldType(label),
        detectedFromPattern: true,
      });
      i++;
      continue;
    }

    // Multi-column header -> Table block
    if (nonEmpty.length >= 3) {
      const columns: FormTableColumn[] = nonEmpty.map((h, idx) => ({
        key: `col_${idx + 1}`,
        label: h,
        type: /مبلغ|ریال|قیمت/.test(h)
          ? 'currency'
          : /تعداد|مقدار|ردیف/.test(h)
            ? 'number'
            : 'text',
      }));
      blocks.push({
        id: generateId('blk'),
        kind: 'table',
        label: `جدول ${firstSheetName} (${columns.length} ستون)`,
        fieldKey: `tbl_${fieldCounter++}`,
        columns,
      });
      // Skip subsequent empty/sample rows that belong to the same table
      i++;
      while (i < matrix.length) {
        const nextRow = (matrix[i] || []).map((c) => String(c ?? '').trim());
        const nextNonEmpty = nextRow.filter((c) => c.length > 0);
        if (nextNonEmpty.length === 0 || nextNonEmpty.length === 1) break;
        i++;
      }
      continue;
    }

    // Pair of labels -> two fields
    for (const cell of nonEmpty) {
      const label = cleanLabelFromBlankLine(cell);
      if (!label) continue;
      blocks.push({
        id: generateId('blk'),
        kind: 'field',
        label,
        fieldKey: makeFieldKey(label, fieldCounter++),
        fieldType: guessFieldType(label),
        detectedFromPattern: BLANK_OR_ELLIPSIS_REGEX.test(cell),
      });
    }
    i++;
  }

  return summarizeParsedResult(suggestedTitle, file.name, blocks);
}

function summarizeParsedResult(
  suggestedTitle: string,
  sourceFileName: string,
  blocks: FormSectionBlock[]
): ParsedFormImportResult {
  return {
    suggestedTitle,
    sourceFileName,
    blocks,
    stats: {
      headings: blocks.filter((b) => b.kind === 'heading').length,
      fields: blocks.filter((b) => b.kind === 'field').length,
      tables: blocks.filter((b) => b.kind === 'table').length,
      dividers: blocks.filter((b) => b.kind === 'divider').length,
      texts: blocks.filter((b) => b.kind === 'text').length,
    },
  };
}
