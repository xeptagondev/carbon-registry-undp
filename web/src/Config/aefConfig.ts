/**
 * Article 6.2 AEF reporting configuration.
 *
 * Per-country deployment setting, so it belongs here alongside the other
 * customisation touchpoints rather than being hardcoded in a component.
 *
 * The Party value replaces the `"Sri Lanka"` literal the V1 report cards
 * carried. That was wrong twice over: it hardcoded one deployment into a
 * toolkit meant to be deployed per country, and it used a display name where
 * the AEF requires an **ISO 3166-1 alpha-3 code** (Common Nomenclature Table 1 —
 * `LKA`, `VUT`, `CHE`, plus exceptionally reserved codes such as `EUE`).
 */
export const AEF_CONFIG = {
  /** ISO 3166-1 alpha-3 code of the reporting Party. */
  party: import.meta.env.VITE_AEF_PARTY ?? "VUT",

  /**
   * Party ITMO registry identifier — alpha-3 code plus a two-digit registry
   * number (Common Nomenclature Table 28).
   */
  partyItmoRegistryId: import.meta.env.VITE_AEF_PARTY_ITMO_REGISTRY_ID ?? "VUT01",

  /** NDC implementation period containing the reported year. */
  ndcFirstYear: Number(import.meta.env.VITE_AEF_NDC_FIRST_YEAR ?? 2021),
  ndcLastYear: Number(import.meta.env.VITE_AEF_NDC_LAST_YEAR ?? 2030),
};
