import { Student } from '../types';

export interface ParsedCsvTable {
  headers: string[];
  rows: string[][];
  suggestedNameCol: number;
  suggestedSeatCol: number | null;
  hasHeaderRow: boolean;
}

const NAME_HEADER_HINTS = [
  '姓名',
  '學生姓名',
  '名字',
  '學生',
  'name',
  'student',
  'student name',
  'full name',
];

const SEAT_HEADER_HINTS = ['座號', '學號', '編號', 'no', 'id', 'number', 'seat'];

export function createStudentId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `stu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Decodes an uploaded CSV file with automatic Big5 fallback for Excel-exported Traditional Chinese CSVs.
 */
export async function decodeCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  const utf8Text = utf8Decoder.decode(buffer);

  // If replacement character appears, try Big5 (common on Windows Excel in Taiwan/HK)
  if (utf8Text.includes('\uFFFD')) {
    try {
      const big5Decoder = new TextDecoder('big5', { fatal: false });
      const big5Text = big5Decoder.decode(buffer);
      const utf8BadCount = (utf8Text.match(/\uFFFD/g) || []).length;
      const big5BadCount = (big5Text.match(/\uFFFD/g) || []).length;
      if (big5BadCount < utf8BadCount) {
        return big5Text.replace(/^\uFEFF/, '');
      }
    } catch {
      // Big5 not supported in some environments; fall back to UTF-8
    }
  }

  return utf8Text.replace(/^\uFEFF/, '');
}

/**
 * Parses RFC-4180 style CSV text into rows of cells, auto-detecting delimiter (, ; \t).
 */
export function parseCsvMatrix(rawText: string): string[][] {
  const cleanText = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount >= semiCount) delimiter = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

  const rows: string[][] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }
  return rows;
}

export function analyzeCsvTable(rawText: string): ParsedCsvTable {
  const matrix = parseCsvMatrix(rawText);
  if (matrix.length === 0) {
    return {
      headers: [],
      rows: [],
      suggestedNameCol: 0,
      suggestedSeatCol: null,
      hasHeaderRow: false,
    };
  }

  const maxCols = Math.max(...matrix.map((r) => r.length));
  const normalized = matrix.map((r) => {
    const copy = [...r];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  const firstRow = normalized[0];
  const lowerFirst = firstRow.map((cell) => cell.toLowerCase().trim());

  let suggestedNameCol = -1;
  let suggestedSeatCol: number | null = null;

  lowerFirst.forEach((cell, idx) => {
    if (suggestedNameCol === -1 && NAME_HEADER_HINTS.some((h) => cell === h || cell.includes(h))) {
      suggestedNameCol = idx;
    }
    if (suggestedSeatCol === null && SEAT_HEADER_HINTS.some((h) => cell === h || cell.includes(h))) {
      suggestedSeatCol = idx;
    }
  });

  const hasHeaderRow = suggestedNameCol !== -1 || suggestedSeatCol !== null;

  if (suggestedNameCol === -1) {
    // Heuristic: pick the first non-numeric column from row 1 or 0
    const sampleRow = normalized.length > 1 ? normalized[1] : normalized[0];
    const nonNumericIdx = sampleRow.findIndex((val) => val.length > 0 && !/^\d+$/.test(val));
    suggestedNameCol = nonNumericIdx !== -1 ? nonNumericIdx : 0;
  }

  const headers = hasHeaderRow
    ? firstRow.map((h, i) => h || `第 ${i + 1} 欄`)
    : firstRow.map((_, i) => `第 ${i + 1} 欄`);

  const dataRows = hasHeaderRow ? normalized.slice(1) : normalized;

  return {
    headers,
    rows: dataRows,
    suggestedNameCol,
    suggestedSeatCol,
    hasHeaderRow,
  };
}

/**
 * Parses pasted plain text (one per line, or separated by commas, Chinese commas, tabs, semicolons).
 */
export function parsePastedNames(rawText: string): Student[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/[\n,、;；\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Skip common single-word header if user pasted a column header from Excel
  const filtered = lines.filter((item, idx) => {
    if (idx === 0 && NAME_HEADER_HINTS.includes(item.toLowerCase())) {
      return false;
    }
    return true;
  });

  return filtered.map((name) => ({
    id: createStudentId(),
    name,
    present: true,
  }));
}

export const SAMPLE_STUDENTS_NAMES = [
  '陳柏宇',
  '林子晴',
  '黃品睿',
  '張語桐',
  '李承翰',
  '王宥希',
  '吳宇軒',
  '劉若曦',
  '蔡定謙',
  '楊芷晴',
  '許恩碩',
  '鄭可欣',
  '謝翔宇',
  '郭心妍',
  '曾柏翔',
  '邱品潔',
  '廖奕辰',
  '徐若寧',
  '周品諺',
  '賴思妤',
  '葉秉澄',
  '莊芸熙',
  '蘇子豪',
  '何采潔',
];

export function createSampleRoster(): Student[] {
  return SAMPLE_STUDENTS_NAMES.map((name, idx) => ({
    id: createStudentId(),
    name,
    seatNo: String(idx + 1).padStart(2, '0'),
    present: true,
  }));
}
