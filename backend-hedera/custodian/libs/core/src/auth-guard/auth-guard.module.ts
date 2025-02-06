import { Module } from '@nestjs/common';
import { AuthGuardService } from './service/auth-guard.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { RolesGuardService } from './service/roles-guard.service';

@Module({
    providers: [AuthGuardService, JwtService, RolesGuardService],
    exports: [AuthGuardService],
    imports: [JwtModule],
})
export class AuthGuardModule {}
