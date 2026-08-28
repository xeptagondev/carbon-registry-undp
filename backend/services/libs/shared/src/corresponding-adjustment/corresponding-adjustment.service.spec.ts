import { CorrespondingAdjustmentService } from "./corresponding-adjustment.service";
import { CorrespondingAdjustment } from "../entities/corresponding.adjustment.entity";
import { CaMethod } from "../enum/ca.method.enum";
import { CaStatus } from "../enum/ca.status.enum";
import { NdcType } from "../enum/ndc.type.enum";
import { CompanyRole } from "../enum/company.role.enum";
import { Role } from "../casl/role.enum";
import { CreditTransactionTypesEnum } from "../enum/credit.transaction.types.enum";
import { CreditTransactionSubTypesEnum } from "../enum/credit.transaction.sub.types.enum";

// Averaging (Dec 2/CMA.3 para 7a(ii)) spreads the period's cumulative
// net first transfer evenly, so EVERY elapsed year carries the same
// uniform adjustment — that uniformity is what distinguishes it from
// Trajectory, which is deliberately year-specific.
//
// Two regressions guarded against here:
//
//  1. recomputeOpenAveragingYears used to iterate the rows that already
//     existed rather than the year span, so a period whose earlier years
//     had never been calculated left them permanently blank — invisible
//     in the table, skipped by finalizePeriod (which can only submit
//     rows that exist), and absent from the reconciliation total.
//
//  2. Each year was then computed "as at itself", producing a staircase
//     (100/150/200) whose period sum is Σ(cumulative(S..y)/(y-S+1)) —
//     450 here, against 600 actually first transferred. A uniform
//     average reconciles exactly (200 x 3 = 600), which is the property
//     getReconciliationSummary depends on.

const COUNTRY = "NG";
const START = 2021;
const END = 2025;

const dnaAdmin: any = {
  id: 1,
  companyRole: CompanyRole.DESIGNATED_NATIONAL_AUTHORITY,
  role: Role.Admin,
};

// First-transfer activity deliberately spread across three years and
// deliberately uneven, so a uniform average is visibly NOT just "each
// year's own balance" and visibly NOT a per-year running average:
//   period cumulative through 2023 = 600, elapsed 3 => 200 every year
//   (a per-year running average would give the 100/150/200 staircase)
const FIRST_TRANSFERS: { year: number; amount: number }[] = [
  { year: 2021, amount: 100 },
  { year: 2022, amount: 200 },
  { year: 2023, amount: 300 },
];

function buildService(seedRows: Partial<CorrespondingAdjustment>[] = []) {
  // In-memory stand-in for the corresponding_adjustment table, keyed by
  // year — which is exactly the UNIQUE constraint the real table carries.
  const store = new Map<number, any>();
  for (const row of seedRows) {
    store.set(row.year as number, { ...row });
  }

  const transactions = FIRST_TRANSFERS.map((t) => ({
    type: CreditTransactionTypesEnum.RETIRED,
    subType: CreditTransactionSubTypesEnum.FIRST_TRANSFER_TOWARDS_NDC,
    isFirstTransfer: true,
    amount: t.amount,
    createTime: Date.UTC(t.year, 5, 1),
  }));

  const makeCaQueryBuilder = () => {
    let params: any = {};
    const qb: any = {
      setLock: () => qb,
      where: (_sql: string, p: any) => {
        params = { ...params, ...p };
        return qb;
      },
      andWhere: (_sql: string, p: any) => {
        params = { ...params, ...p };
        return qb;
      },
      orderBy: () => qb,
      // upsertYear's single-year lookup.
      getOne: async () => store.get(params.year) ?? null,
      // The span queries used by recomputeOpenAveragingYears and
      // finalizePeriod. `end` is exclusive for the former, inclusive
      // (BETWEEN) for the latter — both are covered because
      // finalizePeriod passes its own end through the same param name.
      getMany: async () =>
        [...store.values()]
          .filter((r) => r.year >= params.start && r.year < params.end)
          .filter((r) => (params.status ? r.status === params.status : true))
          .sort((a, b) => a.year - b.year),
    };
    return qb;
  };

  const caTxRepo = {
    createQueryBuilder: () => makeCaQueryBuilder(),
    save: async (row: any) => {
      store.set(row.year, row);
      return row;
    },
  };

  const caRepo: any = {
    createQueryBuilder: () => makeCaQueryBuilder(),
    find: async () => [...store.values()].sort((a, b) => a.year - b.year),
    findOneBy: async ({ year, caId }: any) =>
      year != null
        ? store.get(year) ?? null
        : [...store.values()].find((r) => r.caId === caId) ?? null,
    save: async (row: any) => {
      store.set(row.year, row);
      return row;
    },
    manager: {
      transaction: async (cb: any) =>
        cb({ getRepository: () => caTxRepo }),
    },
  };

  const creditTxRepo: any = {
    createQueryBuilder: () => {
      let params: any = {};
      const qb: any = {
        where: (_sql: string, p: any) => {
          params = { ...params, ...p };
          return qb;
        },
        andWhere: (_sql: string, p: any) => {
          params = { ...params, ...p };
          return qb;
        },
        getMany: async () =>
          transactions.filter(
            (t) =>
              t.createTime >= params.windowStart &&
              t.createTime < params.windowEnd
          ),
      };
      return qb;
    },
  };

  // Straight-line interpolation 2021..2025, mirroring ndc_target_yearly.
  const yearlyTarget = (year: number) => ({
    targetYear: year,
    country: COUNTRY,
    singleYearTarget: 40000 - (year - START) * 1000,
  });

  const ndcTargetYearlyRepo: any = {
    findOne: async ({ where }: any) =>
      where.targetYear >= START && where.targetYear <= END
        ? yearlyTarget(where.targetYear)
        : null,
    find: async () =>
      Array.from({ length: END - START + 1 }, (_, i) => yearlyTarget(START + i)),
  };

  const ndcTargetRepo: any = {
    findOne: async () => ({
      ndcStartYear: START,
      ndcEndYear: END,
      ndcType: NdcType.SINGLE_YEAR,
      sourceReportNumber: "IR-001",
      country: COUNTRY,
    }),
  };

  const initialReportRepo: any = {
    findOneBy: async () => ({
      reportNumber: "IR-001",
      caMethod: CaMethod.AVERAGING,
    }),
  };

  let counter = 0;
  const service = new CorrespondingAdjustmentService(
    caRepo,
    creditTxRepo,
    initialReportRepo,
    ndcTargetRepo,
    ndcTargetYearlyRepo,
    { formatReqMessagesString: (key: string) => key } as any,
    { incrementCount: async () => String(++counter).padStart(3, "0") } as any,
    { get: () => COUNTRY } as any
  );

  return { service, store };
}

