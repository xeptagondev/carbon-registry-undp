import { ProjectCreateInput } from "@app/cadtrust";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CadTrustPicklistService } from "../cadtrust-picklist.service";
import { CadTrustProjectCreateSnapshot } from "../cadtrust-sync.enqueue.service";
import {
  PICKLIST_KEYS,
  PROJECT_SECTOR_FALLBACK,
  PROJECT_SECTOR_MAP,
  PROJECT_STATUS_FALLBACK,
  PROJECT_STATUS_MAP,
  PROJECT_TYPE_FALLBACK,
  PROJECT_TYPE_MAP,
  PROJECT_UNIT_METRIC,
} from "./picklist.map";

/**
 * A project-creation snapshot (+ the INF document's jsonb content) -> CAD
 * Trust `ProjectCreateInput`.
 *
 * Both inputs are chosen deliberately for what they DON'T depend on: neither
 * requires the operational-DB `project_entity` row, which is populated
 * asynchronously by the ledger replicator and cannot be assumed to exist yet
 * when this runs (see `CadTrustProjectCreateSnapshot`'s doc for why). The
 * snapshot is captured pre-ledger-write by `DocumentManagementService`; the
 * INF content comes from `document_entity`, written synchronously in the same
 * request. `project_entity` itself has no description, no dates, no country
 * and no location anyway — those arrive from the frontend as undeclared
 * fields on the INF submission, survive validation (the DTO is built without
 * `excludeExtraneousValues`) and are persisted only into
 * `document_entity.content`, which is the de-facto project record for
 * everything outside the handful of typed columns.
 */
@Injectable()
export class CadTrustProjectMapper {
  constructor(
    private readonly configService: ConfigService,
    private readonly picklistService: CadTrustPicklistService
  ) {}

  async toCreateInput(
    project: CadTrustProjectCreateSnapshot,
    infContent?: any
  ): Promise<ProjectCreateInput> {
    const sector = this.mapSector(project.sector);
    const type = this.mapType(project.sectoralScope);
    const status = this.mapStatus(project.projectProposalStage);

    // Warn-only: a stale local mapping must not stop data reaching CAD Trust.
    await this.picklistService.warnOnUnknownValues(PICKLIST_KEYS.projectSector, sector);
    await this.picklistService.warnOnUnknownValues(PICKLIST_KEYS.projectType, type);
    await this.picklistService.warnOnUnknownValues(PICKLIST_KEYS.projectStatus, [status]);

    const input: ProjectCreateInput = {
      projectId: project.refId,
      projectName: project.title,
      projectRegistryName: this.registryName(),
      projectLink: this.projectLink(project.refId),
      // Both are arrays in CAD Trust even for a single value; this registry
      // stores exactly one sector and one sectoral scope per project.
      projectSector: sector,
      projectType: type,
      projectStatus: status,
      projectStatusDate: this.toIsoDate(project.updateTime ?? project.createTime),
      projectUnitMetric: PROJECT_UNIT_METRIC,
    };

    const description = infContent?.projectDescription;
    if (typeof description === "string" && description.trim().length > 0) {
      input.projectDescription = description.trim();
    }

    return input;
  }

  private registryName(): string {
    return (
      this.configService.get<string>("cadTrustV2.registryName") ||
      this.configService.get<string>("systemName")
    );
  }

  /**
   * Public URL of the project in this registry's own UI. `host` is the frontend
   * origin (configuration.ts), and the route comes from web/src/App.tsx.
   * CAD Trust validates this as a URI, so it cannot be left blank.
   */
  private projectLink(refId: string): string {
    const host = (this.configService.get<string>("host") || "").replace(/\/+$/, "");
    return `${host}/programmeManagement/view/${refId}`;
  }

  private mapSector(sector: string): string[] {
    return [PROJECT_SECTOR_MAP[sector] ?? PROJECT_SECTOR_FALLBACK];
  }

  private mapType(sectoralScope: string): string[] {
    return [PROJECT_TYPE_MAP[sectoralScope] ?? PROJECT_TYPE_FALLBACK];
  }

  private mapStatus(stage: string): string {
    return PROJECT_STATUS_MAP[stage] ?? PROJECT_STATUS_FALLBACK;
  }

  /** Internal timestamps are epoch milliseconds; CAD Trust wants YYYY-MM-DD. */
  private toIsoDate(epochMs?: number): string {
    const date = epochMs ? new Date(Number(epochMs)) : new Date();
    return date.toISOString().split("T")[0];
  }
}
