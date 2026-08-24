import { CadTrustValidationError } from "@app/cadtrust";

import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { CadTrustSyncStatus } from "../../enum/cadtrust.sync.status.enum";
import { ProjectProposalStage } from "../../enum/projectProposalStage.enum";
import { DocumentTypeEnum } from "../../enum/document.type.enum";
import { CadTrustProjectCreateHandler } from "./project-create.handler";

const REF_ID = "0042";
const COMPANY_ID = 7;

const STAKEHOLDER_KEY = {
  localEntityType: CadTrustLocalEntityType.STAKEHOLDER,
  localId: String(COMPANY_ID),
  cadTrustEntityType: CadTrustResourceType.STAKEHOLDER,
};
const PROJECT_KEY = {
  localEntityType: CadTrustLocalEntityType.PROJECT,
  localId: REF_ID,
  cadTrustEntityType: CadTrustResourceType.PROJECT,
};
const PROJECT_METHODOLOGY_KEY = {
  localEntityType: CadTrustLocalEntityType.PROJECT_METHODOLOGY,
  localId: REF_ID,
  cadTrustEntityType: CadTrustResourceType.PROJECT_METHODOLOGY,
};
const STAKEHOLDER_PROJECT_KEY = {
  localEntityType: CadTrustLocalEntityType.STAKEHOLDER_PROJECT,
  localId: REF_ID,
  cadTrustEntityType: CadTrustResourceType.STAKEHOLDER_PROJECT,
};
const LOCATION_KEY = {
  localEntityType: CadTrustLocalEntityType.LOCATION,
  localId: REF_ID,
  cadTrustEntityType: CadTrustResourceType.LOCATION,
};

// The queue payload — a snapshot captured before the ledger write, not a
// project_entity read. See CadTrustProjectCreateSnapshot's doc for why.
const SNAPSHOT = {
  refId: REF_ID,
  title: "Kunene Solar",
  sector: "ENERGY",
  sectoralScope: "ENERGY_INDUSTRIES",
  projectProposalStage: ProjectProposalStage.PENDING,
  createTime: 1_700_000_000_000,
  updateTime: 1_700_000_000_000,
  companyId: COMPANY_ID,
};

const COMPANY = { companyId: COMPANY_ID, name: "Kunene Developers", website: "https://kunenedev.example.org" };
const INF_WITH_LOCATION = { projectDescription: "d", province: "Kunene" };

type EntityKey = "stakeholder" | "project" | "methodology" | "stakeholderProject" | "location";

