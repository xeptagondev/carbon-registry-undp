import { AsyncActionType } from "../enum/async.action.type.enum";

/**
 * `AsyncActionType` is a numeric enum persisted as a Postgres enum whose labels
 * are the ordinals as strings. Two things break if a member is inserted or
 * reordered rather than appended:
 *
 *  - every existing `async_action_entity` row silently changes meaning, and
 *  - the labels created by `src/migrations/1785500000000-CadTrustV2Sync.ts`
 *    ('17', '18', '19') stop matching the members they were created for.
 *
 * Neither failure is visible at compile time, hence this test. If it fails, do
 * not update the numbers here — move the new member to the end of the enum
 * instead, and add its label in a new migration.
 */
describe("AsyncActionType ordinals", () => {
  it("pins the last pre-CAD-Trust-v2 member, so insertions above it are caught", () => {
    // The baseline migration created labels '0'..'16'; this is '16'.
    expect(AsyncActionType.NationalInvestment).toBe(16);
  });

  it.each([
    ["CADTV2ProjectCreate", AsyncActionType.CADTV2ProjectCreate, 17],
    ["CADTV2ProjectUpdate", AsyncActionType.CADTV2ProjectUpdate, 18],
    ["CADTV2Commit", AsyncActionType.CADTV2Commit, 19],
  ])("%s is %i, matching the label added in the migration", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });
});
