import { CadTrustValidationError } from "@app/cadtrust";

import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { DocumentTypeEnum } from "../../enum/document.type.enum";
import { CadTrustProjectCreateHandler } from "./project-create.handler";

const REF_ID = "0042";
const SYNC_KEY = {
  localEntityType: CadTrustLocalEntityType.PROJECT,
  localId: REF_ID,
  cadTrustEntityType: CadTrustResourceType.PROJECT,
};

function buildHandler(
  overrides: {
    enabled?: boolean;
    alreadySynced?: boolean;
    project?: any;
    stageCreate?: jest.Mock;
  } = {}
) {
  const stageCreate =
    overrides.stageCreate ??
    jest.fn(async () => ({
      staged: true as const,
      response: {
        message: "Project staged successfully",
        uuid: "staging-uuid-1",
        cadTrustProjectId: "cadt-project-1",
        success: true,
      },
    }));

  const projectRepo = {
    findOne: jest.fn(async () =>
      overrides.project === undefined ? { refId: REF_ID, title: "Kunene Solar" } : overrides.project
    ),
  };
  const documentRepo = { findOne: jest.fn(async () => ({ content: { projectDescription: "d" } })) };
  const syncRecords = {
    isAlreadySynced: jest.fn(async () => overrides.alreadySynced ?? false),
    markStaged: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
  };
  const projectMapper = { toCreateInput: jest.fn(async () => ({ projectId: REF_ID })) };
  const enqueue = { enqueueCommit: jest.fn(async () => undefined) };
  const cadTrustV2Service = { getClient: () => ({ project: { stageCreate } }) };
  const configService = { get: () => overrides.enabled ?? true };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  const handler = new CadTrustProjectCreateHandler(
    projectRepo as any,
    documentRepo as any,
    syncRecords as any,
    projectMapper as any,
    enqueue as any,
    cadTrustV2Service as any,
    configService as any,
    logger as any
  );

  return { handler, projectRepo, documentRepo, syncRecords, projectMapper, enqueue, stageCreate, logger };
}

describe("CadTrustProjectCreateHandler", () => {
  it("stages the project and records the CAD Trust id", async () => {
    const { handler, syncRecords, stageCreate } = buildHandler();

    await handler.handle({ refId: REF_ID });

    expect(stageCreate).toHaveBeenCalledWith({ projectId: REF_ID });
    expect(syncRecords.markStaged).toHaveBeenCalledWith(SYNC_KEY, {
      cadTrustId: "cadt-project-1",
      stagingUuid: "staging-uuid-1",
    });
  });

  it("falls back to the staging uuid when the response omits cadTrustProjectId", async () => {
    const stageCreate = jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", uuid: "staging-uuid-2", success: true },
    }));
    const { handler, syncRecords } = buildHandler({ stageCreate });

    await handler.handle({ refId: REF_ID });

    expect(syncRecords.markStaged).toHaveBeenCalledWith(SYNC_KEY, {
      cadTrustId: "staging-uuid-2",
      stagingUuid: "staging-uuid-2",
    });
  });

  it("enqueues a commit rather than committing inline", async () => {
    const { handler, enqueue } = buildHandler();

    await handler.handle({ refId: REF_ID });

    expect(enqueue.enqueueCommit).toHaveBeenCalledTimes(1);
  });

  it("reads the latest INF document for the fields project_entity does not store", async () => {
    const { handler, documentRepo, projectMapper } = buildHandler();

    await handler.handle({ refId: REF_ID });

    expect(documentRepo.findOne).toHaveBeenCalledWith({
      where: { programmeId: REF_ID, type: DocumentTypeEnum.INITIAL_NOTIFICATION_FORM },
      order: { version: "DESC" },
    });
    expect(projectMapper.toCreateInput).toHaveBeenCalledWith(
      { refId: REF_ID, title: "Kunene Solar" },
      { projectDescription: "d" }
    );
  });

  describe("idempotency — the queue is at-least-once", () => {
    it("does not stage twice when the action is re-delivered", async () => {
      const { handler, stageCreate, enqueue } = buildHandler({ alreadySynced: true });

      await handler.handle({ refId: REF_ID });

      expect(stageCreate).not.toHaveBeenCalled();
      expect(enqueue.enqueueCommit).not.toHaveBeenCalled();
    });
  });

  describe("the head-of-line guarantee", () => {
    // A throw here stalls the shared async-operations cursor and stops every
    // queued action in the system, email included. This is the whole reason the
    // failure state lives on the sync record.
    it("records the failure and does NOT rethrow when CAD Trust rejects the payload", async () => {
      const error = new CadTrustValidationError("projectLink must be a valid URI", {
        method: "POST",
        url: "http://localhost:31310/v2/project",
        status: 400,
        body: { message: "projectLink must be a valid URI", success: false },
      });
      const stageCreate = jest.fn(async () => {
        throw error;
      });
      const { handler, syncRecords } = buildHandler({ stageCreate });

      await expect(handler.handle({ refId: REF_ID })).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(SYNC_KEY, error);
    });

    it("does not rethrow when the node is unreachable", async () => {
      const stageCreate = jest.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      });
      const { handler, syncRecords, enqueue } = buildHandler({ stageCreate });

      await expect(handler.handle({ refId: REF_ID })).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalled();
      expect(enqueue.enqueueCommit).not.toHaveBeenCalled();
    });

    it("does not rethrow when the project has vanished", async () => {
      const { handler, stageCreate } = buildHandler({ project: null });

      await expect(handler.handle({ refId: REF_ID })).resolves.toBeUndefined();
      expect(stageCreate).not.toHaveBeenCalled();
    });

    it("does not rethrow on a malformed payload", async () => {
      const { handler, stageCreate } = buildHandler();

      await expect(handler.handle({} as any)).resolves.toBeUndefined();
      expect(stageCreate).not.toHaveBeenCalled();
    });
  });

  it("skips entirely when the integration is disabled", async () => {
    const { handler, stageCreate, syncRecords } = buildHandler({ enabled: false });

    await handler.handle({ refId: REF_ID });

    expect(stageCreate).not.toHaveBeenCalled();
    expect(syncRecords.markFailed).not.toHaveBeenCalled();
  });
});
