import { ProjectManagementService } from "./project-management.service";
import { CompanyRole } from "../enum/company.role.enum";

describe("ProjectManagementService", () => {
  let service: ProjectManagementService;
  let orderByArgs: any[];

  beforeEach(() => {
    orderByArgs = [];
    const projectViewRepo: any = {
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
      parseMongoQueryToSQLWithTable: jest.fn(),
      generateSortCol: jest.fn((col: string) => `"${col}"`),
    };

    service = new ProjectManagementService(
      helperService,
      {} as any, // companyService
      {} as any, // counterService
      {} as any, // programmeLedgerService
      {} as any, // documentRepo
      {} as any, // noObjectionLetterGenerateService
      projectViewRepo,
      {} as any, // projectDetailsViewRepo
      {} as any, // activityViewEntityRepo
      {} as any, // emailHelperService
      {} as any, // documentManagementService
      {} as any // auditLogService
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("query sorting", () => {
    const user: any = { companyRole: CompanyRole.MINISTRY };

    it("casts projectProposalStage to text so it sorts alphabetically instead of by enum ordinal", async () => {
      await service.query(
        { size: 10, page: 1, sort: { key: "projectProposalStage", order: "ASC" } } as any,
        undefined,
        user
      );
      expect(orderByArgs[0]).toBe(
        `"document_entity"."projectProposalStage"::text`
      );
    });

    it("keeps sectoralScope on the plain-column path (already sorts correctly)", async () => {
      await service.query(
        { size: 10, page: 1, sort: { key: "sectoralScope", order: "ASC" } } as any,
        undefined,
        user
      );
      expect(orderByArgs[0]).toBe(`"document_entity"."sectoralScope"`);
    });

    it("keeps unrelated sort keys on the plain-column path (no regression)", async () => {
      await service.query(
        { size: 10, page: 1, sort: { key: "createdTime", order: "DESC" } } as any,
        undefined,
        user
      );
      expect(orderByArgs[0]).toBe(`"document_entity"."createdTime"`);
    });
  });
});