const applied = (store: Map<number, any>, year: number) =>
  store.get(year)?.appliedAdjustment;

describe("CorrespondingAdjustmentService — Averaging across elapsed years", () => {
  it("materialises a row for every elapsed year, not just the one saved", async () => {
    const { service, store } = buildService();

    await service.saveCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    expect([...store.keys()].sort()).toEqual([2021, 2022, 2023]);
  });

  it("gives every elapsed year the same uniform average", async () => {
    const { service, store } = buildService();

    await service.saveCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    // 600 cumulative ÷ 3 elapsed years, applied uniformly.
    expect(applied(store, 2021)).toBeCloseTo(200, 5);
    expect(applied(store, 2022)).toBeCloseTo(200, 5);
    expect(applied(store, 2023)).toBeCloseTo(200, 5);
  });

  it("sums to the cumulative first-transferred total, so it reconciles", async () => {
    const { service, store } = buildService();

    await service.saveCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    const totalApplied = [...store.values()].reduce(
      (sum, r) => sum + Number(r.appliedAdjustment),
      0
    );
    // 100 + 200 + 300 actually first transferred across the period.
    expect(totalApplied).toBeCloseTo(600, 5);
  });

  it("keeps each year's own emissionsBalance year-specific", async () => {
    const { service, store } = buildService();

    await service.saveCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    // The uniform figure is the ADJUSTMENT; the underlying per-year
    // activity is still recorded as what actually happened that year.
    expect(store.get(2021).emissionsBalance).toBeCloseTo(100, 5);
    expect(store.get(2022).emissionsBalance).toBeCloseTo(200, 5);
    expect(store.get(2023).emissionsBalance).toBeCloseTo(300, 5);
  });

  it("does not touch years after the one being saved", async () => {
    const { service, store } = buildService();

    await service.saveCA(
      { year: 2022, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    expect(store.has(2023)).toBe(false);
    expect(applied(store, 2022)).toBeCloseTo(150, 5);
  });

  it("leaves an already-submitted earlier year's filed figure alone", async () => {
    const { service, store } = buildService([
      {
        year: 2021,
        caId: "CA-ADJ-999",
        status: CaStatus.SUBMITTED,
        appliedAdjustment: 42,
        caMethod: CaMethod.AVERAGING,
      } as any,
    ]);

    await service.saveCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    // Untouched — a filed figure is never silently rewritten.
    expect(applied(store, 2021)).toBe(42);
    expect(store.get(2021).caId).toBe("CA-ADJ-999");
    // ...while the still-open years take the current uniform average.
    expect(applied(store, 2022)).toBeCloseTo(200, 5);
    expect(applied(store, 2023)).toBeCloseTo(200, 5);
  });

  it("recomputes an existing Draft earlier year rather than skipping it", async () => {
    const { service, store } = buildService([
      {
        year: 2022,
        caId: "CA-ADJ-050",
        status: CaStatus.DRAFT,
        appliedAdjustment: 0, // stale figure from an earlier calculation
        caMethod: CaMethod.AVERAGING,
      } as any,
    ]);

    await service.saveCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    expect(applied(store, 2022)).toBeCloseTo(200, 5);
    // Same row reused — recalculating must not burn a new CA-ADJ id.
    expect(store.get(2022).caId).toBe("CA-ADJ-050");
  });

  it("previews the same elapsed-year columns it would save", async () => {
    const { service } = buildService();

    const response: any = await service.previewCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );
    const byYear = new Map(
      response.data.years.map((y: any) => [y.year, y.appliedAdjustment])
    );

    expect(byYear.get(2021)).toBeCloseTo(200, 5);
    expect(byYear.get(2022)).toBeCloseTo(200, 5);
    expect(byYear.get(2023)).toBeCloseTo(200, 5);
    // Nothing beyond the reporting year is implied by a preview.
    expect(byYear.get(2024)).toBeNull();
  });

  it("preview persists nothing", async () => {
    const { service, store } = buildService();

    await service.previewCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    expect(store.size).toBe(0);
  });
});

describe("CorrespondingAdjustmentService — Trajectory stays per-year", () => {
  it("writes only the reporting year, leaving earlier years untouched", async () => {
    const { service, store } = buildService();
    // Same period, but filed under Trajectory.
    (service as any).initialReportRepo = {
      findOneBy: async () => ({
        reportNumber: "IR-001",
        caMethod: CaMethod.TRAJECTORY,
      }),
    };

    await service.saveCA(
      { year: 2023, reportingYearEmission: 30000 } as any,
      dnaAdmin
    );

    expect([...store.keys()]).toEqual([2023]);
    // Trajectory applies the year's own net balance, not an average.
    expect(applied(store, 2023)).toBeCloseTo(300, 5);
  });
});
