import { CadTrustReconcileHandler } from "./reconcile.handler";

const REF_ID_1 = "0042";
const REF_ID_2 = "0099";

const LEDGER_PROJECT = {
  refId: REF_ID_1,
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
    failedRefIds?: string[];
    hasUncommittedStagedRows?: boolean;
    ledgerProjects?: Record<string, any>;
    infContent?: any;
    ensureStakeholder?: jest.Mock;
    ensureProject?: jest.Mock;
    ensureProjectMethodology?: jest.Mock;
    ensureStakeholderProject?: jest.Mock;
    ensureLocation?: jest.Mock;
    commit?: jest.Mock;
    hasUncommittedStagedRowsImpl?: jest.Mock;
    getProjectByIdImpl?: jest.Mock;
  } = {}
) {
  const syncRecords = {
    findFailedProjectRefIds: jest.fn(async () => overrides.failedRefIds ?? []),
  };

  const resources = {
    getLatestInfContent: jest.fn(async () => overrides.infContent ?? { projectDescription: "d" }),
    ensureStakeholder:
      overrides.ensureStakeholder ?? jest.fn(async () => ({ cadTrustId: "cadt-stakeholder-1", commitOwed: false })),
    ensureProject:
      overrides.ensureProject ?? jest.fn(async () => ({ cadTrustId: "cadt-project-1", commitOwed: false })),
    ensureProjectMethodology: overrides.ensureProjectMethodology ?? jest.fn(async () => true),
    ensureStakeholderProject: overrides.ensureStakeholderProject ?? jest.fn(async () => false),
    ensureLocation: overrides.ensureLocation ?? jest.fn(async () => false),
  };

  const ledgerProjects: Record<string, any> = overrides.ledgerProjects ?? { [REF_ID_1]: LEDGER_PROJECT };
  const programmeLedgerService = {
    getProjectById:
      overrides.getProjectByIdImpl ??
      jest.fn(async (refId: string) => (refId in ledgerProjects ? ledgerProjects[refId] : null)),
  };

  const commitHandler = { handle: overrides.commit ?? jest.fn(async () => undefined) };

  const hasUncommittedStagedRows =
    overrides.hasUncommittedStagedRowsImpl ?? jest.fn(async () => overrides.hasUncommittedStagedRows ?? false);
  const cadTrustV2Service = {
    getClient: () => ({
      staging: { hasUncommittedStagedRows },
    }),
  };
  const configService = { get: () => overrides.enabled ?? true };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  const handler = new CadTrustReconcileHandler(
    syncRecords as any,
    resources as any,
    programmeLedgerService as any,
    commitHandler as any,
    cadTrustV2Service as any,
    configService as any,
    logger as any
  );

  return { handler, syncRecords, resources, programmeLedgerService, commitHandler, hasUncommittedStagedRows, logger };
}

