import { CreditTransactionsManagementService } from "./credit-transactions-management.service";
import { CompanyRole } from "../enum/company.role.enum";

describe("CreditTransactionsManagementService", () => {
  let service: CreditTransactionsManagementService;
  let orderByCalls: any[][];

  beforeEach(() => {
    orderByCalls = [];
    const queryBuilder: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockImplementation((...args: any[]) => {
        orderByCalls = [args];
        return queryBuilder;
      }),
      addOrderBy: jest.fn().mockImplementation((...args: any[]) => {
        orderByCalls.push(args);
        return queryBuilder;
      }),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const creditBlockTransfersViewEntityRepository: any = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const creditBlockExplorerViewEntityRepository: any = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const creditBlockIssuancesViewEntityRepository: any = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const creditBlockOrgTransactionsViewEntityRepository: any = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const helperService: any = {
      generateWhereSQL: jest.fn().mockReturnValue(undefined),
    };

    service = new CreditTransactionsManagementService(
      helperService,
      {} as any, // companyService
      {} as any, // programmeLedgerService
      {} as any, // creditBlocksEntityRepository
      {} as any, // counterService
      {} as any, // creditTransactionsEntityRepository
      {} as any, // documentManagementService
      {} as any, // creditBlockBalancesViewEntityRepository
      creditBlockTransfersViewEntityRepository,
      {} as any, // creditBlockRetirementsViewEntityRepository
      {} as any, // creditBlockItmoAuthorizationsViewEntityRepository
      creditBlockExplorerViewEntityRepository,
      creditBlockIssuancesViewEntityRepository,
      {} as any, // creditBlockOrgBalancesViewEntityRepository
      {} as any, // creditBlockProjectBalancesViewEntityRepository
      {} as any, // creditBlockProjectHolderBalancesViewEntityRepository
      creditBlockOrgTransactionsViewEntityRepository,
      {} as any, // cooperativeApproachRepo
      {} as any, // caAuthorizedEntityRepo
      {} as any, // serialNumberManagementService
      {} as any // aefV2WriteService
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("queryTransfers sorting", () => {
    const user: any = { companyRole: CompanyRole.DESIGNATED_NATIONAL_AUTHORITY };

    it("sorts id numerically instead of lexicographically", async () => {
      await service.queryTransfers(
        { size: 10, page: 1, sort: { key: "id", order: "ASC" } } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(1);
      expect(orderByCalls[0][0]).toBe(
        `CASE WHEN "creditTx"."id" ~ '^[0-9]+$' THEN "creditTx"."id"::bigint END`
      );
      expect(orderByCalls[0][1]).toBe("ASC");
    });

    it("keeps unrelated sort keys on the plain-column path (no regression)", async () => {
      await service.queryTransfers(
        { size: 10, page: 1, sort: { key: "createdDate", order: "DESC" } } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(1);
      expect(orderByCalls[0][0]).toBe(`"createdDate"`);
      expect(orderByCalls[0][1]).toBe("DESC");
    });
  });

  describe("queryExplorer sorting", () => {
    const user: any = { companyRole: CompanyRole.DESIGNATED_NATIONAL_AUTHORITY };

    it("sorts serialNumber by its numeric segments instead of lexicographically", async () => {
      await service.queryExplorer(
        { size: 10, page: 1, sort: { key: "serialNumber", order: "ASC" } } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(2);
      const [projectId, blockStart] = orderByCalls.map((call) => call[0]);
      expect(projectId).toContain("split_part(\"creditBlock\".\"serialNumber\", '-', 4)::int");
      expect(blockStart).toContain("split_part(\"creditBlock\".\"serialNumber\", '-', 5)::int");
      orderByCalls.forEach((call) => expect(call[1]).toBe("ASC"));
    });

    it("keeps unrelated sort keys on the plain-column path (no regression)", async () => {
      await service.queryExplorer(
        { size: 10, page: 1, sort: { key: "projectName", order: "DESC" } } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(1);
      expect(orderByCalls[0][0]).toBe(`"projectName"`);
      expect(orderByCalls[0][1]).toBe("DESC");
    });
  });

  describe("queryIssuances sorting", () => {
    const user: any = { companyRole: CompanyRole.DESIGNATED_NATIONAL_AUTHORITY };

    it("sorts serialNumber by its numeric segments instead of lexicographically", async () => {
      await service.queryIssuances(
        { size: 10, page: 1, sort: { key: "serialNumber", order: "ASC" } } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(2);
      const [projectId, blockStart] = orderByCalls.map((call) => call[0]);
      expect(projectId).toContain("split_part(\"creditTx\".\"serialNumber\", '-', 4)::int");
      expect(blockStart).toContain("split_part(\"creditTx\".\"serialNumber\", '-', 5)::int");
      orderByCalls.forEach((call) => expect(call[1]).toBe("ASC"));
    });

    it("keeps unrelated sort keys on the plain-column path (no regression)", async () => {
      await service.queryIssuances(
        { size: 10, page: 1, sort: { key: "issuanceDate", order: "DESC" } } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(1);
      expect(orderByCalls[0][0]).toBe(`"issuanceDate"`);
      expect(orderByCalls[0][1]).toBe("DESC");
    });
  });

  describe("queryOrgCreditBlocks sorting", () => {
    const user: any = { companyRole: CompanyRole.DESIGNATED_NATIONAL_AUTHORITY };

    it("sorts serialNumber by its numeric segments instead of lexicographically", async () => {
      await service.queryOrgCreditBlocks(
        {
          size: 10,
          page: 1,
          organizationId: 1,
          sort: { key: "serialNumber", order: "ASC" },
        } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(2);
      const [projectId, blockStart] = orderByCalls.map((call) => call[0]);
      expect(projectId).toContain("split_part(\"orgTx\".\"serialNumber\", '-', 4)::int");
      expect(blockStart).toContain("split_part(\"orgTx\".\"serialNumber\", '-', 5)::int");
      orderByCalls.forEach((call) => expect(call[1]).toBe("ASC"));
    });

    it("keeps unrelated sort keys on the plain-column path (no regression)", async () => {
      await service.queryOrgCreditBlocks(
        {
          size: 10,
          page: 1,
          organizationId: 1,
          sort: { key: "updatedDate", order: "DESC" },
        } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(1);
      expect(orderByCalls[0][0]).toBe(`"updatedDate"`);
      expect(orderByCalls[0][1]).toBe("DESC");
    });

    it("falls back to updatedDate DESC when no sort key is given", async () => {
      await service.queryOrgCreditBlocks(
        { size: 10, page: 1, organizationId: 1 } as any,
        undefined,
        user
      );

      expect(orderByCalls).toHaveLength(1);
      expect(orderByCalls[0][0]).toBe(`"updatedDate"`);
      expect(orderByCalls[0][1]).toBe("DESC");
    });
  });
});
