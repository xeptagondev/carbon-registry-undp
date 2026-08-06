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

    it("sorts sectoralScope alphabetically by displayed label instead of by raw code", async () => {
      await service.query(
        { size: 10, page: 1, sort: { key: "sectoralScope", order: "ASC" } } as any,
        undefined,
        user
      );
      // Ranks follow SECTORAL_SCOPE_ALPHABETICAL_ORDER, so WASTE_FROM_FUELS
      // ("Fugitive Emissions from Fuels...") sorts between ENERGY_INDUSTRIES
      // and FUGITIVE_EMISSIONS_PRODUCTION rather than under "W".
      expect(orderByArgs[0]).toBe(
        `CASE "document_entity"."sectoralScope" ` +
          `WHEN 'AFFORESTATION_AND_REFORESTATION' THEN 0 ` +
          `WHEN 'AGRICULTURE' THEN 1 ` +
          `WHEN 'CHEMICAL_INDUSTRIES' THEN 2 ` +
          `WHEN 'CONSTRUCTION' THEN 3 ` +
          `WHEN 'ENERGY_DEMAND' THEN 4 ` +
          `WHEN 'ENERGY_DISTRIBUTION' THEN 5 ` +
          `WHEN 'ENERGY_INDUSTRIES' THEN 6 ` +
          `WHEN 'WASTE_FROM_FUELS' THEN 7 ` +
          `WHEN 'FUGITIVE_EMISSIONS_PRODUCTION' THEN 8 ` +
          `WHEN 'MANUFACTURING_INDUSTRIES' THEN 9 ` +
          `WHEN 'METAL_PRODUCTION' THEN 10 ` +
          `WHEN 'MINING_MINERAL_PRODUCTION' THEN 11 ` +
          `WHEN 'N/A' THEN 12 ` +
          `WHEN 'SOLVENT_USE' THEN 13 ` +
          `WHEN 'TRANSPORT' THEN 14 ` +
          `WHEN 'WASTE_HANDLING_AND_DISPOSAL' THEN 15 ` +
          `ELSE 16 END`
      );
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
