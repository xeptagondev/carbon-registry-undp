import { CompanyService } from "./company.service";
import { CompanyRole } from "../enum/company.role.enum";

describe("CompanyService", () => {
  let service: CompanyService;
  let orderByArgs: any[];

  beforeEach(() => {
    orderByArgs = [];
    const companyRepo: any = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockImplementation((...args: any[]) => {
          orderByArgs = args;
          return {
            offset: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
          };
        }),
      }),
    };
    const helperService: any = {
      generateWhereSQL: jest.fn(),
      parseMongoQueryToSQL: jest.fn(),
    };

    service = new CompanyService(
      companyRepo,
      {} as any, // userRepo
      {} as any, // companyViewRepo
      {} as any, // logger
      {} as any, // configService
      helperService,
      {} as any, // programmeLedgerService
      {} as any, // emailHelperService
      {} as any, // programmeTransferRepo
      {} as any, // fileHandler
      {} as any, // counterService
      {} as any, // userService
      {} as any, // asyncOperationsInterface
      {} as any, // locationService
      {} as any, // investmentRepo
      {} as any, // dataExportService
      {} as any, // httpUtilService
      {} as any, // cacheManager
      {} as any, // creditBlocksEntityRepository
      {} as any // creditBlockOrgAggregationViewEntityRepository
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("query sorting", () => {
    const companyRole = CompanyRole.DESIGNATED_NATIONAL_AUTHORITY;

    it("sorts state alphabetically by displayed label instead of by enum ordinal", async () => {
      await service.query(
        { size: 10, page: 1, sort: { key: "state", order: "ASC" } } as any,
        undefined,
        companyRole
      );

      expect(orderByArgs[0]).toBe(
        `CASE "state" WHEN '1' THEN 0 WHEN '0' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END`
      );
    });

    it("keeps unrelated sort keys on the plain-column path (no regression)", async () => {
      await service.query(
        { size: 10, page: 1, sort: { key: "name", order: "DESC" } } as any,
        undefined,
        companyRole
      );

      expect(orderByArgs[0]).toBe(`"name"`);
    });
  });
});
