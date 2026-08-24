import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { DocumentTypeEnum } from "../../enum/document.type.enum";
import { TxType } from "../../enum/txtype.enum";
import { CadTrustProjectSyncProps } from "../cadtrust-sync.enqueue.service";
import { CadTrustProjectUpdateHandler } from "./project-update.handler";

const REF_ID = "0042";

const PROJECT_KEY = {
  localEntityType: CadTrustLocalEntityType.PROJECT,
  localId: REF_ID,
  cadTrustEntityType: CadTrustResourceType.PROJECT,
};

const LEDGER_PROJECT = {
  refId: REF_ID,
  title: "Kunene Solar",
  sector: "ENERGY",
  sectoralScope: "ENERGY_INDUSTRIES",
  projectProposalStage: "APPROVED",
  createTime: 1_700_000_000_000,
  updateTime: 1_700_100_000_000,
  companyId: 7,
};

function buildHandler(
  overrides: {
    enabled?: boolean;
    cadTrustProjectId?: string | undefined;
    ledgerProject?: any;
    syncedProgramId?: string | undefined;
    infContent?: any;
    stageUpdate?: jest.Mock;
    commit?: jest.Mock;
  } = {}
) {
  const stageUpdate =
    overrides.stageUpdate ??
    jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", success: true },
    }));

  const documentRepo = {
    findOne: jest.fn(async () => ({ content: overrides.infContent ?? { projectDescription: "d" } })),
  };

  const syncRecords = {
    getCadTrustId: jest.fn(async () =>
      "cadTrustProjectId" in overrides ? overrides.cadTrustProjectId : "cadt-project-1"
    ),
    getSyncedCadTrustId: jest.fn(async (_localEntityType: any, cadTrustEntityType: any) =>
      cadTrustEntityType === CadTrustResourceType.PROGRAM ? overrides.syncedProgramId : undefined
    ),
    markStaged: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
  };

  const projectMapper = {
    toCreateInput: jest.fn(async () => ({
      projectId: REF_ID,
      projectStatus: "Listed",
    })),
  };

  const programmeLedgerService = {
    getProjectById: jest.fn(async () =>
      "ledgerProject" in overrides ? overrides.ledgerProject : LEDGER_PROJECT
    ),
  };

  const commitHandler = { handle: overrides.commit ?? jest.fn(async () => undefined) };

  const cadTrustV2Service = {
    getClient: () => ({
      project: { stageUpdate },
    }),
  };
  const configService = { get: () => overrides.enabled ?? true };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  const handler = new CadTrustProjectUpdateHandler(
    documentRepo as any,
    syncRecords as any,
    projectMapper as any,
    programmeLedgerService as any,
    commitHandler as any,
    cadTrustV2Service as any,
    configService as any,
    logger as any
  );

  return {
    handler,
    documentRepo,
    syncRecords,
    projectMapper,
    programmeLedgerService,
    commitHandler,
    stageUpdate,
    logger,
  };
}

function props(txType?: TxType): CadTrustProjectSyncProps {
  return { refId: REF_ID, txType };
}

