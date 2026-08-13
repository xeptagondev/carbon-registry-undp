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
const BODY_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  wrapText: true,
  vertical: 'top',
  horizontal: 'left',
};

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

/**
 * The CARP full-report workbook, shipped **with this library** rather than by
 * the host: the template is the AEF's, not any one registry's, so a host that
 * drops `@app/aef-v2` in gets a working full-report export with nothing extra
 * to source. It lives at `src/export/templates/` alongside the code that fills it.
 *
 * The host still resolves the absolute path, because only the host knows how
 * its build lays the library out (this repo bundles with webpack, so
 * `__dirname` here is the bundle's directory, not this file's). `segments` is
 * that path relative to the library's `src` root, so a future move within the
 * library needs no change on the host side.
 *
 * @see AefV2ReportService.fullReportTemplatePath for this repo's resolution.
 */
export const AEF_FULL_REPORT_TEMPLATE = {
  fileName: 'aef_full_Report_template.xlsx',
  segments: ['export', 'templates', 'aef_full_Report_template.xlsx'],
} as const;

/**
 * Worksheet each table fills in the CARP full-report template workbook
 * ({@link AEF_FULL_REPORT_TEMPLATE}). Unlike {@link AEF_SHEET_NAMES}, these are
 * not ours to choose — they are whatever the shipped template calls its tabs,
 * so a new template revision that renames a tab is handled by updating this
 * map (or passing `sheetNames`), not by editing the fill logic.
 */
export const AEF_TEMPLATE_SHEET_NAMES: Readonly<Record<AefTableName, string>> = {
  t1Submission: 'Table 1 Submission',
  t2Authorizations: 'Table 2 Authorizations',
  t3Actions: 'Table 3 Actions',
  t4Holdings: 'Table 4 Holdings',
  t5AuthorizedEntities: 'Table 5 Auth. entities',
};

/** Template cells carrying the reporting context, above every table's header block. */
const TEMPLATE_PARTY_CELL = 'B2';
const TEMPLATE_REPORTED_YEAR_CELL = 'B3';

/**
 * How far down a sheet to look for the header row. The template's tables start
 * between rows 6 and 10 depending on how many banded sub-heading rows the table
 * has; 20 leaves room for a revision that adds more without needing a change here.
 */
const TEMPLATE_HEADER_SCAN_ROWS = 20;

/**
 * Columns the template has but {@link toRows} does not emit.
 *
 * Table 1's "Status" is the submission's own lifecycle state. `toRows` filters
 * it out because it is library metadata rather than a spec field, but the CARP
 * sheet does have a column for it, so it is filled from the record directly.
 */
const TEMPLATE_ONLY_COLUMNS: Partial<
  Record<AefTableName, ReadonlyArray<{ header: string; key: string }>>
> = {
  t1Submission: [{ header: 'Status', key: 'status' }],
};

export class AefTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AefTemplateError';
  }
}

export interface SubmissionTemplateOptions {
  /**
   * Absolute path to the CARP full-report template workbook — normally the
   * library's own shipped copy, resolved by the host from
   * {@link AEF_FULL_REPORT_TEMPLATE}.
   */
  templatePath: string;
  /** Written to each sheet's Party cell. Skipped when absent. */
  party?: string;
  /** Written to each sheet's Reported year cell. Skipped when absent. */
  reportedYear?: number;
  /** Overrides {@link AEF_TEMPLATE_SHEET_NAMES} for a renamed tab. */
  sheetNames?: Partial<Record<AefTableName, string>>;
}

/**
 * The whole submission written into the official CARP template workbook,
 * preserving its headings, banding, column widths and print setup.
 *
 * The difference from {@link toSubmissionXlsxBuffer} is not cosmetic: that one
 * generates a plain grid whose columns are the spec's, in the spec's order,
 * one header row deep. The template's grid is the one CARP actually reads —
 * its tables start at different rows per sheet and two of them (Actions,
 * Holdings) carry an unlabelled spacer column mid-table, so a positional
 * "write column N" fill would silently shift every field after it.
 *
 * Columns are therefore located by matching the spec's own `aefLabel` against
 * the template's header row, and the header row itself is found by scanning.
 * Nothing is written until every one of a table's columns has been located; a
 * template that has drifted raises {@link AefTemplateError} rather than
 * producing a partly-filled submission that looks fine until CARP rejects it.
 */
