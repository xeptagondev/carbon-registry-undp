import { Module } from '@nestjs/common';
import { AuthGuardService } from './service/auth-guard.service';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Module({
    providers: [AuthGuardService, JwtService],
    exports: [AuthGuardService],
    imports: [JwtModule],
})
export class AuthGuardModule {}
