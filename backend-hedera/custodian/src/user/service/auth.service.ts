import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { HTTPResponseDto } from '@app/shared/util/dto/http.response.dto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { instanceToPlain } from 'class-transformer';
import { Repository } from 'typeorm';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import {
    formatRemainingTime,
    hashPassword,
    verifyPassword,
} from '@app/shared/util/util';
import { TokenService } from '@app/shared/token/service/token.service';
import {
    FORGOT_PASSWORD_HEADER,
    RESET_PASSWORD_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { MailService } from '@app/shared/mail/service/mail.service';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import { GenerateTokenDto } from '@app/shared/token/dto/generate-token.dto';
import { PasswordResetDto } from '@app/shared/users/dto/password-reset.dto';
import { ValidateTokenDto } from '@app/shared/token/dto/validate-token.dto';
import { RequestTokenDto } from '@app/shared/token/dto/request-token.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly configService: ConfigService,
        private readonly guardianService: GuardianService,
        private readonly jwtService: JwtService,
        private readonly tokenService: TokenService,
        private readonly mailService: MailService,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
        @InjectRepository(OrganizationEntity)
        private readonly organizationsRepository: Repository<OrganizationEntity>,
    ) {}
    async generateAccessToken(
        userId: number,
        organisationId: number,
    ): Promise<string> {
        const organisationDetails = await this.organizationsRepository.findOne({
            where: { id: organisationId },
            relations: {
                organizationType: true,
            },
        });

        if (!organisationDetails) {
            throw new HttpException(
                'Organization not found',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const user = await this.usersRepository.findOne({
            where: {
                id: userId,
            },
            relations: {
                organization: true,
                guardianRole: {
                    role: true,
                    organizationType: true,
                },
            },
        });

        if (!user) {
            throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }

        const payload = new JWTPayload(
            organisationDetails.name,
            user.name,
            user.email,
            user.id,
            user.guardianRole.role.name,
            user.organization.id,
            organisationDetails.organizationType.name,
            organisationDetails.state,
        );

        return this.jwtService.signAsync(instanceToPlain(payload), {
            secret: this.configService.get<string>('apiJwt.secret'),
            expiresIn: this.configService.get<string>('apiJwt.expireTimeout'),
        });
    }

    async refreshToken(refreshToken: string) {
        if (!refreshToken) {
            throw new HttpException('JWT Expired', HttpStatus.UNAUTHORIZED);
        }

        let userId: number;
        let organizationId: number;

        try {
            const decoded = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>(
                    'apiJwt.refreshTokenSecret',
                ),
            });
            userId = decoded.userId;
            organizationId = decoded.organizationId;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            throw new HttpException(
                'Refresh Token Verification Failed',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            const generatedAccessToken = await this.generateAccessToken(
                userId,
                organizationId,
            );
            // eslint-disable-next-line camelcase
            return { access_token: generatedAccessToken };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            throw new HttpException(
                'Refresh Token Generation Failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async login(loginDto: LoginDto): Promise<HTTPResponseDto> {
        const response = new HTTPResponseDto();
        const user = await this.usersRepository.findOne({
            where: {
                email: loginDto.username.trim().toLowerCase(),
            },
            relations: {
                organization: true,
                guardianRole: {
                    role: true,
                    organizationType: true,
                },
            },
        });

        if (!user) {
            throw new HttpException(
                'Email or Password is Incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const isCorrectPass = verifyPassword(loginDto.password, user.password);

        if (!isCorrectPass) {
            throw new HttpException(
                'Email or Password is Incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }
        let guardianResponse: any;
        try {
            // add SALT to password for login
            loginDto.password = user?.password;
            guardianResponse = await this.guardianService.login(loginDto);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            throw new HttpException(
                'Email or Password is Incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }

        if (guardianResponse) {
            const organization = await this.organizationsRepository.findOne({
                where: { id: user.organization.id },
                relations: {
                    organizationType: true,
                },
            });
            if (
                !organization ||
                organization.state == OrganizationStateEnum.PENDING
            ) {
                throw new HttpException(
                    'Organization not found or Activate',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // Refresh Token Generation
            const refreshPayload = {
                userId: user.id,
                organizationId: organization.id,
                role: user.guardianRole.role.name,
                organizationRole: organization.organizationType.name,
            };

            const refreshToken = this.jwtService.sign(refreshPayload, {
                secret: this.configService.get<string>(
                    'apiJwt.refreshTokenSecret',
                ),
                expiresIn: this.configService.get<string>(
                    'apiJwt.refreshTokenExpireTimeout',
                ),
            });
            response.statusCode = HttpStatus.OK;
            response.data = {
                // eslint-disable-next-line camelcase
                access_token: await this.generateAccessToken(
                    user.id,
                    organization.id,
                ),
                // eslint-disable-next-line camelcase
                refresh_token: refreshToken,
                role: user.guardianRole?.role?.name,
                id: user.id,
                name: user.name,
                companyId: organization.id,
                companyRole: organization.organizationType.name,
                companyName: organization.name,
                companyLogo: organization?.logo,
                companyState: parseInt(organization.state),
            };
            return response;
        } else {
            throw new HttpException(
                'Email or Password is Incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    async forgotPassword(requestTokenDto: RequestTokenDto) {
        const userDetails = await this.usersRepository.findOne({
            where: {
                email: requestTokenDto.email,
            },
            relations: {
                organization: true,
            },
        });
        if (
            userDetails &&
            userDetails?.organization?.state == OrganizationStateEnum.ACTIVE
        ) {
            const createTime = Date.now();
            const tokenValidTime =
                Number(
                    this.configService.get<string>(
                        'token.forgotPwdExpireTimeOut',
                    ),
                ) * 1000;
            const expireTime = createTime + tokenValidTime;

            const generateNewToken = new GenerateTokenDto();
            generateNewToken.email = requestTokenDto.email;
            generateNewToken.createTime = createTime;
            generateNewToken.expireTime = expireTime;

            const token =
                await this.tokenService.generateNewToken(generateNewToken);

            const countryName = this.configService.get('country');
            const mailDTO: MailTemplateDTO = {
                subject: FORGOT_PASSWORD_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
                template: MailTemplateEnum.FORGOT_PASSOWRD,
                to: requestTokenDto.email,
                context: {
                    name: userDetails.name,
                    countryName: countryName,
                    remainingTime: formatRemainingTime(tokenValidTime),
                    pwdResetlink: `${this.configService.get('url')}/resetPassword/${token}`,
                },
            };
            await this.mailService.sendMail(mailDTO);

            const response: HTTPResponseDto = {
                statusCode: HttpStatus.OK,
                message: 'User found, An email was sent',
            };

            return response;
        } else {
            throw new HttpException(
                'No visible user found',
                HttpStatus.NOT_FOUND,
            );
        }
    }

    async resetPassword(
        validateTokenDto: ValidateTokenDto,
        passwordResetDto: PasswordResetDto,
    ) {
        const tokenDetails =
            await this.tokenService.validateToken(validateTokenDto);
        if (tokenDetails) {
            const userDetails = await this.usersRepository.findOneBy({
                email: tokenDetails.email,
            });

            if (!userDetails) {
                throw new HttpException(
                    'No visible user found',
                    HttpStatus.NOT_FOUND,
                );
            }
            const hashedPass = hashPassword(passwordResetDto.newPassword);
            // const serverSalt = this.configService.get('security.salt');
            const guardianResponse = await this.guardianService.passwordChange({
                newPassword: hashedPass,
                oldPassword: userDetails.password,
                username: userDetails.email,
            });

            if (guardianResponse) {
                const result = await this.usersRepository
                    .update(
                        {
                            id: userDetails.id,
                            email: userDetails.email,
                        },
                        {
                            password: hashedPass,
                        },
                    )
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    .catch((_: any) => {
                        throw new HttpException(
                            'Password update failed. Please try again',
                            HttpStatus.INTERNAL_SERVER_ERROR,
                        );
                    });

                if (result.affected > 0) {
                    const countryName = this.configService.get('country');
                    const mailDTO: MailTemplateDTO = {
                        subject: RESET_PASSWORD_HEADER.replace(
                            '{{countryName}}',
                            countryName,
                        ),
                        template: MailTemplateEnum.RESET_PASSWORD,
                        to: userDetails.email,
                        context: {
                            name: userDetails.name,
                            countryName: countryName,
                        },
                    };
                    await this.mailService.sendMail(mailDTO);

                    const response: HTTPResponseDto = {
                        statusCode: HttpStatus.OK,
                        message: 'The password has been reset successfully',
                    };

                    return response;
                } else {
                    throw new HttpException(
                        'Password update failed. Please try again',
                        HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                }
            }
        }
    }
}
