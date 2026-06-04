// Parser for Excel (.xlsx) and CSV (.csv) rubric files
// Filename: src/lib/rubricParser.ts

export interface RubricTemplateSettings {
  headerRowIndex: number;
  maxScoreColumnKey: string | null;
  autoAddScoreColumn: boolean;
  scoreColumnLabel: string;
  commentColumnLabel: string;
}

export interface ParsedRubric {
  headers: string[];
  rows: Record<string, string>[];
  maxScoreColumnKey: string | null;
  settings: RubricTemplateSettings;
}

/**
 * Custom robust CSV parser that handles commas, semicolons, quotes, and newlines.
 */
export function parseCSVText(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++; // skip the escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      
      // Only add non-empty rows
      if (row.length > 0 && row.some(c => c !== '')) {
        lines.push(row);
      }
      row = [];
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF
      }
    } else {
      cell += char;
    }
  }
  
  // Handle trailing cell or row
  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) {
      lines.push(row);
    }
  }
  
  return lines;
}

/**
 * Parses Excel files using dynamically loaded SheetJS.
 */
export async function parseExcelFile(file: File): Promise<string[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const xlsxUrl = "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";
  
  try {
    // Dynamically load SheetJS from CDN and bypass bundler compile-time checks
    const XLSX = await import(/* @vite-ignore */ xlsxUrl);
    
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Không tìm thấy sheet nào trong file Excel.");
    }
    
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    
    // Normalize cells to strings
    return rawData.map(row => 
      row.map(cell => 
        cell === null || cell === undefined ? '' : String(cell).trim()
      )
    );
  } catch (err) {
    console.error("SheetJS dynamic import/parse failed:", err);
    throw new Error("Không thể đọc dữ liệu từ file Excel.");
  }
}

/**
 * Normalizes raw row data (string[][]) into a structured table format.
 */
export function normalizeRawGrid(rawGrid: string[][]): ParsedRubric {
  // 1. Filter out completely empty rows
  const cleanGrid = rawGrid.map(row => row.map(c => c.trim()))
                           .filter(row => row.some(cell => cell !== ''));
  
  if (cleanGrid.length === 0) {
    throw new Error("Rubric phải có ít nhất một dòng dữ liệu.");
  }

  // 2. The first non-empty row is treated as the header row
  const headerRow = cleanGrid[0];
  const uniqueHeaders: string[] = [];
  
  headerRow.forEach((header, index) => {
    let finalHeader = header.trim();
    if (!finalHeader) {
      finalHeader = `Cột ${index + 1}`;
    }
    // Handle duplicate header names
    let counter = 1;
    let tempHeader = finalHeader;
    while (uniqueHeaders.includes(tempHeader)) {
      tempHeader = `${finalHeader}_${counter}`;
      counter++;
    }
    uniqueHeaders.push(tempHeader);
  });

  // 3. Process data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < cleanGrid.length; i++) {
    const rawRow = cleanGrid[i];
    const record: Record<string, string> = {};
    uniqueHeaders.forEach((header, colIndex) => {
      record[header] = rawRow[colIndex] || '';
    });
    rows.push(record);
  }

  // 4. Try to identify the max score column (Điểm tối đa)
  let maxScoreColumnKey: string | null = null;
  const maxScoreKeywords = [
    'điểm tối đa', 'diem toi da', 'điểm max', 'diem max', 
    'max score', 'max_score', 'maxscore', 'điểm_tối_đa',
    'điểm tối đa (nếu có)'
  ];

  for (const header of uniqueHeaders) {
    const lowerHeader = header.toLowerCase().trim();
    if (maxScoreKeywords.some(keyword => lowerHeader.includes(keyword) || keyword.includes(lowerHeader))) {
      maxScoreColumnKey = header;
      break;
    }
  }

  return {
    headers: uniqueHeaders,
    rows,
    maxScoreColumnKey,
    settings: {
      headerRowIndex: 0,
      maxScoreColumnKey,
      autoAddScoreColumn: true,
      scoreColumnLabel: "Điểm chấm",
      commentColumnLabel: "Nhận xét"
    }
  };
}

/**
 * General parser function that accepts a File and returns a ParsedRubric.
 */
export async function parseRubricFile(file: File): Promise<ParsedRubric> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let rawGrid: string[][];

  if (extension === 'csv') {
    const text = await file.text();
    rawGrid = parseCSVText(text);
  } else if (extension === 'xlsx') {
    rawGrid = await parseExcelFile(file);
  } else {
    throw new Error("File không đúng định dạng. Vui lòng tải lên file .xlsx hoặc .csv.");
  }

  return normalizeRawGrid(rawGrid);
}
