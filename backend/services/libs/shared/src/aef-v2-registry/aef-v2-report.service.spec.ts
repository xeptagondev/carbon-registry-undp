import { AefV2ReportService } from "./aef-v2-report.service";

/**
 * `query` is the reporting tables' read path. It shapes Table 3's Action date
 * for display without touching what is stored or exported - see the service's
 * `forDisplay` docblock for why the two must differ.
 *
 * The service is constructed with stubs for everything except the store, which
 * is the only dependency `loadSubmissionBundle` actually reaches for here.
 */
describe("AefV2ReportService query display shaping", () => {
  const defaults = {
    aefT1SubmissionParty: "NGA",
    aefT1SubmissionNdcFirstYear: 2021,
    aefT1SubmissionNdcLastYear: 2030,
  };

  const buildService = (actions: Record<string, unknown>[]) => {
    const service = new AefV2ReportService(
      {} as any, // storeFactory
      defaults as any,
      {} as any, // holdings
      {} as any, // authorizedEntities
      {} as any, // fileHandler
      {} as any, // controlledValues
      {} as any // countryService
    );
    // Stubbed at the bundle boundary: the shaping under test happens after it,
    // and a real bundle would need the whole store/provider stack.
    (service as any).loadBundle = jest.fn().mockResolvedValue({
      submission: undefined,
      authorizations: [],
      actions,
      holdings: [],
      authorizedEntities: [],
      provisional: { holdings: false, authorizedEntities: false },
      snapshotAt: { holdings: undefined, authorizedEntities: undefined },
    });
    return service;
  };

  it("shows Table 3's Action date as dd/mm/yyyy, not the stored ISO datetime", async () => {
    const service = buildService([
      { aefT3ActionsDate: "2026-08-11T12:14:03.356Z", aefT3ActionsType: "First transfer" },
    ]);

    const result = await service.query("t3Actions", 2026);

    expect(result.data[0]).toMatchObject({
      aefT3ActionsDate: "11/08/2026",
      aefT3ActionsType: "First transfer",
    });
  });

  /**
   * The stored instant is UTC. A late-evening UTC action must not display as
   * the next day just because the server sits east of Greenwich.
   */
  it("takes the day from the UTC instant, not the server's timezone", async () => {
    const service = buildService([{ aefT3ActionsDate: "2026-08-11T23:45:00.000Z" }]);

    const result = await service.query("t3Actions", 2026);

    expect(result.data[0]).toMatchObject({ aefT3ActionsDate: "11/08/2026" });
  });

  it("passes a value through untouched when it is not a parseable date", async () => {
    const service = buildService([{ aefT3ActionsDate: "not a date" }]);

    const result = await service.query("t3Actions", 2026);

    expect(result.data[0]).toMatchObject({ aefT3ActionsDate: "not a date" });
  });

  it("leaves other tables alone", async () => {
    const service = buildService([]);

    const result = await service.query("t2Authorizations", 2026);

    expect(result.data).toEqual([]);
  });
});