export async function toSubmissionTemplateXlsxBuffer(
  bundle: AefSubmissionExport,
  options: SubmissionTemplateOptions,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(options.templatePath);

  for (const table of AEF_TABLE_ORDER) {
    const sheetName = options.sheetNames?.[table] ?? AEF_TEMPLATE_SHEET_NAMES[table];
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      throw new AefTemplateError(
        `Worksheet "${sheetName}" not found in ${options.templatePath}. ` +
          `Available: ${workbook.worksheets.map((each) => each.name).join(', ')}`,
      );
    }

    const records = bundle[table] ?? [];
    const { headers, rows } = toRows(table, records);
    const headerRow = locateTemplateHeaderRow(sheet, sheetName, headers);
    const columns = headers.map((header) => headerRow.columns.get(normalizeHeader(header))!);

    const extras = (TEMPLATE_ONLY_COLUMNS[table] ?? [])
      .map((extra) => ({
        key: extra.key,
        column: headerRow.columns.get(normalizeHeader(extra.header)),
      }))
      .filter((extra): extra is { key: string; column: number } => extra.column !== undefined);

    stampReportingContext(sheet, options);

    const firstDataRow = headerRow.row + 1;
    const writtenColumns = [...columns, ...extras.map((extra) => extra.column)];
    // The shipped template leaves sample values under some headers (Actions'
    // "Emission reductions" / "Removals" under Mitigation type). Clearing the
    // whole data region first means those never survive into an export with
    // fewer rows than samples, where they would read as real data.
    clearTemplateDataRegion(sheet, firstDataRow, writtenColumns);

    rows.forEach((row, offset) => {
      const sheetRow = sheet.getRow(firstDataRow + offset);
      row.forEach((value, index) => {
        writeTemplateCell(sheetRow, columns[index], value);
      });
      extras.forEach((extra) => {
        const value = (records[offset] as Record<string, unknown> | undefined)?.[extra.key];
        writeTemplateCell(
          sheetRow,
          extra.column,
          value === undefined || value === null ? null : String(value),
        );
      });
      sheetRow.commit();
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function writeTemplateCell(
  row: ExcelJS.Row,
  column: number,
  value: string | number | null,
): void {
  const cell = row.getCell(column);
  cell.value = value === null ? '' : value;
  cell.font = BODY_FONT;
  cell.alignment = BODY_ALIGNMENT;
}

/**
 * Excel cell values are not always plain scalars — a header can be rich text, a
 * formula result or a hyperlink object. Flattens all of those to the text a
 * reader sees, which is what the spec labels are compared against.
 */
function templateCellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    const candidate = value as {
      richText?: { text: string }[];
      text?: string;
      result?: unknown;
    };
    if (candidate.richText) {
      return candidate.richText.map((run) => run.text).join('');
    }
    if (typeof candidate.text === 'string') {
      return candidate.text;
    }
    if (candidate.result !== undefined && candidate.result !== null) {
      return String(candidate.result);
    }
    return '';
  }
  return String(value);
}

/**
 * Header comparison is whitespace- and case-insensitive. `\s` covers U+00A0 in
 * JavaScript, so this also absorbs the non-breaking spaces published templates
 * are full of — the labels are long enough that an exact match would be brittle
 * for no benefit.
 */
function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Finds the row that carries a table's column headers, and each header's column.
 *
 * Scanned rather than hard-coded because every sheet starts its table at a
 * different row. The scan takes the best-matching row and then insists it is a
 * complete match: a partial one means the template no longer matches the spec,
 * which must fail loudly.
 */
function locateTemplateHeaderRow(
  sheet: ExcelJS.Worksheet,
  sheetName: string,
  headers: readonly string[],
): { row: number; columns: Map<string, number> } {
  const wanted = new Set(headers.map(normalizeHeader));
  const lastColumn = Math.max(sheet.columnCount, headers.length);

  let best: { row: number; columns: Map<string, number> } | undefined;
  const scanTo = Math.min(Math.max(sheet.rowCount, 1), TEMPLATE_HEADER_SCAN_ROWS);

  for (let rowNumber = 1; rowNumber <= scanTo; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const columns = new Map<string, number>();
    for (let column = 1; column <= lastColumn; column += 1) {
      const label = normalizeHeader(templateCellText(row.getCell(column).value));
      // First occurrence wins: the banded sub-heading rows above repeat some
      // labels, but within the header row itself each one appears once.
      if (label && wanted.has(label) && !columns.has(label)) {
        columns.set(label, column);
      }
    }
    if (!best || columns.size > best.columns.size) {
      best = { row: rowNumber, columns };
    }
  }

  if (!best || best.columns.size < wanted.size) {
    const found = new Set(best?.columns.keys() ?? []);
    const missing = headers.filter((header) => !found.has(normalizeHeader(header)));
    throw new AefTemplateError(
      `Worksheet "${sheetName}" is missing ${missing.length} expected column header(s): ` +
        `${missing.join(' | ')}`,
    );
  }

  // Table 1's "Status" and any other template-only column live on the same
  // row, so pick them up now that the row is known.
  const headerRow = sheet.getRow(best.row);
  for (let column = 1; column <= lastColumn; column += 1) {
    const label = normalizeHeader(templateCellText(headerRow.getCell(column).value));
    if (label && !best.columns.has(label)) {
      best.columns.set(label, column);
    }
  }

  return best;
}

/** Writes the Party / Reported year cells that head every template sheet. */
function stampReportingContext(
  sheet: ExcelJS.Worksheet,
  options: SubmissionTemplateOptions,
): void {
  if (options.party !== undefined) {
    const cell = sheet.getCell(TEMPLATE_PARTY_CELL);
    cell.value = options.party;
    cell.font = BODY_FONT;
  }
  if (options.reportedYear !== undefined) {
    const cell = sheet.getCell(TEMPLATE_REPORTED_YEAR_CELL);
    cell.value = options.reportedYear;
    cell.font = BODY_FONT;
  }
}

/** Blanks every column this fill owns, from the first data row to the sheet's end. */
function clearTemplateDataRegion(
  sheet: ExcelJS.Worksheet,
  firstDataRow: number,
  columns: readonly number[],
): void {
  for (let rowNumber = firstDataRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    // Assigning null clears the value while leaving the template's own
    // borders, fills and column widths intact.
    columns.forEach((column) => {
      row.getCell(column).value = null;
    });
    row.commit();
  }
}
