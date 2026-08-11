import { MigrationInterface, QueryRunner } from "typeorm";

// Step 3 of the Article 6.2 refactor (UNCR-468):
//
// ca_authorized_entity
//   - "countryOfIncorporation" (text, nullable): the country the
//     authorized entity is incorporated in. Required at the DTO layer
//     for newly-created rows (validated against the parent cooperative
//     approach's participatingParties in the service); nullable here so
//     rows created before this change remain valid.
//
// Written by hand rather than via `migration:generate` - the local dev
// DB runs with synchronize=true (NODE_ENV=dev) and has already
// auto-synced this schema. Same convention as
// 1786700000000-CaLifecycleAndAuthorizedEntities.ts.
export class CaAuthorizedEntityCountryOfIncorporation1787300000000
  implements MigrationInterface
{
  name = "CaAuthorizedEntityCountryOfIncorporation1787300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ca_authorized_entity" ADD "countryOfIncorporation" text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ca_authorized_entity" DROP COLUMN "countryOfIncorporation"`
    );
  }
}
