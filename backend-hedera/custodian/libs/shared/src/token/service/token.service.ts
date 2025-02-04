import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TokenEntity } from '../entity/token.entity/token.entity';
import { Repository } from 'typeorm';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { InjectRepository } from '@nestjs/typeorm';
import { GenerateTokenDto } from '../dto/generate-token.dto';
import { formatRemainingTime, generatePassword } from '@app/shared/util/util';
import { ConfigService } from '@nestjs/config';
import { AuditDTO } from '@app/shared/audit/dto/audit.dto';
import { LogLevel } from '@app/shared/audit/enum/log-level.enum';
import { ValidateTokenDto } from '../dto/validate-token.dto';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
    constructor(
        private auditService: AuditService,
        private configService: ConfigService,
        @InjectRepository(TokenEntity)
        private tokenRepository: Repository<TokenEntity>,
    ) {}

    public async generateNewToken(
        generateTokenDto: GenerateTokenDto,
    ): Promise<string> {
        const currentTime = Date.now();
        const oldToken = await this.tokenRepository.findOne({
            where: {
                email: generateTokenDto.email,
            },
        });
        if (oldToken) {
            if (currentTime < oldToken.expireTime) {
                const remainingTime = oldToken.expireTime - currentTime;
                throw new HttpException(
                    // eslint-disable-next-line max-len
                    `A valid token has already been issued for this user. Please try again in ${formatRemainingTime(remainingTime)}`,
                    HttpStatus.EXPECTATION_FAILED,
                );
            } else {
                await this.tokenRepository.delete({ email: oldToken.email });

                const message: string = `Removed expired token for user: ${oldToken.email}`;
                const auditLog: AuditDTO = {
                    logLevel: LogLevel.INFO,
                    data: { message: message },
                    createdTime: Date.now(),
                };
                await this.auditService.save(auditLog);
            }
        }
        const newToken = generatePassword(
            parseInt(this.configService.get<string>('token.length')),
        );

        const verificationToken = this.encryptToken(
            generateTokenDto.email,
            newToken,
            this.configService.get<string>('token.verificationSecret'),
        );

        const newTokenEntity: TokenEntity = {
            email: generateTokenDto.email,
            token: newToken,
            createTime: generateTokenDto.createTime,
            expireTime: generateTokenDto.expireTime,
        };

        await this.tokenRepository.save(newTokenEntity);

        const message: string = oldToken
            ? `Generated a new token (replacing expired one) for user: ${generateTokenDto.email}`
            : `Generated a new token for user: ${generateTokenDto.email}`;
        const auditLog: AuditDTO = {
            logLevel: LogLevel.INFO,
            data: { message: message },
            createdTime: Date.now(),
        };
        await this.auditService.save(auditLog);

        return verificationToken;
    }

    public async validateToken(
        validateTokenDto: ValidateTokenDto,
    ): Promise<TokenEntity> {
        const currentTime = Date.now();

        const { email, token } = this.decryptToken(
            validateTokenDto.verificationToken,
            this.configService.get<string>('token.verificationSecret'),
        );
        const tokenDetails = await this.tokenRepository.findOne({
            where: {
                email: email,
                token: token,
            },
        });
        if (tokenDetails) {
            if (currentTime > tokenDetails.expireTime) {
                throw new HttpException(
                    'Your request has been expired',
                    HttpStatus.EXPECTATION_FAILED,
                );
            } else {
                await this.tokenRepository.delete({
                    email: tokenDetails.email,
                    token: tokenDetails.token,
                });
                const message: string = `Removed used token for user: ${tokenDetails.email}`;
                const auditLog: AuditDTO = {
                    logLevel: LogLevel.INFO,
                    data: { message: message },
                    createdTime: Date.now(),
                };
                await this.auditService.save(auditLog);
                return tokenDetails;
            }
        } else {
            throw new HttpException(
                'Invalid request id',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    encryptToken(email: string, token: string, secretKey: string): string {
        const key = crypto
            .createHash('sha256')
            .update(secretKey, 'utf8')
            .digest();

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const data = JSON.stringify({ email, token });
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
    }

    decryptToken(
        encryptedData: string,
        secretKey: string,
    ): { email: string; token: string } {
        const key = crypto
            .createHash('sha256')
            .update(secretKey, 'utf8')
            .digest();
        const [ivHex, encryptedText] = encryptedData.split(':');
        if (!ivHex || !encryptedText) {
            throw new Error('Invalid encrypted data');
        }
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }
}
