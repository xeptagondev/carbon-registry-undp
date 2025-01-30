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

@Injectable()
export class AuthService {
    constructor(
        private readonly configService: ConfigService,
        private readonly guardianService: GuardianService,
        private readonly jwtService: JwtService,
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
        let companyId: number;

        try {
            const decoded = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>(
                    'apiJwt.refreshTokenSecret',
                ),
            });
            userId = decoded.userId;
            companyId = decoded.companyId;
        } catch (_) {
            throw new HttpException(
                'Refresh Token Verification Failed',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            const generatedAccessToken = await this.generateAccessToken(
                userId,
                companyId,
            );
            return { access_token: generatedAccessToken };
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
        if (!user || !loginDto.password) {
            throw new HttpException(
                'Email or Password is Incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }
        let custodianResponse: any;
        try {
            custodianResponse = await this.guardianService.login(loginDto);
        } catch (e) {
            throw new HttpException(
                'Email or Password is Incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }

        if (
            custodianResponse &&
            custodianResponse.status == HttpStatus.CREATED
        ) {
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
                companyId: organization.id,
                role: user.guardianRole.role.name,
                companyRole: organization.organizationType.name,
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
                access_token: await this.generateAccessToken(
                    user.id,
                    organization.id,
                ),
                refresh_token: refreshToken,
                role: user.guardianRole?.role?.name,
                id: user.id,
                name: user.name,
                companyId: organization.id,
                companyRole: organization.organizationType.name,
                companyName: organization.name,
                companyLogo:
                    'https://carbon-common-uni.s3.amazonaws.com/profile_images%2F228_1736221366674.png', // Will be removed after database changes
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
}
