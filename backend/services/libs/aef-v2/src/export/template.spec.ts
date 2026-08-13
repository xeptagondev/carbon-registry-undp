import * as ExcelJS from 'exceljs';

import { AEF_TABLE_ORDER } from '../tables';
import {
  AEF_FULL_REPORT_TEMPLATE,
  AEF_TEMPLATE_SHEET_NAMES,
  AefTemplateError,
  toSubmissionTemplateXlsxBuffer,
} from './xlsx';

/**
 * Guards the contract between the shipped CARP workbook
 * (`src/export/templates/aef_full_Report_template.xlsx`) and the field spec.
 *
 * `toSubmissionTemplateXlsxBuffer` locates columns by header text, so a
 * template revision that renames or drops a column fails here rather than
 * silently producing a submission with values in the wrong cells.
 *
 * Joined with a string rather than `path.join`: `path` is not in
 * `portability.spec.ts`'s dependency budget, and the library keeps it that way
 * on purpose. Under Jest `__dirname` is this file's own directory, so the
 * template sits right beside it.
 */
const TEMPLATE_PATH = `${__dirname}/templates/${AEF_FULL_REPORT_TEMPLATE.fileName}`;

/**
 * Where each sheet's table actually starts in the shipped template. Not used by
 * the fill itself - it scans for the header row - but asserted here so a
 * template whose layout shifts is noticed deliberately.
 */
const FIRST_DATA_ROW: Record<string, number> = {
  'Table 1 Submission': 7,
  'Table 2 Authorizations': 8,
  'Table 3 Actions': 11,
  'Table 4 Holdings': 10,
  'Table 5 Auth. entities': 8,
};

const submission = {
  aefT1SubmissionParty: 'NGA',
  aefT1SubmissionVersion: '1.0',
  aefT1SubmissionReportYear: 2026,
  aefT1SubmissionNdcFirstYear: 2021,
  aefT1SubmissionNdcLastYear: 2030,
  status: 'DRAFT',
  id: 'sub-1',
};

const action = {
  aefT3ActionsDate: '2026-08-11T12:14:03.356Z',
  aefT3ActionsType: 'First transfer',
  aefT3ActionsSubtype: 'First transfer to another Party',
  aefT3ActionsAuthorizationId: '8',
  aefT3ActionsItmoFirstId: 2917,
  aefT3ActionsItmoLastId: 3916,
  aefT3ActionsQuantityTCo2: 1000,
  aefT3ActionsMitigationType: 'Emission reductions',
  aefT3ActionsVintageYear: 2026,
  aefT3ActionsAcquiringPartyId: 'JPN',
  id: 'action-1',
};

const holding = {
  aefT4HoldingsAuthorizationId: '9',
  aefT4HoldingsQuantityTCo2: 500,
  aefT4HoldingsMitigationType: 'Removals',
  aefT4HoldingsVintageYear: 2026,
};

const bundle = {
  t1Submission: [submission],
  t3Actions: [action],
  t4Holdings: [holding],
};

const load = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
};

const columnOf = (sheet: ExcelJS.Worksheet, headerRow: number, label: string): number => {
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const value = sheet.getRow(headerRow).getCell(column).value;
    if (typeof value === 'string' && value.replace(/\s+/g, ' ').trim() === label) {
      return column;
    }
  }
  throw new Error(`Header "${label}" not found on row ${headerRow} of ${sheet.name}`);
};

