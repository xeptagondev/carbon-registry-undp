import { Module } from '@nestjs/common';
import { ProjectController } from './controller/project.controller';
import { JwtModule } from '@nestjs/jwt';
import { ProjectModule } from '@app/shared/project/project.module';

@Module({
    imports: [ProjectModule, JwtModule],
    controllers: [ProjectController],
})
export class ProjectAppModule {}
