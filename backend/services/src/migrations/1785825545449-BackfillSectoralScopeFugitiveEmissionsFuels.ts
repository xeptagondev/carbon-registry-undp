import { MigrationInterface, QueryRunner } from "typeorm";

// InfSectoralScopeEnum.WASTE_FROM_FUELS was renamed to FUGITIVE_EMISSIONS_FUELS
// so its stored code sorts alphabetically alongside its translated label
// ("Fugitive Emissions from Fuels..."). Backfill projects created before the
// rename so they keep displaying/sorting correctly.
export class BackfillSectoralScopeFugitiveEmissionsFuels1785825545449
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "project_entity" SET "sectoralScope" = 'FUGITIVE_EMISSIONS_FUELS' WHERE "sectoralScope" = 'WASTE_FROM_FUELS'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "project_entity" SET "sectoralScope" = 'WASTE_FROM_FUELS' WHERE "sectoralScope" = 'FUGITIVE_EMISSIONS_FUELS'`
    );
  }
}
