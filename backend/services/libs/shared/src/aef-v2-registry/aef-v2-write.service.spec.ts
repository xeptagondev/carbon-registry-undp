import { fixedClock, InMemoryAefStore } from "@app/aef-v2";
import { EntityManager } from "typeorm";

import { AuthorizedEntityStatus } from "../enum/authorized.entity.status.enum";
import { CreditTransactionStatusEnum } from "../enum/credit.transaction.status.enum";
import { CreditTransactionSubTypesEnum } from "../enum/credit.transaction.sub.types.enum";
import { TxType } from "../enum/txtype.enum";
import { AefV2WriteService } from "./aef-v2-write.service";

// AefV2WriteService is constructed by hand rather than through Nest's
// TestingModule — its dependencies are all narrow, single-method surfaces
// here (a couple of findOneBy repos, a country/serial lookup), and doing so
// lets the store be a real InMemoryAefStore (from @app/aef-v2's own test
// support) instead of mocking store.find/create/update calls one by one —
// the whole point of this spec is checking what actually ends up in Table 5.
describe("AefV2WriteService — real-time authorized-entity writes", () => {
  const defaults = {
    aefT1SubmissionParty: "VUT",
    aefT1SubmissionNdcFirstYear: 2021,
    aefT1SubmissionNdcLastYear: 2030,
  };
  const clock = fixedClock(new Date("2026-06-01T12:00:00.000Z"));
  const em = {} as EntityManager;

  const entity = {
    id: "entity-uuid-1",
    cooperativeApproachId: "CA0004",
    entityName: "Alpine Carbon Markets",
    entityIdentifier: "ENT-001",
    countryOfIncorporation: "CH",
    authorizationDate: Date.parse("2024-03-01T00:00:00.000Z"),
    createdTime: Date.parse("2024-01-01T00:00:00.000Z"),
    authorizationReference: "REF-1",
    status: AuthorizedEntityStatus.ACTIVE,
  };

  // A legacy entity created before authorizationDate became mandatory.
  const legacyEntity = {
    ...entity,
    id: "entity-uuid-2",
    entityIdentifier: "ENT-002",
    authorizationDate: undefined,
    createdTime: Date.parse("2023-06-15T00:00:00.000Z"),
  };

  const cooperativeApproach = {
    cooperativeApproachId: "CA0004",
    caReferenceNumber: "CA0004",
  };

  function buildService(store: InMemoryAefStore) {
    const projectRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        refId: "P0001",
        sector: "ENERGY",
        sectoralScope: "AGRICULTURE",
      }),
    };
    const creditTransactionsRepo = {
      findOneBy: jest.fn(),
    };
    const cooperativeApproachRepo = {
      findOneBy: jest.fn().mockResolvedValue(cooperativeApproach),
    };
    const authorizedEntityRepo = {
      findOneBy: jest.fn().mockResolvedValue(entity),
    };
    const countryService = {
      getAlpha3: jest.fn().mockResolvedValue("CHE"),
    };
    const serialNumberManagementService = {
      getBlockRange: jest.fn().mockReturnValue({ start: 1, end: 100 }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "serialNumber.seperator") return "-";
        if (key === "AEF_V2.strictWrite") return true;
        return undefined;
      }),
    };
    const storeFactory = { forManager: () => store };

    const service = new AefV2WriteService(
      storeFactory as any,
      defaults,
      configService as any,
      serialNumberManagementService as any,
      countryService as any,
      projectRepo as any,
      creditTransactionsRepo as any,
      cooperativeApproachRepo as any,
      authorizedEntityRepo as any
    );

    return { service, creditTransactionsRepo, authorizedEntityRepo };
  }

  function oimpCreditBlock(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      creditBlockId: "block-1",
      txType: TxType.RETIRE,
      txTime: Date.parse("2026-06-01T00:00:00.000Z"),
      itmoAuthorizationRecord: "auth-1",
      itmoSerial: "CA0004-VU-CH-1-1-100-2024",
      projectRefId: "P0001",
      vintage: "2024",
      creditAmount: 100,
      txData: { transactionId: "retire-1" },
      ...overrides,
    } as any;
  }

  function oimpRetireTx(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "retire-1",
      status: CreditTransactionStatusEnum.COMPLETED,
      subType: CreditTransactionSubTypesEnum.FIRST_TRANSFER_FOR_OIMP,
      data: {
        country: "CH",
        authorizedEntityId: entity.id,
        entityName: entity.entityName,
        cooperativeApproachId: "CA0004",
      },
      ...overrides,
    };
  }

  it("writes a Table 5 row in real time for an OIMP retirement, keyed consistently with Table 3", async () => {
    const store = new InMemoryAefStore(undefined, clock);
    const { service, creditTransactionsRepo } = buildService(store);
    creditTransactionsRepo.findOneBy.mockResolvedValue(oimpRetireTx());

    await service.recordCreditBlockEvent(oimpCreditBlock(), em);

    const entities = store.all("t5AuthorizedEntities");
    const actions = store.all("t3Actions");
    expect(entities).toHaveLength(1);
    expect(actions).toHaveLength(1);

    // Same expression on both sides: entity.entityIdentifier ?? entity.id.
    expect(entities[0].aefT5AuthorizedEntitiesId).toBe("ENT-001");
    expect(actions[0].aefT3ActionsUsingAuthorizedEntityId).toBe("ENT-001");

    // Written unfrozen — this is a real-time row, not a year-end snapshot.
    expect(entities[0].snapshotAt).toBeUndefined();

    expect(actions[0].aefT3ActionsPurposeOfUseOimp).toBe("First transferred to Alpine Carbon Markets");

    // Uses entity.authorizationDate, not createdTime, when both are present.
    expect(entities[0].aefT5AuthorizedEntitiesAuthorizationDate).toBe("01/03/2024");
    expect(entities[0].aefT5AuthorizedEntitiesConditions).toBe("Active");
    expect(entities[0].aefT5AuthorizedEntitiesChangeConditions).toBe(
      "Entity can be set to Active/Inactive by authorities."
    );
  });

  it("falls back to createdTime for a legacy entity with no authorizationDate", async () => {
    const store = new InMemoryAefStore(undefined, clock);
    const { service, creditTransactionsRepo, authorizedEntityRepo } = buildService(store);
    authorizedEntityRepo.findOneBy.mockResolvedValue(legacyEntity);
    creditTransactionsRepo.findOneBy.mockResolvedValue(
      oimpRetireTx({ data: { country: "CH", authorizedEntityId: legacyEntity.id, cooperativeApproachId: "CA0004" } })
    );

    await service.recordCreditBlockEvent(oimpCreditBlock(), em);

    const entities = store.all("t5AuthorizedEntities");
    expect(entities).toHaveLength(1);
    expect(entities[0].aefT5AuthorizedEntitiesAuthorizationDate).toBe("15/06/2023");
  });

  it("updates the same row rather than duplicating it on a second reference in the same year", async () => {
    const store = new InMemoryAefStore(undefined, clock);
    const { service, creditTransactionsRepo } = buildService(store);
    creditTransactionsRepo.findOneBy.mockResolvedValue(oimpRetireTx());

    await service.recordCreditBlockEvent(oimpCreditBlock({ creditBlockId: "block-1" }), em);
    const firstRowId = store.all("t5AuthorizedEntities")[0].id;

    creditTransactionsRepo.findOneBy.mockResolvedValue(
      oimpRetireTx({ id: "retire-2" })
    );
    await service.recordCreditBlockEvent(
      oimpCreditBlock({ creditBlockId: "block-2", txData: { transactionId: "retire-2" } }),
      em
    );

    const entities = store.all("t5AuthorizedEntities");
    expect(entities).toHaveLength(1);
    expect(entities[0].id).toBe(firstRowId);
  });

  it("links the Table 2 and Table 5 rows via the circular FK when a Table 2 row exists", async () => {
    const store = new InMemoryAefStore(undefined, clock);
    const { service, creditTransactionsRepo } = buildService(store);
    creditTransactionsRepo.findOneBy.mockResolvedValue(oimpRetireTx());

    // Pre-seed the Table 2 row this authorization would already have, per
    // the ITMO_AUTH branch — recordRetirementAction only ever looks this
    // up, never creates it.
    await store.create("t2Authorizations", {
      aefT2AuthorizationsId: "auth-1",
      aefT2AuthorizationsDate: "01/03/2024",
      aefT2AuthorizationsCooperativeApproachId: "CA0004",
      aefT2AuthorizationsVersion: 1,
      aefT2AuthorizationsMetric: "GHG",
      aefT2AuthorizationsSector: "Energy generation",
      aefT2AuthorizationsPurposesForAuthorization: "OIMP",
    });

    await service.recordCreditBlockEvent(oimpCreditBlock(), em);

    const t2 = store.all("t2Authorizations")[0];
    const t5 = store.all("t5AuthorizedEntities")[0];
    expect(t2.aefT5AuthorizedEntitiesId).toBe(t5.id);
    expect(t5.aefT2AuthorizationsId).toBe(t2.id);
  });

  it("does not write a Table 5 row for an NDC first-transfer retirement", async () => {
    const store = new InMemoryAefStore(undefined, clock);
    const { service, creditTransactionsRepo } = buildService(store);
    creditTransactionsRepo.findOneBy.mockResolvedValue(
      oimpRetireTx({
        subType: CreditTransactionSubTypesEnum.FIRST_TRANSFER_TOWARDS_NDC,
        data: { country: "CH", cooperativeApproachId: "CA0004" },
      })
    );

    await service.recordCreditBlockEvent(oimpCreditBlock(), em);

    expect(store.all("t5AuthorizedEntities")).toHaveLength(0);
    expect(store.all("t3Actions")[0].aefT3ActionsUsingAuthorizedEntityId).toBeUndefined();
    expect(store.all("t3Actions")[0].aefT3ActionsPurposeOfUseOimp).toBeUndefined();
  });
});
