import { Injectable } from '@nestjs/common';
import { TokenEntity } from '../entity/token.entity/token.entity';
import { Repository } from 'typeorm';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { InjectRepository } from '@nestjs/typeorm';
// import { AuditDTO } from '@app/shared/audit/dto/audit.dto';
// import { LogLevel } from '@app/shared/audit/enum/log-level.enum';

@Injectable()
export class TokenService {
    constructor(
        private auditService: AuditService,
        @InjectRepository(TokenEntity)
        private tokenRepository: Repository<TokenEntity>,
    ) {}

    public async generateNewToken(newTokenInfo: any): Promise<string> {
        const oldToken = await this.tokenRepository.findOne({
            where: {
                email: newTokenInfo.email,
            },
        });

        return oldToken.token;
    }
}
