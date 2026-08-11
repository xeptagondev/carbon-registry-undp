// Mirrors backend AuthorizationPurpose (libs/shared/src/enum/authorization.purpose.enum.ts).
// The purpose an ITMO block was authorized for — gates which
// retirement subtypes ("use" options) are available for it.
export enum AuthorizationPurpose {
  NDC = 'UseTowardsNDC',
  OIMP = 'OtherInternationalMitigationPurposes',
  OTHER = 'OtherPurposes',
}
