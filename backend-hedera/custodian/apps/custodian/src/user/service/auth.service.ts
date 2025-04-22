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
    decryptPayload,
    encryptPayload,
    formatRemainingTime,
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
import { MailPriorityGroupsEnum } from '@app/shared/mail/enum/mail-priority.enum';
import { UtilService } from '@app/shared/util/service/util.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly configService: ConfigService,
        private readonly guardianService: GuardianService,
        private readonly jwtService: JwtService,
        private readonly tokenService: TokenService,
        private readonly mailService: MailService,
        private readonly utilService: UtilService,
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
            user.refId,
            user.guardianRole.role.name,
            user.isActive,
            user.hederaAccount,
            user.organization.id,
            user.organization.refId,
            organisationDetails.organizationType.name,
            organisationDetails.state,
            organisationDetails.hederaAccountId,
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

    async findPassword(email: string) {
        const user = await this.usersRepository.findOne({
            where: {
                email: email.trim().toLowerCase(),
            },
        });
        if (!user) {
            if (!user) {
                throw new HttpException(
                    'User not found',
                    HttpStatus.UNAUTHORIZED,
                );
            }
        }
        const { password } = decryptPayload(
            user?.password,
            this.configService.get<string>('security.pwdSecret'),
        );

        return password;
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
                'Invalid credentials. Please check your username and password and try again.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        if (!(await this.utilService.isVerified('UsersEntity', user.id))) {
            throw new HttpException(
                'User not verified',
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        if (
            !(await this.utilService.isVerified(
                'OrganizationEntity',
                user.organization.id,
            ))
        ) {
            throw new HttpException(
                'Organisation not verified',
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        if (!user.isActive) {
            throw new HttpException(
                'This action is unauthorised',
                HttpStatus.UNAUTHORIZED,
            );
        }

        if (user.isApiUser) {
            throw new HttpException(
                'Api Users are not permitted',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const decryptedPassword = verifyPassword(
            user.password,
            loginDto.password,
            this.configService.get<string>('security.pwdSecret'),
        );

        if (!decryptedPassword) {
            throw new HttpException(
                'Invalid credentials. Please check your username and password and try again.',
                HttpStatus.UNAUTHORIZED,
            );
        }
        let guardianResponse: any;
        try {
            // add SALT to password for login
            loginDto.password = decryptedPassword;
            guardianResponse = await this.guardianService.login(loginDto);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            throw new HttpException(
                'Invalid credentials. Please check your username and password and try again.',
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
                    'Organisation not found or not activated.',
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
                userHederaAccount: user.hederaAccount,
                companyId: organization.id,
                companyRole: organization.organizationType.name,
                companyName: organization.name,
                companyLogo: organization?.logo,
                companyState: parseInt(organization.state),
                organizationHederaAccount: organization.hederaAccountId,
            };
            return response;
        } else {
            throw new HttpException(
                'Invalid credentials. Please check your username and password and try again.',
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
            userDetails?.organization?.state == OrganizationStateEnum.ACTIVE &&
            userDetails.isActive
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
                priority: MailPriorityGroupsEnum.HIGH_PRIORITY,
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
            const { password } = decryptPayload(
                userDetails.password,
                this.configService.get<string>('security.pwdSecret'),
            );

            if (!password) {
                throw new HttpException(
                    'Email or Password is Incorrect',
                    HttpStatus.UNAUTHORIZED,
                );
            }
            const encryptedPassword = encryptPayload(
                {
                    password: passwordResetDto.newPassword,
                },
                this.configService.get<string>('security.pwdSecret'),
            );
            // const serverSalt = this.configService.get('security.salt');
            const guardianResponse = await this.guardianService.passwordChange({
                newPassword: passwordResetDto.newPassword,
                oldPassword: password,
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
                            password: encryptedPassword,
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
