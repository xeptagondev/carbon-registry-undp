import { Module } from '@nestjs/common';
import { TokenService } from './service/token.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenEntity } from './entity/token.entity/token.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TokenEntity])],
    providers: [TokenService],
    exports: [TokenService],
})
export class TokenModule {}