describe('full-report template', () => {
  it('ships with the library, at the path it advertises', async () => {
    const workbook = new ExcelJS.Workbook();
    await expect(workbook.xlsx.readFile(TEMPLATE_PATH)).resolves.toBeDefined();
  });

  it('keeps every sheet the fill expects', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const names = workbook.worksheets.map((sheet) => sheet.name);

    for (const table of AEF_TABLE_ORDER) {
      expect(names).toContain(AEF_TEMPLATE_SHEET_NAMES[table]);
    }
  });

  it('fills without error, which means every spec column was located', async () => {
    await expect(
      toSubmissionTemplateXlsxBuffer(bundle, {
        templatePath: TEMPLATE_PATH,
        party: 'NGA',
        reportedYear: 2026,
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('stamps Party and Reported year on every sheet', async () => {
    const workbook = await load(
      await toSubmissionTemplateXlsxBuffer(bundle, {
        templatePath: TEMPLATE_PATH,
        party: 'NGA',
        reportedYear: 2026,
      }),
    );

    for (const table of AEF_TABLE_ORDER) {
      const sheet = workbook.getWorksheet(AEF_TEMPLATE_SHEET_NAMES[table])!;
      expect(sheet.getCell('B2').value).toBe('NGA');
      expect(sheet.getCell('B3').value).toBe(2026);
    }
  });

  it("writes each table's first row at the template's own start row", async () => {
    const workbook = await load(
      await toSubmissionTemplateXlsxBuffer(bundle, { templatePath: TEMPLATE_PATH }),
    );

    const t1 = workbook.getWorksheet('Table 1 Submission')!;
    expect(t1.getRow(FIRST_DATA_ROW['Table 1 Submission']).getCell(1).value).toBe('NGA');

    const t3 = workbook.getWorksheet('Table 3 Actions')!;
    expect(t3.getRow(FIRST_DATA_ROW['Table 3 Actions']).getCell(2).value).toBe('First transfer');
  });

  /**
   * The regression this whole approach exists to prevent: Actions and Holdings
   * both carry an unlabelled spacer column mid-table, so a positional fill
   * would land Mitigation type, Vintage and everything after them one column to
   * the left.
   */
  it('skips the unlabelled spacer column in Actions and Holdings', async () => {
    const workbook = await load(
      await toSubmissionTemplateXlsxBuffer(bundle, { templatePath: TEMPLATE_PATH }),
    );

    const t3 = workbook.getWorksheet('Table 3 Actions')!;
    const t3Row = t3.getRow(FIRST_DATA_ROW['Table 3 Actions']);
    expect(t3Row.getCell(columnOf(t3, 10, 'Mitigation type')).value).toBe('Emission reductions');
    expect(t3Row.getCell(columnOf(t3, 10, 'Vintage')).value).toBe(2026);
    // Column 18 sits between "Quantity (in non-GHG metric)" and "Mitigation
    // type" and has no header - nothing may be written into it.
    expect(t3.getRow(10).getCell(18).value ?? '').toBe('');
    expect(t3Row.getCell(18).value ?? '').toBe('');

    const t4 = workbook.getWorksheet('Table 4 Holdings')!;
    const t4Row = t4.getRow(FIRST_DATA_ROW['Table 4 Holdings']);
    expect(t4Row.getCell(columnOf(t4, 9, 'Mitigation type')).value).toBe('Removals');
    expect(t4Row.getCell(columnOf(t4, 9, 'Vintage')).value).toBe(2026);
    expect(t4.getRow(9).getCell(15).value ?? '').toBe('');
    expect(t4Row.getCell(15).value ?? '').toBe('');
  });

  /** `Status` is filtered out of `toRows` as library metadata, but the CARP sheet has a column for it. */
  it("fills Table 1's template-only Status column", async () => {
    const workbook = await load(
      await toSubmissionTemplateXlsxBuffer(bundle, { templatePath: TEMPLATE_PATH }),
    );

    const t1 = workbook.getWorksheet('Table 1 Submission')!;
    const statusColumn = columnOf(t1, 6, 'Status');
    expect(t1.getRow(FIRST_DATA_ROW['Table 1 Submission']).getCell(statusColumn).value).toBe(
      'DRAFT',
    );
  });

  /**
   * The shipped template parks "Emission reductions" / "Removals" under the
   * Actions Mitigation type header as sample values. They must not survive into
   * an export, or a submission with one action appears to have two.
   */
  it("clears the template's sample values below the written rows", async () => {
    const workbook = await load(
      await toSubmissionTemplateXlsxBuffer({ t3Actions: [action] }, { templatePath: TEMPLATE_PATH }),
    );

    const t3 = workbook.getWorksheet('Table 3 Actions')!;
    const mitigationType = columnOf(t3, 10, 'Mitigation type');
    expect(t3.getRow(11).getCell(mitigationType).value).toBe('Emission reductions'); // the real row
    expect(t3.getRow(12).getCell(mitigationType).value ?? '').toBe(''); // the sample, gone
  });

  it('leaves a table with no rows empty rather than dropping its sheet', async () => {
    const workbook = await load(
      await toSubmissionTemplateXlsxBuffer({}, { templatePath: TEMPLATE_PATH }),
    );

    const t5 = workbook.getWorksheet('Table 5 Auth. entities')!;
    expect(t5).toBeDefined();
    expect(t5.getRow(FIRST_DATA_ROW['Table 5 Auth. entities']).getCell(1).value ?? '').toBe('');
  });

  it('raises AefTemplateError for a renamed sheet rather than filling nothing', async () => {
    await expect(
      toSubmissionTemplateXlsxBuffer(bundle, {
        templatePath: TEMPLATE_PATH,
        sheetNames: { t3Actions: 'Nope' },
      }),
    ).rejects.toBeInstanceOf(AefTemplateError);
  });
});
