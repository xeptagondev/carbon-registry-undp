import { CadTrustCommitHandler } from "./commit.handler";

function buildHandler(
  overrides: {
    enabled?: boolean;
    commit?: jest.Mock;
    hasUncommittedStagedRows?: jest.Mock;
  } = {}
) {
  const commit = overrides.commit ?? jest.fn(async () => ({ message: "Committing", success: true }));
  // Defaults to "work is owed" so the happy-path tests below don't need to know about this.
  const hasUncommittedStagedRows =
    overrides.hasUncommittedStagedRows ?? jest.fn(async () => true);

  const syncRecords = {
    markAllStagedAsCommitted: jest.fn(async () => 3),
    markAllStagedAsFailed: jest.fn(async () => 3),
  };
  const cadTrustV2Service = {
    getClient: () => ({ staging: { hasUncommittedStagedRows, commit } }),
  };
  const configService = {
    get: (key: string) =>
      key === "cadTrustV2.enable"
        ? overrides.enabled ?? true
        : key === "cadTrustV2.commitAuthor"
        ? "Test Registry"
        : "SystemX",
  };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  const handler = new CadTrustCommitHandler(
    syncRecords as any,
    cadTrustV2Service as any,
    configService as any,
    logger as any
  );

  return { handler, syncRecords, commit, hasUncommittedStagedRows, logger };
}

describe("CadTrustCommitHandler", () => {
  it("commits with the configured author", async () => {
    const { handler, commit } = buildHandler();

    await handler.handle();

    expect(commit).toHaveBeenCalledWith({
      author: "Test Registry",
      comment: "National registry sync",
    });
  });

  it("flips every staged record to committed", async () => {
    const { handler, syncRecords } = buildHandler();

    await handler.handle();

    expect(syncRecords.markAllStagedAsCommitted).toHaveBeenCalledTimes(1);
  });

  it("skips the commit and reconciles staged records when nothing is staged on the node", async () => {
    const hasUncommittedStagedRows = jest.fn(async () => false);
    const { handler, commit, syncRecords } = buildHandler({ hasUncommittedStagedRows });

    await handler.handle();

    expect(commit).not.toHaveBeenCalled();
    expect(syncRecords.markAllStagedAsCommitted).toHaveBeenCalledTimes(1);
  });

  it("commits when there are uncommitted staged rows", async () => {
    const hasUncommittedStagedRows = jest.fn(async () => true);
    const { handler, commit } = buildHandler({ hasUncommittedStagedRows });

    await handler.handle();

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the integration is disabled", async () => {
    const { handler, commit, hasUncommittedStagedRows } = buildHandler({ enabled: false });

    await handler.handle();

    expect(hasUncommittedStagedRows).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  describe("the head-of-line guarantee", () => {
    it("marks staged records failed and does NOT rethrow when the commit fails", async () => {
      const commit = jest.fn(async () => {
        throw new Error("node unreachable");
      });
      const { handler, syncRecords } = buildHandler({ commit });

      await expect(handler.handle()).resolves.toBeUndefined();
      expect(syncRecords.markAllStagedAsFailed).toHaveBeenCalled();
      expect(syncRecords.markAllStagedAsCommitted).not.toHaveBeenCalled();
    });

    it("marks staged records failed and does NOT rethrow when hasUncommittedStagedRows fails", async () => {
      const hasUncommittedStagedRows = jest.fn(async () => {
        throw new Error("node unreachable");
      });
      const { handler, commit, syncRecords } = buildHandler({ hasUncommittedStagedRows });

      await expect(handler.handle()).resolves.toBeUndefined();
      expect(commit).not.toHaveBeenCalled();
      expect(syncRecords.markAllStagedAsFailed).toHaveBeenCalled();
      expect(syncRecords.markAllStagedAsCommitted).not.toHaveBeenCalled();
    });
  });
});