function buildHandler(
  overrides: {
    enabled?: boolean;
    /** Sub-entity already COMMITTED — nothing to do. */
    alreadySynced?: Partial<Record<EntityKey, boolean>>;
    /** Sub-entity STAGED by a prior run whose commit never landed — commit owed, no re-stage. */
    staged?: Partial<Record<EntityKey, boolean>>;
    /** Sub-entity FAILED by a prior run — triggers the orphan-adopt lookup before re-staging. */
    failed?: Partial<Record<EntityKey, boolean>>;
    syncedProgramId?: string | undefined;
    syncedMethodologyId?: string | undefined;
    company?: any;
    infContent?: any;
    stageStakeholder?: jest.Mock;
    stageProject?: jest.Mock;
    stageProjectMethodology?: jest.Mock;
    stageStakeholderProject?: jest.Mock;
    stageLocation?: jest.Mock;
    /** Stub for `client.staging.listAll` — the orphan-adopt lookup. Defaults to yielding nothing. */
    stagingListAll?: jest.Mock;
    commit?: jest.Mock;
  } = {}
) {
  const alreadySynced = overrides.alreadySynced ?? {};
  const staged = overrides.staged ?? {};
  const failed = overrides.failed ?? {};

  const stageStakeholder =
    overrides.stageStakeholder ??
    jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", uuid: "staging-stakeholder-1", cadTrustStakeholderId: "cadt-stakeholder-1", success: true },
    }));
  const stageProject =
    overrides.stageProject ??
    jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", uuid: "staging-project-1", cadTrustProjectId: "cadt-project-1", success: true },
    }));
  const stageProjectMethodology =
    overrides.stageProjectMethodology ??
    jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", uuid: "staging-pm-1", cadTrustProjectMethodologyId: "cadt-pm-1", success: true },
    }));
  const stageStakeholderProject =
    overrides.stageStakeholderProject ??
    jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", uuid: "staging-sp-1", cadTrustStakeholderProjectId: "cadt-sp-1", success: true },
    }));
  const stageLocation =
    overrides.stageLocation ??
    jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", uuid: "staging-loc-1", cadTrustLocationId: "cadt-loc-1", success: true },
    }));

  const documentRepo = {
    findOne: jest.fn(async () => ({ content: overrides.infContent ?? INF_WITH_LOCATION })),
  };
  const companyRepo = {
    findOne: jest.fn(async () => (overrides.company === undefined ? COMPANY : overrides.company)),
  };

  const syncedIds: Record<string, string> = {
    STAKEHOLDER: "cadt-stakeholder-cached",
    PROJECT: "cadt-project-cached",
    PROJECT_METHODOLOGY: "cadt-pm-cached",
    STAKEHOLDER_PROJECT: "cadt-sp-cached",
    LOCATION: "cadt-loc-cached",
  };

  const entityKeyFor = (localEntityType: CadTrustLocalEntityType): EntityKey | undefined => {
    switch (localEntityType) {
      case CadTrustLocalEntityType.STAKEHOLDER:
        return "stakeholder";
      case CadTrustLocalEntityType.PROJECT:
        return "project";
      case CadTrustLocalEntityType.PROJECT_METHODOLOGY:
        return "methodology";
      case CadTrustLocalEntityType.STAKEHOLDER_PROJECT:
        return "stakeholderProject";
      case CadTrustLocalEntityType.LOCATION:
        return "location";
      default:
        return undefined;
    }
  };

  const syncRecords = {
    // Backs `existingSync()`. `alreadySynced`/`staged`/`failed` map onto the three statuses the
    // handler distinguishes — COMMITTED (nothing to do), STAGED (commit owed, don't re-stage),
    // FAILED (triggers the orphan-adopt lookup before re-staging).
    find: jest.fn(async (key: any) => {
      const entityKey = entityKeyFor(key.localEntityType);
      if (!entityKey) {
        return null;
      }
      const syncStatus = alreadySynced[entityKey]
        ? CadTrustSyncStatus.COMMITTED
        : staged[entityKey]
        ? CadTrustSyncStatus.STAGED
        : failed[entityKey]
        ? CadTrustSyncStatus.FAILED
        : undefined;
      return syncStatus ? { syncStatus, cadTrustId: syncedIds[key.localEntityType] } : null;
    }),
    getSyncedCadTrustId: jest.fn(async (_localEntityType: any, cadTrustEntityType: any) => {
      if (cadTrustEntityType === CadTrustResourceType.PROGRAM) return overrides.syncedProgramId;
      if (cadTrustEntityType === CadTrustResourceType.METHODOLOGY) {
        // Distinguish "not specified" (default: bootstrapped) from an explicit
        // `undefined` override (not yet bootstrapped) — `??` can't tell these
        // apart, since both read as `undefined`.
        return "syncedMethodologyId" in overrides ? overrides.syncedMethodologyId : "cadt-methodology-1";
      }
      return undefined;
    }),
    markStaged: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
  };

  const projectMapper = { toCreateInput: jest.fn(async () => ({ projectId: REF_ID })) };
  const stakeholderMapper = {
    toCreateInput: jest.fn(async (company: any) => ({
      stakeholderName: company.name,
      stakeholderType: "Developer",
      ...(company.website ? { stakeholderLink: company.website } : {}),
    })),
  };
  const locationMapper = {
    toCreateInput: jest.fn(async (cadTrustProjectId: string, infContent: any) =>
      infContent?.province
        ? { cadTrustProjectId, locationCountry: "CountryX", locationRegion: infContent.province }
        : undefined
    ),
  };

  const commitHandler = { handle: overrides.commit ?? jest.fn(async () => undefined) };

  // The orphan-adopt lookup (adoptOrphanedStagedRow) — defaults to "the node has nothing".
  const stagingListAll = overrides.stagingListAll ?? jest.fn(async function* () {});

  const cadTrustV2Service = {
    getClient: () => ({
      stakeholder: { stageCreate: stageStakeholder },
      project: { stageCreate: stageProject },
      projectMethodology: { stageCreate: stageProjectMethodology },
      stakeholderProject: { stageCreate: stageStakeholderProject },
      location: { stageCreate: stageLocation },
      staging: { listAll: stagingListAll },
    }),
  };
  const configService = { get: () => overrides.enabled ?? true };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  const handler = new CadTrustProjectCreateHandler(
    documentRepo as any,
    companyRepo as any,
    syncRecords as any,
    projectMapper as any,
    stakeholderMapper as any,
    locationMapper as any,
    commitHandler as any,
    cadTrustV2Service as any,
    configService as any,
    logger as any
  );

  return {
    handler,
    documentRepo,
    companyRepo,
    syncRecords,
    projectMapper,
    stakeholderMapper,
    locationMapper,
    commitHandler,
    stageStakeholder,
    stageProject,
    stageProjectMethodology,
    stageStakeholderProject,
    stageLocation,
    stagingListAll,
    logger,
  };
}

