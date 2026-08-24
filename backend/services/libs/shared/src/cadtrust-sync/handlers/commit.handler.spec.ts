import { CadTrustCommitHandler } from "./commit.handler";

function buildHandler(
  overrides: {
    enabled?: boolean;
    commit?: jest.Mock;
  } = {}
) {
  const commit = overrides.commit ?? jest.fn(async () => ({ message: "Committing", success: true }));
  // Present on the mocked client so a regression that reintroduces a hasPendingCommits() call
  // is caught by "never calls hasPendingCommits" below, rather than blowing up on undefined.
  const hasPendingCommits = jest.fn(async () => ({
    confirmed: false,
    message: "There are currently pending commits",
    success: true,
  }));

  const syncRecords = {
    markAllStagedAsCommitted: jest.fn(async () => 3),
    markAllStagedAsFailed: jest.fn(async () => 3),
  };
  const cadTrustV2Service = { getClient: () => ({ staging: { hasPendingCommits, commit } }) };
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

  return { handler, syncRecords, commit, hasPendingCommits, logger };
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

  it("never calls hasPendingCommits — it's a v2 uncommitted-rows count, not a propagation check, and always reads false right after staging", async () => {
    const { handler, commit, hasPendingCommits } = buildHandler();

    await handler.handle();

    expect(hasPendingCommits).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the integration is disabled", async () => {
    const { handler, commit, hasPendingCommits } = buildHandler({ enabled: false });

    await handler.handle();

    expect(hasPendingCommits).not.toHaveBeenCalled();
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
  });
});