describe("CadTrustReconcileHandler", () => {
  it("does nothing when there is no uncommitted staged batch and no FAILED records", async () => {
    const { handler, commitHandler, programmeLedgerService } = buildHandler();

    await handler.handle();

    expect(commitHandler.handle).not.toHaveBeenCalled();
    expect(programmeLedgerService.getProjectById).not.toHaveBeenCalled();
  });

  it("retries the commit when the node still has an uncommitted staged batch", async () => {
    const { handler, commitHandler } = buildHandler({ hasUncommittedStagedRows: true });

    await handler.handle();

    expect(commitHandler.handle).toHaveBeenCalledTimes(1);
  });

  it("re-drives every ensure step for a project with a FAILED sync record", async () => {
    const { handler, resources, programmeLedgerService } = buildHandler({ failedRefIds: [REF_ID_1] });

    await handler.handle();

    expect(programmeLedgerService.getProjectById).toHaveBeenCalledWith(REF_ID_1);
    expect(resources.ensureStakeholder).toHaveBeenCalledWith(LEDGER_PROJECT.companyId);
    expect(resources.ensureProject).toHaveBeenCalledWith(REF_ID_1, LEDGER_PROJECT, expect.anything());
    expect(resources.ensureProjectMethodology).toHaveBeenCalledWith(
      REF_ID_1,
      "cadt-project-1",
      LEDGER_PROJECT.createTime
    );
    expect(resources.ensureStakeholderProject).toHaveBeenCalledWith(REF_ID_1, "cadt-project-1", "cadt-stakeholder-1");
    expect(resources.ensureLocation).toHaveBeenCalledWith(REF_ID_1, "cadt-project-1", expect.anything());
  });

  it("processes every FAILED refId and commits once if any of them owed a commit", async () => {
    const { handler, commitHandler, programmeLedgerService } = buildHandler({
      failedRefIds: [REF_ID_1, REF_ID_2],
      ledgerProjects: { [REF_ID_1]: LEDGER_PROJECT, [REF_ID_2]: { ...LEDGER_PROJECT, refId: REF_ID_2 } },
      ensureProject: jest.fn(async () => ({ cadTrustId: "cadt-project-1", commitOwed: true })),
    });

    await handler.handle();

    expect(programmeLedgerService.getProjectById).toHaveBeenCalledWith(REF_ID_1);
    expect(programmeLedgerService.getProjectById).toHaveBeenCalledWith(REF_ID_2);
    expect(commitHandler.handle).toHaveBeenCalledTimes(1);
  });

  it("does not commit for a project that owed nothing, and does not touch downstream links when the project never resolved", async () => {
    const { handler, resources, commitHandler } = buildHandler({
      failedRefIds: [REF_ID_1],
      ensureProject: jest.fn(async () => undefined),
    });

    await handler.handle();

    expect(resources.ensureProjectMethodology).not.toHaveBeenCalled();
    expect(resources.ensureStakeholderProject).not.toHaveBeenCalled();
    expect(resources.ensureLocation).not.toHaveBeenCalled();
    expect(commitHandler.handle).not.toHaveBeenCalled();
  });

  it("leaves a FAILED sync record alone (does not commit for it) when the project is missing from the ledger", async () => {
    const { handler, resources, commitHandler, logger } = buildHandler({
      failedRefIds: [REF_ID_1],
      ledgerProjects: {},
    });

    await handler.handle();

    expect(resources.ensureStakeholder).not.toHaveBeenCalled();
    expect(commitHandler.handle).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(REF_ID_1));
  });

  describe("the head-of-line guarantee", () => {
    it("does not rethrow when checking the staged batch throws", async () => {
      const hasUncommittedStagedRowsImpl = jest.fn(async () => {
        throw new Error("node unreachable");
      });
      const { handler } = buildHandler({ hasUncommittedStagedRowsImpl });

      await expect(handler.handle()).resolves.toBeUndefined();
    });

    it("does not let one bad refId abort the whole reconcile pass", async () => {
      // REF_ID_1's ledger read throws outright (as opposed to the "missing from the ledger" case
      // above, which resolves null) to exercise the per-project try/catch specifically.
      const getProjectByIdImpl = jest.fn(async (refId: string) => {
        if (refId === REF_ID_1) {
          throw new Error("ledger unavailable");
        }
        return { ...LEDGER_PROJECT, refId: REF_ID_2 };
      });
      const { handler, resources } = buildHandler({
        failedRefIds: [REF_ID_1, REF_ID_2],
        getProjectByIdImpl,
      });

      await expect(handler.handle()).resolves.toBeUndefined();
      expect(resources.ensureStakeholder).toHaveBeenCalledWith(LEDGER_PROJECT.companyId);
    });

    it("does not rethrow on an unexpected error", async () => {
      const { handler } = buildHandler({
        failedRefIds: [REF_ID_1],
        ensureStakeholder: jest.fn(async () => {
          throw new Error("unexpected");
        }),
      });

      await expect(handler.handle()).resolves.toBeUndefined();
    });
  });

  it("skips entirely when the integration is disabled", async () => {
    const { handler, syncRecords, commitHandler } = buildHandler({ enabled: false, failedRefIds: [REF_ID_1] });

    await handler.handle();

    expect(syncRecords.findFailedProjectRefIds).not.toHaveBeenCalled();
    expect(commitHandler.handle).not.toHaveBeenCalled();
  });
});
