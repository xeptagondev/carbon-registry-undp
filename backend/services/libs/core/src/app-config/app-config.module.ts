import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import * as fs from "fs";
import { AcceptLanguageResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import * as path from "path";
import configuration from "./configuration";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmConfigService } from "./typeorm.config.service";

// `nest build` is webpack-bundled, so at runtime __dirname is `dist/` and the
// i18n assets nest-cli.json copies sit at `dist/shared/src/i18n` — the first
// candidate below, and the only one that exists in a deployed image. Running
// this module unbundled (ts-node scripts, integration tests) leaves __dirname
// as the real source directory, where that suffix resolves to nothing and
// nestjs-i18n fails to boot on a missing directory; the second candidate is
// the source tree those runs need. Falls back to the bundled path so a
// genuinely absent directory still reports the deployed location.
const I18N_PATH =
  [
    path.join(__dirname, "shared/src/i18n/"),
    path.join(__dirname, "../../../shared/src/i18n/"),
  ].find((candidate) => fs.existsSync(candidate)) ?? path.join(__dirname, "shared/src/i18n/");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [`.env.${process.env.NODE_ENV}`, `.env`],
    }),
    I18nModule.forRoot({
      fallbackLanguage: "en",
      loaderOptions: {
        path: I18N_PATH,
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ["lang"] },
        AcceptLanguageResolver,
      ],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      imports: undefined,
    }),
  ],
})
export class AppConfigModule {}
