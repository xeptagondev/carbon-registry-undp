import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailServiceType } from "../enum/email.service.type";
import { FileHandlerModule } from "../file-handler/filehandler.module";
import { FileHandlerInterface } from "../file-handler/filehandler.interface";
import { EmailHandlerInterface } from "./email.interface";
import { GraphEmailService } from "./graph.email.service";
import { SmtpEmailService } from "./smtp.email.service";

@Module({
  imports: [FileHandlerModule],
  providers: [
    Logger,
    {
      provide: EmailHandlerInterface,
      inject: [Logger, ConfigService, FileHandlerInterface],
      useFactory: (
        logger: Logger,
        configService: ConfigService,
        fileHandler: FileHandlerInterface
      ) => {
        const emailService = process.env.EMAIL_SERVICE || EmailServiceType.SMTP;
        switch (emailService) {
          case EmailServiceType.SMTP:
            return new SmtpEmailService(logger, configService, fileHandler);
          case EmailServiceType.GRAPH:
            return new GraphEmailService(logger, configService, fileHandler);
          default:
            // An unrecognised value must not fall through to SMTP. A typo in a
            // deployment env would otherwise either send over credentials the
            // operator believed they had replaced, or fail at boot with a
            // missing SMTP_ENDPOINT that reads as an unrelated problem.
            throw new Error(
              `Unsupported EMAIL_SERVICE "${emailService}". Expected one of: ${Object.values(
                EmailServiceType
              ).join(", ")}.`
            );
        }
      },
    },
  ],
  exports: [EmailHandlerInterface],
})
export class EmailModule {}
