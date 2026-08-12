import { AefSubmissionDefaults } from "@app/aef-v2";
import { ConfigService } from "@nestjs/config";

import { CountryService } from "../util/country.service";

// AefSubmissionDefaults.aefT1SubmissionParty must be ISO 3166-1 alpha-3.
// AEF_V2.party lets a deployment set that explicitly; when unset, this falls
// back to an alpha-3 lookup of `systemCountry` (alpha-2) rather than
// defaulting to something that would fail PARTY_CODE_PATTERN validation.
export async function aefSubmissionDefaultsFactory(
  configService: ConfigService,
  countryService: CountryService
): Promise<AefSubmissionDefaults> {
  const configuredParty = configService.get<string>("AEF_V2.party");
  const party =
    configuredParty || (await countryService.getAlpha3(configService.get<string>("systemCountry")));

  return {
    aefT1SubmissionParty: party,
    aefT1SubmissionNdcFirstYear: configService.get<number>("AEF_V2.ndcFirstYear"),
    aefT1SubmissionNdcLastYear: configService.get<number>("AEF_V2.ndcLastYear"),
  };
}
