/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganizationDto } from '@app/shared/organization/dto/organization.dto';

import { UtilService } from '@app/shared/util/service/util.service';

import { UserStateConstant } from '@app/shared/users/constants/user.state.constants';
import { UserService } from './user.service';
import { UsersEntity } from '../entity/users.entity';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UserInitializationService implements OnModuleInit {
    private readonly logger = new Logger(UserInitializationService.name);
    constructor(
        private readonly configService: ConfigService,
        private readonly dataSource: DataSource,
        private readonly utilService: UtilService,
        private readonly userService: UserService,
        @InjectRepository(OrganizationEntity)
        private readonly organizationRepository: Repository<OrganizationEntity>,
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
        @InjectRepository(OrganizationTypeEntity)
        private readonly organizationTypeRepository: Repository<OrganizationTypeEntity>,
    ) {}

    async onModuleInit() {
        // if (this.configService.get('system.initPolicy') === 'true') {
        //     await this.utilService.fetchPolicyBlocks();
        // }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();

            let asyncTask: TaskEntity = null;
            if (this.configService.get('system.initOrgs') === 'true') {
                asyncTask = plainToClass(TaskEntity, {
                    className: 'UserInitializationService',
                    functionName: 'createInitialOrganizations',
                    args: [],
                    retryAttemps: 3,
                    state: TaskEnum.PENDING,
                    retryUntilSuccess: true,
                    millisBetweenAttempts: 3000,
                });
                await queryRunner.manager.save(TaskEntity, asyncTask);
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Error occurred while initial Users');
            throw err;
        } finally {
            await this.userService.releaseQueryRunner(queryRunner);
        }
    }

    async createInitialOrganizations() {
        try {
            const singleOrgTypes: OrganizationTypeEntity[] =
                await this.organizationTypeRepository.find({
                    where: { multiple: false },
                });

            for (const orgType of singleOrgTypes) {
                const org: OrganizationEntity =
                    await this.organizationRepository.findOne({
                        where: {
                            organizationType: orgType,
                        },
                    });
                if (!org) {
                    const orgDto = new OrganizationDto();
                    orgDto.taxId =
                        this.configService.get('countryCode') + '00000';
                    orgDto.provinces = ['National'];
                    orgDto.companyRole =
                        OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY;
                    orgDto.name = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgName`,
                    );
                    orgDto.email = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgEmail`,
                    );
                    orgDto.paymentId = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgPaymentId`,
                    );
                    orgDto.phoneNo = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgPhoneNo`,
                    );
                    orgDto.address = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgAddress`,
                    );
                    orgDto.logo = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgLogo`,
                    );
                    orgDto.hederaAccount =
                        this.configService.get(
                            `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgHederaAccount`,
                        ) || undefined;
                    orgDto.hederaKey =
                        this.configService.get(
                            `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgHederaKey`,
                        ) || undefined;
                    const user = new UsersDTO();
                    user.email = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.email`,
                    );
                    user.name = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.name`,
                    );
                    user.hederaAccount =
                        this.configService.get(
                            `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.hederaAccount`,
                        ) || undefined;
                    user.hederaKey =
                        this.configService.get(
                            `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.hederaKey`,
                        ) || undefined;
                    user.password = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.password`,
                    );
                    user.phoneNo = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.phoneNo`,
                    );
                    user.role = RoleEnum.Root;
                    user.company = orgDto;
                    const groupResponse = await this.userService.register(
                        user,
                        user.password,
                        UserStateConstant.ACTIVE,
                        undefined,
                    );
                }
            }
        } catch (e) {
            this.logger.error(
                'Error occurred while creating inital organizations',
            );
            throw e;
        }
    }

    async createDnaApiAdmin() {
        try {
            const isApiUserExist: UsersEntity =
                await this.usersRepository.findOne({
                    where: {
                        isApiUser: true,
                        email: this.configService.get(
                            `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.apiAdminEmail`,
                        ),
                    },
                    relations: {
                        organization: true,
                    },
                });

            if (isApiUserExist) {
                this.logger.log('API admin already exist');
                return;
            }

            const dnaOrganization: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: {
                        organizationType: {
                            name: OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                        },
                    },
                });

            const dnaRootUser: UsersEntity = await this.usersRepository.findOne(
                {
                    where: {
                        guardianRole: {
                            role: {
                                name: RoleEnum.Root,
                            },
                        },
                    },
                },
            );

            if (!dnaOrganization || !dnaRootUser) {
                this.logger.error('No DNA Organization or Root Exists');
                throw new HttpException(
                    'No DNA Organization Exists',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            const user = new UsersDTO();

            user.email = this.configService.get(
                `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.apiAdminEmail`,
            );
            user.name = 'API User';

            user.password = this.configService.get(
                `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.apiAdminPwd`,
            );
            user.isApiUser = true;
            user.role = RoleEnum.Admin;

            await this.userService.register(
                user,
                user.password,
                UserStateConstant.ACTIVE,
                {
                    email: this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.email`,
                    ),
                    organizationName: dnaOrganization.name,
                    userName: dnaRootUser.name,
                    userId: dnaRootUser.id,
                    userRefId: dnaRootUser.refId,
                    userRole: RoleEnum.Root,
                    userState: true,
                    userHederaAccId: dnaRootUser.hederaAccount,
                    organizationId: dnaOrganization.id,
                    organizationRefId: dnaOrganization.refId,
                    organizationRole:
                        OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                    organizationState: OrganizationStateEnum.ACTIVE,
                    organizationHederaAccId: dnaOrganization.hederaAccountId,
                },
            );
        } catch (e) {
            this.logger.error('Error occurred while creating api admin user');
            throw e;
        }
    }
}
