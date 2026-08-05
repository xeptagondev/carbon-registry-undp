import { CadTrustLocalEntityType } from "../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../enum/cadtrust.resource.type.enum";
import { CadTrustSyncStatus } from "../enum/cadtrust.sync.status.enum";
import { CadTrustSyncRecordService } from "./cadtrust-sync-record.service";

const KEY = {
  localEntityType: CadTrustLocalEntityType.PROJECT,
  localId: "0042",
  cadTrustEntityType: CadTrustResourceType.PROJECT,
};

function buildService(existing: any = null) {
  const repo = {
    findOne: jest.fn(async () => existing),
    create: jest.fn((row: any) => row),
    save: jest.fn(async (row: any) => row),
    update: jest.fn(async () => ({ affected: 2 })),
  };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  return { service: new CadTrustSyncRecordService(repo as any, logger as any), repo, logger };
}

describe("CadTrustSyncRecordService", () => {
  describe("ensure", () => {
    it("creates a pending row keyed on the unique triple", async () => {
      const { service, repo } = buildService();

      const record = await service.ensure(KEY);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining(KEY));
      expect(record.syncStatus).toBe(CadTrustSyncStatus.PENDING);
      expect(record.attemptCount).toBe(0);
    });

    it("returns the existing row rather than duplicating it", async () => {
      const existing = { id: 7, ...KEY, syncStatus: CadTrustSyncStatus.STAGED };
      const { service, repo } = buildService(existing);

      expect(await service.ensure(KEY)).toBe(existing);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("isAlreadySynced", () => {
    it.each([CadTrustSyncStatus.STAGED, CadTrustSyncStatus.COMMITTED])(
      "is true for %s, so a re-delivered action is skipped",
      async (syncStatus) => {
        const { service } = buildService({ ...KEY, syncStatus });

        expect(await service.isAlreadySynced(KEY)).toBe(true);
      }
    );

    it.each([CadTrustSyncStatus.PENDING, CadTrustSyncStatus.FAILED])(
      "is false for %s, so the sync is retried",
      async (syncStatus) => {
        const { service } = buildService({ ...KEY, syncStatus });

        expect(await service.isAlreadySynced(KEY)).toBe(false);
      }
    );

    it("is false when nothing has been recorded yet", async () => {
      const { service } = buildService();

      expect(await service.isAlreadySynced(KEY)).toBe(false);
    });
  });

  describe("markStaged", () => {
    it("stores both ids and clears any previous error", async () => {
      const { service, repo } = buildService({
        ...KEY,
        syncStatus: CadTrustSyncStatus.FAILED,
        lastError: "previous failure",
        attemptCount: 2,
      });

      await service.markStaged(KEY, { cadTrustId: "cadt-1", stagingUuid: "staging-1" });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cadTrustId: "cadt-1",
          stagingUuid: "staging-1",
          syncStatus: CadTrustSyncStatus.STAGED,
          lastError: null,
        })
      );
    });

    it("keeps a known cadTrustId when the new response omits it", async () => {
      const { service, repo } = buildService({ ...KEY, cadTrustId: "cadt-existing" });

      await service.markStaged(KEY, { stagingUuid: "staging-2" });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cadTrustId: "cadt-existing" })
      );
    });
  });

  describe("markFailed", () => {
    it("increments the attempt count and stores the message", async () => {
      const { service, repo } = buildService({ ...KEY, attemptCount: 2 });

      await service.markFailed(KEY, new Error("node unreachable"));

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          syncStatus: CadTrustSyncStatus.FAILED,
          attemptCount: 3,
          lastError: "Error: node unreachable",
        })
      );
    });

    it("keeps the CAD Trust response body, which is the useful part", async () => {
      const { service, repo } = buildService();
      const error = Object.assign(new Error("Bad request"), {
        name: "CadTrustValidationError",
        body: { message: "projectLink must be a valid URI", success: false },
      });

      await service.markFailed(KEY, error);

      expect(repo.save.mock.calls[0][0].lastError).toContain("projectLink must be a valid URI");
    });

    it("never throws, because it is called from a handler that must not throw", async () => {
      const { service, repo, logger } = buildService();
      repo.save.mockRejectedValueOnce(new Error("database is down"));

      await expect(service.markFailed(KEY, new Error("original"))).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it("handles a non-Error throwable", async () => {
      const { service, repo } = buildService();

      await service.markFailed(KEY, "just a string");

      expect(repo.save.mock.calls[0][0].lastError).toBe("just a string");
    });
  });

  describe("bulk transitions used by the commit handler", () => {
    it("moves every staged row to committed", async () => {
      const { service, repo } = buildService();

      expect(await service.markAllStagedAsCommitted()).toBe(2);
      expect(repo.update).toHaveBeenCalledWith(
        { syncStatus: CadTrustSyncStatus.STAGED },
        expect.objectContaining({ syncStatus: CadTrustSyncStatus.COMMITTED })
      );
    });

    it("moves every staged row to failed when a commit fails", async () => {
      const { service, repo } = buildService();

      expect(await service.markAllStagedAsFailed(new Error("commit failed"))).toBe(2);
      expect(repo.update).toHaveBeenCalledWith(
        { syncStatus: CadTrustSyncStatus.STAGED },
        expect.objectContaining({ syncStatus: CadTrustSyncStatus.FAILED })
      );
    });
  });

  it("returns the CAD Trust id for a synced record, which is what updates need", async () => {
    const { service } = buildService({ ...KEY, cadTrustId: "cadt-1" });

    expect(await service.getCadTrustId(KEY)).toBe("cadt-1");
    expect(await buildService().service.getCadTrustId(KEY)).toBeUndefined();
  });
});
