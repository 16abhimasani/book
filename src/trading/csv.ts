// Minimal CSV parse/serialize for the trading data files (marks.csv,
// trades.csv, history/*.csv). Handles quoted fields with embedded commas;
// no streaming, files are tiny.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export interface CsvTable {
  header: string[];
  rows: Record<string, string>[];
}

export function parseCsvObjects(text: string): CsvTable {
  const raw = parseCsv(text);
  const header = raw[0] ?? [];
  const rows = raw.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj;
  });
  return { header, rows };
}

function escapeField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function serializeCsv(header: string[], rows: Record<string, string>[]): string {
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((h) => escapeField(r[h] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}
