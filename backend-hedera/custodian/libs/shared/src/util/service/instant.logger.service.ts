import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { DateTime } from 'luxon';

@Injectable()
export class InstantLogger implements LoggerService {
    private logger = winston.createLogger({
        level: 'info',
        format: winston.format.printf(({ level, message, context }) => {
            const timestamp = DateTime.now()
                .setZone('local')
                .toFormat('MM/dd/yyyy, hh:mm:ss a');
            return `${timestamp} ${level.toUpperCase()} [${context}] ${message}`;
        }),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({ filename: 'logs/app.log' }),
        ],
    });

    log(message: string, context: string = 'App') {
        this.logger.info({ message, context });
    }

    error(message: string, trace?: string, context: string = 'App') {
        this.logger.error({ message, trace, context });
    }

    warn(message: string, context: string = 'App') {
        this.logger.warn({ message, context });
    }
}