describe("CadTrustProjectUpdateHandler", () => {
  it("re-maps the project from the ledger and stages a PUT for APPROVE_INF", async () => {
    const { handler, stageUpdate, syncRecords, programmeLedgerService, commitHandler } = buildHandler({
      syncedProgramId: "cadt-program-1",
    });

    await handler.handle(props(TxType.APPROVE_INF));

    expect(programmeLedgerService.getProjectById).toHaveBeenCalledWith(REF_ID);
    expect(stageUpdate).toHaveBeenCalledWith(
      "cadt-project-1",
      expect.objectContaining({ cadTrustProgramId: "cadt-program-1" })
    );
    expect(syncRecords.markStaged).toHaveBeenCalledWith(
      PROJECT_KEY,
      { cadTrustId: "cadt-project-1" },
      expect.objectContaining({ cadTrustProgramId: "cadt-program-1" })
    );
    expect(commitHandler.handle).toHaveBeenCalledTimes(1);
  });

  it("does not set cadTrustProgramId when no program is synced yet", async () => {
    const { handler, stageUpdate } = buildHandler({ syncedProgramId: undefined });

    await handler.handle(props(TxType.APPROVE_INF));

    const input = stageUpdate.mock.calls[0][1];
    expect(input).not.toHaveProperty("cadTrustProgramId");
  });

  it.each([TxType.APPROVE_INF, TxType.REJECT_INF, TxType.APPROVE_VALIDATION])(
    "stages a PUT for the synced transition %s",
    async (txType) => {
      const { handler, stageUpdate } = buildHandler();

      await handler.handle(props(txType));

      expect(stageUpdate).toHaveBeenCalledTimes(1);
    }
  );

  describe("ignored transitions", () => {
    it.each([
      TxType.CREATE_PDD,
      TxType.APPROVE_PDD_BY_IC,
      TxType.REJECT_PDD_BY_IC,
      TxType.APPROVE_PDD_BY_DNA,
      TxType.REJECT_PDD_BY_DNA,
      TxType.CREATE_VALIDATION_REPORT,
      TxType.REJECT_VALIDATION,
      TxType.APPROVE_MONITORING,
    ])("does not PUT or commit for %s", async (txType) => {
      const { handler, stageUpdate, commitHandler, syncRecords } = buildHandler();

      await handler.handle(props(txType));

      expect(stageUpdate).not.toHaveBeenCalled();
      expect(commitHandler.handle).not.toHaveBeenCalled();
      expect(syncRecords.markFailed).not.toHaveBeenCalled();
    });

    it("ignores a payload with no txType at all", async () => {
      const { handler, stageUpdate } = buildHandler();

      await handler.handle(props(undefined));

      expect(stageUpdate).not.toHaveBeenCalled();
    });
  });

  it("is marked FAILED with a clear message when the project was never created in CAD Trust", async () => {
    const { handler, syncRecords, stageUpdate } = buildHandler({ cadTrustProjectId: undefined });

    await handler.handle(props(TxType.APPROVE_INF));

    expect(stageUpdate).not.toHaveBeenCalled();
    expect(syncRecords.markFailed).toHaveBeenCalledWith(PROJECT_KEY, expect.any(Error));
    const call: any[] = syncRecords.markFailed.mock.calls[0];
    expect(call[1].message).toContain("never created");
  });

  it("is marked FAILED when the project is missing from the ledger", async () => {
    const { handler, syncRecords, stageUpdate } = buildHandler({ ledgerProject: null });

    await handler.handle(props(TxType.APPROVE_INF));

    expect(stageUpdate).not.toHaveBeenCalled();
    expect(syncRecords.markFailed).toHaveBeenCalledWith(PROJECT_KEY, expect.any(Error));
  });

  it("reads the latest INF document via the repository, not DocumentManagementService", async () => {
    const { handler, documentRepo } = buildHandler();

    await handler.handle(props(TxType.APPROVE_INF));

    expect(documentRepo.findOne).toHaveBeenCalledWith({
      where: { programmeId: REF_ID, type: DocumentTypeEnum.INITIAL_NOTIFICATION_FORM },
      order: { version: "DESC" },
    });
  });

  describe("the head-of-line guarantee", () => {
    it("does not rethrow when the ledger read throws", async () => {
      const h = buildHandler();
      h.programmeLedgerService.getProjectById.mockImplementation(async () => {
        throw new Error("ledger unavailable");
      });

      await expect(h.handler.handle(props(TxType.APPROVE_INF))).resolves.toBeUndefined();
    });

    it("does not rethrow when the mapper throws", async () => {
      const h = buildHandler();
      h.projectMapper.toCreateInput.mockImplementation(async () => {
        throw new Error("mapping failed");
      });

      await expect(h.handler.handle(props(TxType.APPROVE_INF))).resolves.toBeUndefined();
    });

    it("does not rethrow when stageUpdate throws", async () => {
      const stageUpdate = jest.fn(async () => {
        throw new Error("CAD Trust rejected the update");
      });
      const { handler, syncRecords } = buildHandler({ stageUpdate });

      await expect(handler.handle(props(TxType.APPROVE_INF))).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(
        PROJECT_KEY,
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("does not rethrow if the inline commit call somehow throws", async () => {
      const commit = jest.fn(async () => {
        throw new Error("unexpected");
      });
      const { handler } = buildHandler({ commit });

      await expect(handler.handle(props(TxType.APPROVE_INF))).resolves.toBeUndefined();
    });

    it("does not rethrow on a malformed payload", async () => {
      const { handler, stageUpdate } = buildHandler();

      await expect(handler.handle({} as any)).resolves.toBeUndefined();
      expect(stageUpdate).not.toHaveBeenCalled();
    });
  });

  it("skips entirely when the integration is disabled", async () => {
    const { handler, stageUpdate, syncRecords, documentRepo } = buildHandler({ enabled: false });

    await handler.handle(props(TxType.APPROVE_INF));

    expect(documentRepo.findOne).not.toHaveBeenCalled();
    expect(stageUpdate).not.toHaveBeenCalled();
    expect(syncRecords.markFailed).not.toHaveBeenCalled();
  });
});