describe("CadTrustProjectCreateHandler", () => {
  it("stages the stakeholder, the project, both links and the location, then commits inline", async () => {
    const {
      handler,
      syncRecords,
      stageStakeholder,
      stageProject,
      stageProjectMethodology,
      stageStakeholderProject,
      stageLocation,
      commitHandler,
    } = buildHandler({ syncedProgramId: "cadt-program-1" });

    await handler.handle(SNAPSHOT);

    expect(stageStakeholder).toHaveBeenCalledTimes(1);
    expect(syncRecords.markStaged).toHaveBeenCalledWith(
      STAKEHOLDER_KEY,
      { cadTrustId: "cadt-stakeholder-1", stagingUuid: "staging-stakeholder-1" },
      expect.any(Object)
    );

    expect(stageProject).toHaveBeenCalledWith(expect.objectContaining({ cadTrustProgramId: "cadt-program-1" }));
    expect(syncRecords.markStaged).toHaveBeenCalledWith(
      PROJECT_KEY,
      { cadTrustId: "cadt-project-1", stagingUuid: "staging-project-1" },
      expect.objectContaining({ cadTrustProgramId: "cadt-program-1" })
    );

    expect(stageProjectMethodology).toHaveBeenCalledWith({
      cadTrustProjectId: "cadt-project-1",
      cadTrustMethodologyId: "cadt-methodology-1",
      projectMethodologyDate: "2023-11-14",
    });
    expect(stageStakeholderProject).toHaveBeenCalledWith({
      cadTrustStakeholderId: "cadt-stakeholder-1",
      cadTrustProjectId: "cadt-project-1",
    });
    expect(stageLocation).toHaveBeenCalledTimes(1);

    expect(commitHandler.handle).toHaveBeenCalledTimes(1);
  });

  it("does not set cadTrustProgramId when no program is synced yet", async () => {
    const { handler, stageProject } = buildHandler({ syncedProgramId: undefined });

    await handler.handle(SNAPSHOT);

    const input = stageProject.mock.calls[0][0];
    expect(input).not.toHaveProperty("cadTrustProgramId");
  });

  describe("stakeholder dedup", () => {
    it("reuses the cached stakeholder id and creates only the relation when the company is already synced", async () => {
      const { handler, stageStakeholder, stageStakeholderProject } = buildHandler({
        alreadySynced: { stakeholder: true },
      });

      await handler.handle(SNAPSHOT);

      expect(stageStakeholder).not.toHaveBeenCalled();
      expect(stageStakeholderProject).toHaveBeenCalledWith({
        cadTrustStakeholderId: "cadt-stakeholder-cached",
        cadTrustProjectId: "cadt-project-1",
      });
    });
  });

  describe("location", () => {
    it("skips gracefully — not a failure — when the INF has no location data", async () => {
      const { handler, stageLocation, syncRecords } = buildHandler({ infContent: { projectDescription: "d" } });

      await handler.handle(SNAPSHOT);

      expect(stageLocation).not.toHaveBeenCalled();
      expect(syncRecords.markFailed).not.toHaveBeenCalledWith(LOCATION_KEY, expect.anything());
    });
  });

  describe("project-methodology link", () => {
    it("is marked FAILED with a clear message when no methodology has been bootstrapped yet", async () => {
      const { handler, syncRecords, stageProjectMethodology } = buildHandler({ syncedMethodologyId: undefined });

      await handler.handle(SNAPSHOT);

      expect(stageProjectMethodology).not.toHaveBeenCalled();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(PROJECT_METHODOLOGY_KEY, expect.any(Error));
      const call: any[] = syncRecords.markFailed.mock.calls.find(
        (args: any[]) => args[0].localEntityType === CadTrustLocalEntityType.PROJECT_METHODOLOGY
      );
      expect(call[1].message).toContain("Bootstrap");
    });
  });

  describe("idempotency", () => {
    it("does not commit when every sub-entity is already synced", async () => {
      const { handler, commitHandler, stageStakeholder, stageProject, stageProjectMethodology, stageStakeholderProject, stageLocation } =
        buildHandler({
          alreadySynced: {
            stakeholder: true,
            project: true,
            methodology: true,
            stakeholderProject: true,
            location: true,
          },
        });

      await handler.handle(SNAPSHOT);

      expect(stageStakeholder).not.toHaveBeenCalled();
      expect(stageProject).not.toHaveBeenCalled();
      expect(stageProjectMethodology).not.toHaveBeenCalled();
      expect(stageStakeholderProject).not.toHaveBeenCalled();
      expect(stageLocation).not.toHaveBeenCalled();
      expect(commitHandler.handle).not.toHaveBeenCalled();
    });
  });

  describe("commit-owed status (previously staged, never committed)", () => {
    // Regression coverage for the bug fixed here: isAlreadySynced() collapsed STAGED and
    // COMMITTED into one "already synced" true, so a resource staged by a run that died before
    // committing made every ensureX report no commit owed, and the inline commit never re-fired.
    it("does not re-stage any sub-entity when everything is STAGED, but still commits once", async () => {
      const {
        handler,
        commitHandler,
        stageStakeholder,
        stageProject,
        stageProjectMethodology,
        stageStakeholderProject,
        stageLocation,
      } = buildHandler({
        staged: {
          stakeholder: true,
          project: true,
          methodology: true,
          stakeholderProject: true,
          location: true,
        },
      });

      await handler.handle(SNAPSHOT);

      expect(stageStakeholder).not.toHaveBeenCalled();
      expect(stageProject).not.toHaveBeenCalled();
      expect(stageProjectMethodology).not.toHaveBeenCalled();
      expect(stageStakeholderProject).not.toHaveBeenCalled();
      expect(stageLocation).not.toHaveBeenCalled();
      expect(commitHandler.handle).toHaveBeenCalledTimes(1);
    });

    it("commits once when only one sub-entity is STAGED and the rest are already COMMITTED", async () => {
      const { handler, commitHandler, stageLocation } = buildHandler({
        alreadySynced: { stakeholder: true, project: true, methodology: true, stakeholderProject: true },
        staged: { location: true },
      });

      await handler.handle(SNAPSHOT);

      expect(stageLocation).not.toHaveBeenCalled();
      expect(commitHandler.handle).toHaveBeenCalledTimes(1);
    });

    it("still resolves the project's cadTrustId when only the project is STAGED, so downstream links use it", async () => {
      const { handler, stageProject, stageProjectMethodology, stageStakeholderProject, stageLocation } =
        buildHandler({ staged: { project: true } });

      await handler.handle(SNAPSHOT);

      expect(stageProject).not.toHaveBeenCalled();
      expect(stageProjectMethodology).toHaveBeenCalledWith(
        expect.objectContaining({ cadTrustProjectId: "cadt-project-cached" })
      );
      expect(stageStakeholderProject).toHaveBeenCalledWith(
        expect.objectContaining({ cadTrustProjectId: "cadt-project-cached" })
      );
      expect(stageLocation).toHaveBeenCalledWith(
        expect.objectContaining({ cadTrustProjectId: "cadt-project-cached" })
      );
    });
  });

  describe("orphaned staging rows after an ambiguous failure (504 recovery)", () => {
    // Live dev testing (2026-08-24) hit 504 Gateway time-out from Cloudflare on /stakeholder and
    // /project — an ambiguous failure, since the origin may have created the row before it
    // stopped answering. A blind re-stage on the next delivery would duplicate it on the node.
    it("adopts a matching uncommitted row on the node instead of re-staging, when the sync record is FAILED", async () => {
      const stagingListAll = jest.fn(async function* (query: any) {
        if (query.table === "stakeholder") {
          yield {
            uuid: "staging-orphan-1",
            committed: false,
            failed_commit: false,
            diff: { change: [{ stakeholder_name: "Kunene Developers" }] },
          };
        }
      });
      const { handler, commitHandler, stageStakeholder, syncRecords } = buildHandler({
        failed: { stakeholder: true },
        stagingListAll,
      });

      await handler.handle(SNAPSHOT);

      expect(stageStakeholder).not.toHaveBeenCalled();
      expect(syncRecords.markStaged).toHaveBeenCalledWith(
        STAKEHOLDER_KEY,
        { cadTrustId: "staging-orphan-1", stagingUuid: "staging-orphan-1" },
        { stakeholder_name: "Kunene Developers" }
      );
      expect(commitHandler.handle).toHaveBeenCalledTimes(1);
    });

    it("stages normally when FAILED but the node holds no matching uncommitted row", async () => {
      const { handler, stageStakeholder, syncRecords } = buildHandler({ failed: { stakeholder: true } });

      await handler.handle(SNAPSHOT);

      expect(stageStakeholder).toHaveBeenCalledTimes(1);
      expect(syncRecords.markStaged).toHaveBeenCalledWith(
        STAKEHOLDER_KEY,
        { cadTrustId: "cadt-stakeholder-1", stagingUuid: "staging-stakeholder-1" },
        expect.any(Object)
      );
    });

    it("ignores a node row that is already committed, and stages a fresh one instead", async () => {
      const stagingListAll = jest.fn(async function* (query: any) {
        if (query.table === "stakeholder") {
          yield {
            uuid: "staging-orphan-1",
            committed: true,
            failed_commit: false,
            diff: { change: [{ stakeholder_name: "Kunene Developers" }] },
          };
        }
      });
      const { handler, stageStakeholder } = buildHandler({ failed: { stakeholder: true }, stagingListAll });

      await handler.handle(SNAPSHOT);

      expect(stageStakeholder).toHaveBeenCalledTimes(1);
    });
  });

  it("reads the latest INF document via the repository, not DocumentManagementService", async () => {
    const { handler, documentRepo } = buildHandler();

    await handler.handle(SNAPSHOT);

    expect(documentRepo.findOne).toHaveBeenCalledWith({
      where: { programmeId: REF_ID, type: DocumentTypeEnum.INITIAL_NOTIFICATION_FORM },
      order: { version: "DESC" },
    });
  });

  describe("the head-of-line guarantee", () => {
    // A throw here stalls the shared async-operations cursor and stops every
    // queued action in the system, email included.
    it("does not rethrow, and skips every downstream step, when staging the project fails", async () => {
      const error = new CadTrustValidationError("projectLink must be a valid URI", {
        method: "POST",
        url: "http://localhost:31310/v2/project",
        status: 400,
        body: { message: "projectLink must be a valid URI", success: false },
      });
      const stageProject = jest.fn(async () => {
        throw error;
      });
      const { handler, syncRecords, stageProjectMethodology, stageStakeholderProject, stageLocation, commitHandler } =
        buildHandler({ stageProject });

      await expect(handler.handle(SNAPSHOT)).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(PROJECT_KEY, error, expect.any(Object));
      expect(stageProjectMethodology).not.toHaveBeenCalled();
      expect(stageStakeholderProject).not.toHaveBeenCalled();
      expect(stageLocation).not.toHaveBeenCalled();
      // The stakeholder alone may still have staged — still worth committing.
      expect(commitHandler.handle).toHaveBeenCalledTimes(1);
    });

    it("does not rethrow when staging the stakeholder fails, and still stages the project", async () => {
      const stageStakeholder = jest.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      });
      const { handler, syncRecords, stageProject } = buildHandler({ stageStakeholder });

      await expect(handler.handle(SNAPSHOT)).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(
        STAKEHOLDER_KEY,
        expect.any(Error),
        expect.any(Object)
      );
      expect(stageProject).toHaveBeenCalledTimes(1);
    });

    it("does not rethrow when the company is not found", async () => {
      const { handler, syncRecords, stageStakeholder } = buildHandler({ company: null });

      await expect(handler.handle(SNAPSHOT)).resolves.toBeUndefined();
      expect(stageStakeholder).not.toHaveBeenCalled();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(STAKEHOLDER_KEY, expect.any(Error));
    });

    it("does not rethrow when staging the location fails", async () => {
      const stageLocation = jest.fn(async () => {
        throw new Error("CAD Trust rejected the location payload");
      });
      const { handler, syncRecords } = buildHandler({ stageLocation });

      await expect(handler.handle(SNAPSHOT)).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(
        LOCATION_KEY,
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("does not rethrow when staging the stakeholder-project link fails", async () => {
      const stageStakeholderProject = jest.fn(async () => {
        throw new Error("CAD Trust rejected the stakeholder-project payload");
      });
      const { handler, syncRecords } = buildHandler({ stageStakeholderProject });

      await expect(handler.handle(SNAPSHOT)).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(
        STAKEHOLDER_PROJECT_KEY,
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("does not rethrow if the inline commit call somehow throws", async () => {
      const commit = jest.fn(async () => {
        throw new Error("unexpected");
      });
      const { handler } = buildHandler({ commit });

      await expect(handler.handle(SNAPSHOT)).resolves.toBeUndefined();
    });

    it("does not rethrow on a malformed payload", async () => {
      const { handler, stageProject } = buildHandler();

      await expect(handler.handle({} as any)).resolves.toBeUndefined();
      expect(stageProject).not.toHaveBeenCalled();
    });
  });

  it("skips entirely when the integration is disabled", async () => {
    const { handler, stageProject, stageStakeholder, syncRecords, documentRepo } = buildHandler({ enabled: false });

    await handler.handle(SNAPSHOT);

    expect(documentRepo.findOne).not.toHaveBeenCalled();
    expect(stageStakeholder).not.toHaveBeenCalled();
    expect(stageProject).not.toHaveBeenCalled();
    expect(syncRecords.markFailed).not.toHaveBeenCalled();
  });
});
