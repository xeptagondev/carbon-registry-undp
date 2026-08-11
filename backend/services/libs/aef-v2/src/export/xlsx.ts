import * as ExcelJS from 'exceljs';

import { AEF_TABLE_ORDER, AefTableName } from '../tables';
import { toRows } from './rows';
import { AefSubmissionExport } from './submission';

/**
 * Worksheet names. Excel caps these at 31 characters and forbids `[]:*?/\`, so
 * they are short rather than the full printed table titles.
 */
const AEF_SHEET_NAMES: Readonly<Record<AefTableName, string>> = {
  t1Submission: 'T1 Submission',
  t2Authorizations: 'T2 Authorizations',
  t3Actions: 'T3 Actions',
  t4Holdings: 'T4 Holdings',
  t5AuthorizedEntities: 'T5 Authorized entities',
};

/**
 * The only file in this library that depends on ExcelJS.
 *
 * Kept out of the package barrel and imported by subpath
 * (`@app/aef-v2/export/xlsx`) so a consumer that only wants the types and CSV
 * does not pull in a spreadsheet library. `portability.spec.ts` enforces that
 * `exceljs` appears nowhere else.
 */

export interface XlsxOptions {
  /** Worksheet name. Defaults to the table name. */
  sheetName?: string;
  /**
   * Fill an existing template workbook instead of generating a sheet.
   *
   * No official CMA.6 V2 template exists yet — only the V1 Actions and Holdings
   * ones. When UNFCCC publishes them, they drop in here and rows are written
   * from `startRow`, exactly as the V1 exporter does, without a rewrite.
   */
  templatePath?: string;
  /** First data row when filling a template. 1-based. Ignored otherwise. */
  startRow?: number;
  /** Attach each column's spec footnote as a header-cell note. On by default. */
  footnotesAsNotes?: boolean;
}

const HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Times New Roman', size: 10, bold: true };
const BODY_FONT: Partial<ExcelJS.Font> = { name: 'Times New Roman', size: 10 };

/**
 * Renders one table to an XLSX buffer.
 *
 * Returns bytes, not a path or a URL: writing and uploading are registry
 * concerns. See `toCsv` for the same reasoning.
 */
export async function toXlsxBuffer<T extends Record<string, unknown>>(
  table: AefTableName,
  records: readonly T[],
  options: XlsxOptions = {},
): Promise<Buffer> {
  const { headers, columns, rows } = toRows(table, records);
  const workbook = new ExcelJS.Workbook();

  let sheet: ExcelJS.Worksheet;
  let firstDataRow: number;

  if (options.templatePath) {
    await workbook.xlsx.readFile(options.templatePath);
    const templateSheet = options.sheetName
      ? workbook.getWorksheet(options.sheetName)
      : workbook.worksheets[0];
    if (!templateSheet) {
      throw new Error(
        `Worksheet "${options.sheetName ?? '(first)'}" not found in ${options.templatePath}`,
      );
    }
    sheet = templateSheet;
    // A template already carries its own header block, so only data is written.
    firstDataRow = options.startRow ?? 2;
  } else {
    sheet = workbook.addWorksheet(options.sheetName ?? table);
    const headerRow = sheet.getRow(1);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = HEADER_FONT;
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

      const footnote = columns[index]?.footnote;
      if (footnote && options.footnotesAsNotes !== false) {
        // Preserves the CSV's Field/Footnote pairing without inventing layout.
        cell.note = footnote;
      }
    });
    headerRow.commit();
    firstDataRow = 2;
  }

  rows.forEach((row, offset) => {
    const sheetRow = sheet.getRow(firstDataRow + offset);
    row.forEach((value, index) => {
      const cell = sheetRow.getCell(index + 1);
      cell.value = value === null ? '' : value;
      cell.font = BODY_FONT;
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    });
    sheetRow.commit();
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * The whole submission as a single workbook — one sheet per table, in CMA.6
 * order.
 *
 * This is the shape a CARP submission actually takes, as opposed to
 * {@link toXlsxBuffer}, which serves a single on-screen table.
 *
 * A table with no rows still gets its sheet and header row: a submission with
 * no Actions is a meaningful statement, whereas a missing sheet just looks like
 * something failed.
 */
export async function toSubmissionXlsxBuffer(
  bundle: AefSubmissionExport,
  options: Pick<XlsxOptions, 'footnotesAsNotes'> = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const table of AEF_TABLE_ORDER) {
    const { headers, columns, rows } = toRows(table, bundle[table] ?? []);
    const sheet = workbook.addWorksheet(AEF_SHEET_NAMES[table]);

    const headerRow = sheet.getRow(1);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = HEADER_FONT;
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

      const footnote = columns[index]?.footnote;
      if (footnote && options.footnotesAsNotes !== false) {
        cell.note = footnote;
      }
    });
    headerRow.commit();

    rows.forEach((row, offset) => {
      const sheetRow = sheet.getRow(2 + offset);
      row.forEach((value, index) => {
        const cell = sheetRow.getCell(index + 1);
        cell.value = value === null ? '' : value;
        cell.font = BODY_FONT;
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
      });
      sheetRow.commit();
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
