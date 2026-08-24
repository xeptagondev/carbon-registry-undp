import { CadTrustValidationError } from "@app/cadtrust";

import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
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

function buildHandler(
  overrides: {
    enabled?: boolean;
    alreadySynced?: Partial<
      Record<"stakeholder" | "project" | "methodology" | "stakeholderProject" | "location", boolean>
    >;
    syncedProgramId?: string | undefined;
    syncedMethodologyId?: string | undefined;
    company?: any;
    infContent?: any;
    stageStakeholder?: jest.Mock;
    stageProject?: jest.Mock;
    stageProjectMethodology?: jest.Mock;
    stageStakeholderProject?: jest.Mock;
    stageLocation?: jest.Mock;
    commit?: jest.Mock;
  } = {}
) {
  const alreadySynced = overrides.alreadySynced ?? {};

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

  const syncRecords = {
    isAlreadySynced: jest.fn(async (key: any) => {
      switch (key.localEntityType) {
        case CadTrustLocalEntityType.STAKEHOLDER:
          return alreadySynced.stakeholder ?? false;
        case CadTrustLocalEntityType.PROJECT:
          return alreadySynced.project ?? false;
        case CadTrustLocalEntityType.PROJECT_METHODOLOGY:
          return alreadySynced.methodology ?? false;
        case CadTrustLocalEntityType.STAKEHOLDER_PROJECT:
          return alreadySynced.stakeholderProject ?? false;
        case CadTrustLocalEntityType.LOCATION:
          return alreadySynced.location ?? false;
        default:
          return false;
      }
    }),
    getCadTrustId: jest.fn(async (key: any) => syncedIds[key.localEntityType]),
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

  const cadTrustV2Service = {
    getClient: () => ({
      stakeholder: { stageCreate: stageStakeholder },
      project: { stageCreate: stageProject },
      projectMethodology: { stageCreate: stageProjectMethodology },
      stakeholderProject: { stageCreate: stageStakeholderProject },
      location: { stageCreate: stageLocation },
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
