import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TokenEntity } from '../entity/token.entity/token.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GenerateTokenDto } from '../dto/generate-token.dto';
import {
    decryptPayload,
    encryptPayload,
    formatRemainingTime,
    generatePassword,
} from '@app/shared/util/util';
import { ConfigService } from '@nestjs/config';
import { ValidateTokenDto } from '../dto/validate-token.dto';

@Injectable()
export class TokenService {
    constructor(
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
            }
        }
        const newToken = generatePassword(
            parseInt(this.configService.get<string>('token.length')),
        );

        const verificationToken = encryptPayload(
            { email: generateTokenDto.email, token: newToken },
            this.configService.get<string>('token.verificationSecret'),
        );

        const newTokenEntity: TokenEntity = {
            email: generateTokenDto.email,
            token: newToken,
            createTime: generateTokenDto.createTime,
            expireTime: generateTokenDto.expireTime,
        };

        await this.tokenRepository.save(newTokenEntity);

        return verificationToken;
    }

    public async validateToken(
        validateTokenDto: ValidateTokenDto,
    ): Promise<TokenEntity> {
        const currentTime = Date.now();
        const { email, token } = decryptPayload(
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

                return tokenDetails;
            }
        } else {
            throw new HttpException(
                'Invalid request id',
                HttpStatus.BAD_REQUEST,
            );
        }
    }
}
