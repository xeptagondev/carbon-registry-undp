import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CustodianDBPopulate1737524138690 } from '../migrations/1737524138690-CustodianDBPopulate';
import { ConfigService } from '@nestjs/config';

const ormConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: configService.get<string>('database.host'),
    port: parseInt(configService.get<string>('database.port')),
    username: configService.get<string>('database.username'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.database'),
    synchronize: true,
    autoLoadEntities: true,
    dropSchema: false,
    logging: true,
    ssl:
        process.env.APP_ENV && process.env.APP_ENV != 'dev'
            ? {
                  rejectUnauthorized: false,
              }
            : false,
    migrations: [CustodianDBPopulate1737524138690],
    migrationsRun: false,
});

export default ormConfig;
