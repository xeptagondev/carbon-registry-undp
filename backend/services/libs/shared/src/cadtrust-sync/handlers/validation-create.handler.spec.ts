import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { DocumentTypeEnum } from "../../enum/document.type.enum";
import { CadTrustValidationSyncProps } from "../cadtrust-sync.enqueue.service";
import { CadTrustValidationCreateHandler } from "./validation-create.handler";

const REF_ID = "0042";
const LOCAL_ID = "0042-PDD-v1";

const PROJECT_KEY = {
  localEntityType: CadTrustLocalEntityType.PROJECT,
  localId: REF_ID,
  cadTrustEntityType: CadTrustResourceType.PROJECT,
};
const VALIDATION_KEY = {
  localEntityType: CadTrustLocalEntityType.VALIDATION,
  localId: LOCAL_ID,
  cadTrustEntityType: CadTrustResourceType.VALIDATION,
};

function props(overrides: Partial<CadTrustValidationSyncProps> = {}): CadTrustValidationSyncProps {
  return {
    refId: REF_ID,
    documentType: DocumentTypeEnum.PROJECT_DESIGN_DOCUMENT,
    documentVersion: 1,
    validationBodyName: "Kunene Certifiers",
    creditPeriodStartDate: "2026-01-01",
    creditPeriodEndDate: "2033-01-01",
    validationDate: "2026-03-15",
    ...overrides,
  };
}

function buildHandler(
  overrides: {
    enabled?: boolean;
    alreadySynced?: boolean;
    cadTrustProjectId?: string | undefined;
    stageCreate?: jest.Mock;
    commit?: jest.Mock;
  } = {}
) {
  const stageCreate =
    overrides.stageCreate ??
    jest.fn(async () => ({
      staged: true as const,
      response: { message: "ok", uuid: "staging-validation-1", cadTrustValidationId: "cadt-validation-1", success: true },
    }));

  const syncRecords = {
    isAlreadySynced: jest.fn(async () => overrides.alreadySynced ?? false),
    getCadTrustId: jest.fn(async () =>
      "cadTrustProjectId" in overrides ? overrides.cadTrustProjectId : "cadt-project-1"
    ),
    markStaged: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
  };

  const validationMapper = {
    toCreateInput: jest.fn(async (_props: any, validationId: string, cadTrustProjectId: string) => ({
      validationId,
      cadTrustProjectId,
      validationType: "Validation of Project Design Document",
      validationBody: "Kunene Certifiers",
    })),
  };

  const commitHandler = { handle: overrides.commit ?? jest.fn(async () => undefined) };

  const cadTrustV2Service = {
    getClient: () => ({
      validation: { stageCreate },
    }),
  };
  const configService = { get: () => overrides.enabled ?? true };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  const handler = new CadTrustValidationCreateHandler(
    syncRecords as any,
    validationMapper as any,
    commitHandler as any,
    cadTrustV2Service as any,
    configService as any,
    logger as any
  );

  return { handler, syncRecords, validationMapper, commitHandler, stageCreate, logger };
}

describe("CadTrustValidationCreateHandler", () => {
  it("stages a validation record for a PDD approval and commits inline", async () => {
    const { handler, syncRecords, stageCreate, commitHandler, validationMapper } = buildHandler();

    await handler.handle(props());

    expect(syncRecords.getCadTrustId).toHaveBeenCalledWith(PROJECT_KEY);
    expect(validationMapper.toCreateInput).toHaveBeenCalledWith(expect.anything(), LOCAL_ID, "cadt-project-1");
    expect(stageCreate).toHaveBeenCalledTimes(1);
    expect(syncRecords.markStaged).toHaveBeenCalledWith(VALIDATION_KEY, {
      cadTrustId: "cadt-validation-1",
      stagingUuid: "staging-validation-1",
    });
    expect(commitHandler.handle).toHaveBeenCalledTimes(1);
  });

  it("keys a validation-report approval differently from a PDD approval on the same project", async () => {
    const { handler, syncRecords } = buildHandler();

    await handler.handle(props({ documentType: DocumentTypeEnum.VALIDATION }));

    expect(syncRecords.markStaged).toHaveBeenCalledWith(
      expect.objectContaining({ localId: "0042-VALIDATION-v1" }),
      expect.anything()
    );
  });

  it("keys different document versions as distinct records — a resubmitted-and-reapproved PDD stages again", async () => {
    const { handler, syncRecords } = buildHandler();

    await handler.handle(props({ documentVersion: 2 }));

    expect(syncRecords.markStaged).toHaveBeenCalledWith(
      expect.objectContaining({ localId: "0042-PDD-v2" }),
      expect.anything()
    );
  });

  it("skips staging and committing when this exact document version is already synced", async () => {
    const { handler, stageCreate, commitHandler } = buildHandler({ alreadySynced: true });

    await handler.handle(props());

    expect(stageCreate).not.toHaveBeenCalled();
    expect(commitHandler.handle).not.toHaveBeenCalled();
  });

  it("is marked FAILED with a clear message when the project is not yet synced to CAD Trust", async () => {
    const { handler, syncRecords, stageCreate } = buildHandler({ cadTrustProjectId: undefined });

    await handler.handle(props());

    expect(stageCreate).not.toHaveBeenCalled();
    expect(syncRecords.markFailed).toHaveBeenCalledWith(VALIDATION_KEY, expect.any(Error));
    const call: any[] = syncRecords.markFailed.mock.calls[0];
    expect(call[1].message).toContain("not yet synced");
  });

  describe("the head-of-line guarantee", () => {
    it("does not rethrow when stageCreate fails", async () => {
      const stageCreate = jest.fn(async () => {
        throw new Error("CAD Trust rejected the validation payload");
      });
      const { handler, syncRecords } = buildHandler({ stageCreate });

      await expect(handler.handle(props())).resolves.toBeUndefined();
      expect(syncRecords.markFailed).toHaveBeenCalledWith(VALIDATION_KEY, expect.any(Error));
    });

    it("does not rethrow if the inline commit call somehow throws", async () => {
      const commit = jest.fn(async () => {
        throw new Error("unexpected");
      });
      const { handler } = buildHandler({ commit });

      await expect(handler.handle(props())).resolves.toBeUndefined();
    });

    it("does not rethrow on a malformed payload", async () => {
      const { handler, stageCreate } = buildHandler();

      await expect(handler.handle({} as any)).resolves.toBeUndefined();
      expect(stageCreate).not.toHaveBeenCalled();
    });
  });

  it("skips entirely when the integration is disabled", async () => {
    const { handler, stageCreate, syncRecords } = buildHandler({ enabled: false });

    await handler.handle(props());

    expect(stageCreate).not.toHaveBeenCalled();
    expect(syncRecords.markFailed).not.toHaveBeenCalled();
  });
});
