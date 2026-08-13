import {
  AefBundleDeps,
  AefRolloverOptions,
  AefSubmissionDefaults,
  AefTableName,
  AuthorizedEntitiesProvider,
  HoldingsProvider,
  loadSubmissionBundle,
  openReportingYear,
  SubmitOptions,
  submitAefReport,
  toAefSubmissionExport,
  toCsv,
  toSubmissionCsv,
  toValidationBundle,
  validateSubmission,
} from "@app/aef-v2";
import {
  AEF_FULL_REPORT_TEMPLATE,
  toSubmissionTemplateXlsxBuffer,
  toXlsxBuffer,
} from "@app/aef-v2/export/xlsx";
import { Inject, Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

import { ExportFileType } from "../enum/export.file.type.enum";
import { FileHandlerInterface } from "../file-handler/filehandler.interface";
import { AefStoreFactory } from "./aef-v2-store.factory";
import {
  AEF_AUTHORIZED_ENTITIES_PROVIDER,
  AEF_HOLDINGS_PROVIDER,
  AEF_SUBMISSION_DEFAULTS,
} from "./aef-v2.tokens";
import { RegistryControlledValueProvider } from "./providers/registry-controlled-values.provider";

export interface AefV2DownloadResult {
  url: string;
  outputFileName: string;
}

/**
 * The controller-facing service: query, validate, submit, export, and the
 * year rollover. Every AEF table read or write goes through `@app/aef-v2` —
 * this service assembles the library's ports from registry infrastructure
 * and otherwise just forwards to the library's own operations.
 */
@Injectable()
export class AefV2ReportService {
  constructor(
    private readonly storeFactory: AefStoreFactory,
    @Inject(AEF_SUBMISSION_DEFAULTS) private readonly defaults: AefSubmissionDefaults,
    @Inject(AEF_HOLDINGS_PROVIDER) private readonly holdings: HoldingsProvider,
    @Inject(AEF_AUTHORIZED_ENTITIES_PROVIDER)
    private readonly authorizedEntities: AuthorizedEntitiesProvider,
    private readonly fileHandler: FileHandlerInterface,
    private readonly controlledValues: RegistryControlledValueProvider
  ) {}

  private deps(): AefBundleDeps {
    return {
      store: this.storeFactory.forManager(),
      holdings: this.holdings,
      authorizedEntities: this.authorizedEntities,
    };
  }

  async loadBundle(reportedYear: number) {
    return loadSubmissionBundle(this.deps(), this.defaults, reportedYear);
  }

  /**
   * Requirement 4: one table's rows for a reporting year.
   *
   * Deliberately built on `loadSubmissionBundle`, not a raw `AefStore.find`
   * — the library's store has no notion of "this year", so a caller reading
   * a single table directly would have to resolve Submission versions and,
   * for Holdings/Authorized entities, the live-vs-frozen split itself. The
   * bundle already does all of that.
   */
  async query(table: AefTableName, reportedYear: number) {
    const bundle = await this.loadBundle(reportedYear);
    const exportData = toAefSubmissionExport(bundle);
    return {
      data: exportData[table] ?? [],
      provisional:
        table === "t4Holdings"
          ? bundle.provisional.holdings
          : table === "t5AuthorizedEntities"
            ? bundle.provisional.authorizedEntities
            : false,
      snapshotAt:
        table === "t4Holdings"
          ? bundle.snapshotAt.holdings
          : table === "t5AuthorizedEntities"
            ? bundle.snapshotAt.authorizedEntities
            : undefined,
    };
  }

  async validate(reportedYear: number) {
    const bundle = await this.loadBundle(reportedYear);
    return validateSubmission(toValidationBundle(bundle), { controlledValues: this.controlledValues });
  }

  async submit(reportedYear: number, options: SubmitOptions = {}) {
    return submitAefReport(this.deps(), this.defaults, reportedYear, options);
  }

  /**
   * The start-of-year rollover. Deliberately not exposed over HTTP — see
   * AefV2SchedulerService (in-process cron) and src/aef-rollover (the
   * serverless one-shot trigger), both of which call this and nothing else.
   */
  async rollover(options: AefRolloverOptions = {}) {
    return openReportingYear(this.deps(), this.defaults, options);
  }

  config(): AefSubmissionDefaults {
    return this.defaults;
  }

  async download(
    reportedYear: number,
    fileType: ExportFileType,
    table?: AefTableName
  ): Promise<AefV2DownloadResult> {
    const bundle = await this.loadBundle(reportedYear);
    const exportData = toAefSubmissionExport(bundle);

    const stamp = new Date().getTime();
    const extension = fileType === ExportFileType.XLSX ? "xlsx" : "csv";
    const outputFileName = `aef-v2-submission-${reportedYear}-${stamp}.${extension}`;

    let content: string;
    if (fileType === ExportFileType.XLSX) {
      const buffer = table
        ? await toXlsxBuffer(table, exportData[table] ?? [])
        : // The full report goes into the official CARP workbook rather than a
          // generated grid — see toSubmissionTemplateXlsxBuffer.
          await toSubmissionTemplateXlsxBuffer(exportData, {
            templatePath: this.fullReportTemplatePath(),
            party: this.defaults.aefT1SubmissionParty,
            reportedYear,
          });
      content = buffer.toString("base64");
    } else {
      const csv = table ? toCsv(table, exportData[table] ?? []) : toSubmissionCsv(exportData);
      content = Buffer.from(csv, "utf8").toString("base64");
    }

    const url = await this.fileHandler.uploadFile("documents/exports/" + outputFileName, content);
    return { url, outputFileName };
  }

  /**
   * Locates the CARP full-report workbook that ships inside `@app/aef-v2`.
   *
   * The library declares its own layout ({@link AEF_FULL_REPORT_TEMPLATE});
   * only the `dist/aef-v2/src` prefix is this repo's business, and it comes
   * from nest-cli.json's asset rule for `libs/aef-v2/src/export/templates/**`
   * plus the fact that the webpack bundle's `__dirname` is `dist`. Same shape
   * as `AefReportManagementService.fillTemplate` uses for the V1 templates.
   *
   * Checked explicitly so a packaging slip fails with the missing path rather
   * than ExcelJS's bare ENOENT.
   */
  private fullReportTemplatePath(): string {
    const templatePath = path.resolve(
      __dirname,
      "aef-v2",
      "src",
      ...AEF_FULL_REPORT_TEMPLATE.segments
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `AEF V2 full-report template not found at ${templatePath}. ` +
          `Check that nest-cli.json still copies libs/aef-v2/src/export/templates into the build output.`
      );
    }
    return templatePath;
  }
}
