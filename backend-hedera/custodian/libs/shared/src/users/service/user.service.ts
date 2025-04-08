/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { SuperService } from '@app/core/service/super.service';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { RoleEntity } from '@app/shared/role/entity/role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import {
    OrganizationTypeEnum,
    OrganizationTypeFormatEnum,
} from '@app/shared/organization-type/enum/organization-type.enum';
import {
    encryptPayload,
    decryptPayload,
    generatePassword,
    verifyPassword,
} from '@app/shared/util/util';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import {
    ORG_CREATE_HEADER,
    RESET_PASSWORD_HEADER,
    USER_REGISTER_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { MailService } from '@app/shared/mail/service/mail.service';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { HelperService } from '@app/shared/util/service/helper.service';
import { UtilService } from '@app/shared/util/service/util.service';
import { OrganizationService } from '@app/shared/organization/service/organization.service';
import { FileHandlerInterface } from '@app/shared/file-handler/filehandler.interface';
import { PasswordUpdateDto } from '@app/shared/users/dto/password-update.dto';
import { HTTPResponseDto } from '@app/shared/util/dto/http.response.dto';
import { UserUpdateDto } from '@app/shared/users/dto/user-update.dto';
import { UserStageEnum } from '@app/shared/users/enum/user.stage.enum';
import { DataExportQueryDto } from '@app/shared/util/dto/data.export.query.dto';
import { DataExportUserDto } from '@app/shared/util/dto/data.export.user.dto';
import { DataExportService } from '@app/shared/util/service/data-export.service';
import { UserStateConstant } from '@app/shared/users/constants/user.state.constants';
import { CounterType } from '@app/shared/util/enum/counter.type.enum';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { OrganizationSchema } from '@app/shared/guardian/interface/guardian-schema.interface';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import { UserSchemaDtos } from '@app/shared/guardian/dto/guardian-schema.dto';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { GuardianStateEnum } from '@app/shared/guardian/enum/guardian-state.enum';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { MailPriorityGroupsEnum } from '@app/shared/mail/enum/mail-priority.enum';
import { CreditBlocksEntity } from '@app/shared/carbon-credit-token/entity/credit.blocks.entity';
import { plainToClass } from 'class-transformer';
import { EventEntity } from '@app/shared/event/entity/event.entity';
import { EventTypeEnum } from '@app/shared/event/enum/event-type.enum';
import { EventStateEnum } from '@app/shared/event/enum/event-state.enum';

@Injectable()
export class UserService extends SuperService<UsersEntity, UsersDTO> {
    private readonly loggerContext = 'UserService';
    constructor(
        private readonly guardianService: GuardianService,
        private readonly configService: ConfigService,
        private readonly utilService: UtilService,
        private readonly mailService: MailService,
        private readonly fileHandler: FileHandlerInterface,
        private readonly helperService: HelperService,
        private readonly dataExportService: DataExportService,
        private readonly orgaisationService: OrganizationService,
        private readonly logger: InstantLogger,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
        private readonly dataSource: DataSource,
    ) {
        super(usersRepository);
    }
    private userExportMap = {
        id: 'User Id',
        email: 'Email',
        role: 'Role',
        name: 'Name',
        country: 'Country',
        phoneNo: 'Phone Number',
        companyId: 'Organization Id',
        companyName: 'Organization Name',
        companyRole: 'Organization Type',
        createdTime: 'Created At',
        isPending: 'Pending Approval',
        nothingToExport: 'Data not found for export',
        users: 'Users',
        PD: 'Project Developer',
        DNA: 'Designated National Authority',
        IC: 'Independent Certifier',
        ClimateFund: 'Zimbabwe Climate Fund',
        ExecutiveCommittee: 'Executive Committee',
        Ministry: 'Ministry',
    };

    mapNewQueryToOldQuery(newUser: UsersEntity) {
        return {
            id: newUser.id,
            email: newUser.email,
            role: newUser.guardianRole?.role?.name ?? null,
            name: newUser.name,
            country: null,
            phoneNo: newUser.phoneNumber,
            companyId: newUser.organization?.id,
            companyRole: newUser.guardianRole?.name ?? null,
            createdTime: newUser.createdTime,
            isPending: !newUser?.isActive,
            hederaAccount: newUser?.hederaAccount,
            company: {
                companyId: newUser.organization?.id,
                name: newUser.organization?.name,
                taxId: newUser.organization?.taxId,
                paymentId: newUser.organization?.paymentId,
                email: newUser.organization?.email,
                phoneNo: newUser.phoneNumber ?? null,
                website: newUser.organization?.website,
                address: newUser.organization?.address,
                country: null,
                logo: newUser?.organization?.logo,
                companyRole:
                    newUser.organization?.organizationType?.name ?? null,
                state: newUser.organization?.state ?? null,
                creditBalance: null,
                secondaryAccountBalance: null,
                programmeCount: newUser?.organization?.numberOfProjects,
                lastUpdateVersion: null,
                creditTxTime: null,
                remarks: null,
                createdTime: newUser?.organization?.createdTime,
                geographicalLocationCordintes: null,
                regions: null,
                nameOfMinister: null,
                sectoralScope: null,
                omgePercentage: null,
                nationalSopValue: null,
                ministry: null,
                govDep: null,
            },
        };
    }

    async updateUser(
        queryRunner: QueryRunner,
        userDTO: UsersDTO,
        orgEntity: OrganizationEntity,
        guardRole: GuardianRoleEntity,
    ): Promise<boolean> {
        await queryRunner.manager.update(
            UsersEntity,
            {
                email: userDTO.email,
            },
            plainToClass(UsersEntity, {
                updatedTime: new Date().getTime(),
                organization: orgEntity,
                guardianRole: guardRole,
            }),
        );

        return true;
    }

    private async getGuardianRole(
        queryRunner: QueryRunner,
        orgTypeId: number,
        userRole: string,
    ) {
        const orgType: OrganizationTypeEntity =
            await queryRunner.manager.findOneBy(OrganizationTypeEntity, {
                id: orgTypeId,
            });

        const role: RoleEntity = await queryRunner.manager.findOneBy(
            RoleEntity,
            {
                name: userRole,
            },
        );

        // get guardian role
        const guardRole: GuardianRoleEntity =
            await queryRunner.manager.findOneBy(GuardianRoleEntity, {
                organizationType: orgType,
                role: role,
            });
        return guardRole;
    }

    async checkOrgDuplicates(
        queryRunner: QueryRunner,
        email: string,
        taxId: string,
        paymentId: string,
    ) {
        const existingOrganization = await queryRunner.manager.findOne(
            OrganizationEntity,
            {
                where: [
                    { email: email },
                    { taxId: taxId },
                    { paymentId: paymentId },
                ],
            },
        );

        if (existingOrganization) {
            let errorMessage = 'This organisation already exists';

            if (taxId === existingOrganization.taxId) {
                errorMessage =
                    'Organisation already exists in the Carbon Registry System with the given Tax ID';
            } else if (paymentId === existingOrganization.paymentId) {
                errorMessage =
                    'Organisation already exists in the Carbon Registry System with the given Registration Payment ID';
            } else if (email === existingOrganization.email) {
                errorMessage =
                    'Organisation already exists in the Carbon Registry System with the given email';
            }

            throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
        }
    }

    async checkForUserDuplicates(email: string, hederaAccount: string) {
        const existingUser = await this.usersRepository.findOne({
            where: [{ email: email }, { hederaAccount: hederaAccount }],
        });

        if (existingUser) {
            let errorMessage =
                'Account creation failed: The provided Hedera account ID already exists.';

            if (email === existingUser.email) {
                errorMessage =
                    'Account creation failed: The provided email address is already registered in the system.';
            }

            throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
        }
    }

    // User/Organization Registration Flow
    public async register(
        userDto: UsersDTO,
        defaultPass: string = '',
        isUserActive: boolean,
        requestUser?: JWTPayload,
    ): Promise<HTTPResponseDto> {
        return await this.validationsAndDataBaseSave(
            userDto,
            defaultPass,
            isUserActive,
            requestUser,
        );
    }

    // --------------- User Registration Main Steps ---------------------------

    async validationsAndDataBaseSave(
        userDto: UsersDTO,
        defaultPass = '',
        isUserActive: boolean,
        requestUser?: JWTPayload,
    ): Promise<any> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();

            let user: UsersEntity;

            user = await queryRunner.manager.findOneBy(UsersEntity, {
                email: userDto.email,
            });

            // If user is already at COMPLETED stage, block re-registration
            if (user) {
                throw new HttpException(
                    `Account creation failed: The email ${userDto.email} is already registered.`,
                    HttpStatus.FORBIDDEN,
                );
            }

            const decryptedPassword = defaultPass || generatePassword(8);
            const encryptedPassword = encryptPayload(
                { password: decryptedPassword },
                this.configService.get<string>('security.pwdSecret'),
            );

            // Check duplicates before Guardian signup
            let organization: OrganizationEntity;
            if (userDto.company) {
                await this.checkOrgDuplicates(
                    queryRunner,
                    userDto.company.email,
                    userDto.company.taxId,
                    userDto.company.paymentId,
                );

                const orgCreateTime = new Date().getTime();
                // Create organization in Guardian
                const orgType = await queryRunner.manager.findOne(
                    OrganizationTypeEntity,
                    {
                        where: { name: userDto?.company?.companyRole },
                    },
                );

                const orgEntity = new OrganizationEntity();
                orgEntity.name = userDto.company.name;
                orgEntity.organizationType = orgType;
                orgEntity.email = userDto?.company?.email;
                orgEntity.taxId = userDto?.company?.taxId;
                orgEntity.state = OrganizationStateEnum.PENDING;
                orgEntity.hederaAccountId = userDto?.company?.hederaAccountId;
                orgEntity.hederaAccountKey = userDto?.company?.hederaAccountKey;
                orgEntity.phoneNumber = userDto?.company?.phoneNo;
                orgEntity.paymentId = userDto?.company?.paymentId;
                orgEntity.faxNumber = userDto?.company?.faxNo;
                orgEntity.provinces = userDto?.company?.provinces;
                orgEntity.website = userDto?.company?.website;
                orgEntity.address = userDto?.company?.address;
                orgEntity.createdTime = orgCreateTime;
                orgEntity.updatedTime = new Date().getTime();

                // iii. Save organization
                organization = await queryRunner.manager.save(
                    OrganizationEntity,
                    orgEntity,
                );

                if (
                    userDto?.company?.logo &&
                    this.helperService.isBase64(userDto.company.logo)
                ) {
                    const response: any = await this.fileHandler.uploadFile(
                        `profile_images/${organization.refId}_${new Date().getTime()}.png`,
                        userDto.company.logo,
                    );
                    orgEntity.logo = response;
                }

                organization = await queryRunner.manager.save(
                    OrganizationEntity,
                    orgEntity,
                );
            } else {
                organization = await queryRunner.manager.findOneBy(
                    OrganizationEntity,
                    {
                        id: requestUser.organizationId,
                    },
                );
            }

            await this.checkForUserDuplicates(
                userDto.email,
                userDto.hederaAccount,
            );

            // Save user locally
            const userEntity = new UsersEntity();
            userEntity.email = userDto.email;
            userEntity.name = userDto.name;
            userEntity.password = encryptedPassword;
            userEntity.phoneNumber = userDto.phoneNo;
            userEntity.hederaAccount = userDto.hederaAccount;
            userEntity.stage = UserStageEnum.VALIDATIONS_N_DATABASE_SAVE;
            userEntity.isActive = isUserActive;
            userEntity.isApiUser = userDto.isApiUser;
            userEntity.createdTime = new Date().getTime();
            userEntity.updatedTime = new Date().getTime();
            userEntity.organization = organization;

            user = await queryRunner.manager.save(UsersEntity, userEntity);

            const submittedUser = await queryRunner.manager.findOneBy(
                UsersEntity,
                { id: requestUser.userId },
            );

            let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                className: 'UserService',
                functionName: 'guardianRegisterUser',
                args: [user],
                state: TaskEnum.PENDING,
                retryAttemps: 3,
                retryUntilSuccess: true,
                millisBetweenAttempts: 3000,
                submittedUser: submittedUser,
            });
            asyncTask = await queryRunner.manager.save(TaskEntity, asyncTask);

            let asyncTaskTwo = plainToClass(TaskEntity, {
                className: 'UserService',
                functionName: 'userHederaAccGen',
                args: [],
                state: TaskEnum.PENDING,
                retryAttemps: 2,
                retryUntilSuccess: true,
                millisBetweenAttempts: 3000,
                submittedUser: submittedUser,
                previousTask: asyncTask,
            });

            asyncTaskTwo = await queryRunner.manager.save(
                TaskEntity,
                asyncTaskTwo,
            );

            await queryRunner.manager.update(
                TaskEntity,
                { id: asyncTaskTwo.id },
                plainToClass(TaskEntity, {
                    args: [userDto, asyncTaskTwo.id, isUserActive, requestUser],
                }),
            );

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(
                'Failed to save user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async guardianRegisterUser(user: UsersEntity) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                user.email,
                UserStageEnum.GUARDIAN_REGISTER_USER,
            );

            const decryptedPassword = await this.decryptPassword(user);

            await this.guardianService.registerUser(
                user.email,
                decryptedPassword,
            );

            await this.guardianService.login({
                username: user.email,
                password: decryptPayload(
                    user.password,
                    this.configService.get<string>('security.pwdSecret'),
                )?.password,
            });

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async userHederaAccGen(
        userDto: UsersDTO,
        taskEntityId: number,
        isUserActive?: boolean,
        requestUser?: JWTPayload,
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.USER_HEDERA_ACC_GEN,
            );

            let accGenTaskId: string;
            if (!userDto.hederaAccount && !userDto.hederaKey) {
                accGenTaskId = await this.hederaAccGenerate(userDto);
            }

            const prevTask = await queryRunner.manager.findOneBy(TaskEntity, {
                id: taskEntityId,
            });

            let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                className: 'UserService',
                functionName: 'guardianConfigUpdate',
                args: [],
                state: TaskEnum.PENDING,
                retryAttemps: 3,
                retryUntilSuccess: true,
                millisBetweenAttempts: 3000,
                previousTask: prevTask,
                // events: [events],
            });
            asyncTask = await queryRunner.manager.save(TaskEntity, asyncTask);

            await queryRunner.manager.update(
                TaskEntity,
                { id: asyncTask.id },
                plainToClass(TaskEntity, {
                    args: [
                        userDto,
                        asyncTask.id,
                        accGenTaskId,
                        isUserActive,
                        requestUser,
                    ],
                }),
            );

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async guardianConfigUpdate(
        userDto: UsersDTO,
        taskEntityId: number,
        accGenTaskId?: string,
        isUserActive?: boolean,
        requestUser?: JWTPayload,
    ): Promise<any> {
        let hederaAccResult: any;

        if (!(userDto.hederaAccount && userDto.hederaKey)) {
            hederaAccResult = await this.verifyGuardianAsyncTask(
                userDto,
                accGenTaskId,
            );
            if (!hederaAccResult) {
                throw new HttpException(
                    'Hedera Account Generation Failed',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.GUARDIAN_CONFIG_UPDATE,
            );

            await this.usersRepository.update(
                { email: userDto.email },
                {
                    hederaAccount: userDto.hederaAccount
                        ? userDto.hederaAccount
                        : hederaAccResult?.id,
                },
            );

            const updateTaskId = await this.guardianService.updateUserProfile(
                userDto.email,
                this.configService.get('sru.did'),
                userDto.hederaAccount
                    ? userDto.hederaAccount
                    : hederaAccResult?.id,
                userDto.hederaKey ? userDto.hederaKey : hederaAccResult?.key,
            );

            const prevTask = await queryRunner.manager.findOneBy(TaskEntity, {
                id: taskEntityId,
            });

            let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                className: 'UserService',
                functionName: 'guardianAssignPolicy',
                args: [userDto, updateTaskId, isUserActive, requestUser],
                state: TaskEnum.PENDING,
                retryAttemps: 3,
                retryUntilSuccess: true,
                millisBetweenAttempts: 3000,
                previousTask: prevTask,
            });
            asyncTask = await queryRunner.manager.save(TaskEntity, asyncTask);

            if (userDto.company) {
                let asyncTaskTwo: TaskEntity = plainToClass(TaskEntity, {
                    className: 'UserService',
                    functionName: 'guardianCreateGroupType',
                    args: [userDto],
                    state: TaskEnum.PENDING,
                    retryAttemps: 3,
                    retryUntilSuccess: true,
                    millisBetweenAttempts: 3000,
                    previousTask: asyncTask,
                });
                asyncTaskTwo = await queryRunner.manager.save(
                    TaskEntity,
                    asyncTaskTwo,
                );

                let asyncTaskThree: TaskEntity = plainToClass(TaskEntity, {
                    className: 'UserService',
                    functionName: 'orgHederaAccGen',
                    args: [],
                    state: TaskEnum.PENDING,
                    retryAttemps: 3,
                    retryUntilSuccess: true,
                    millisBetweenAttempts: 3000,
                    previousTask: asyncTaskTwo,
                });

                asyncTaskThree = await queryRunner.manager.save(
                    TaskEntity,
                    asyncTaskThree,
                );

                await queryRunner.manager.update(
                    TaskEntity,
                    { id: asyncTaskThree.id },
                    plainToClass(TaskEntity, {
                        args: [
                            userDto,
                            asyncTaskThree.id,
                            isUserActive,
                            requestUser,
                        ],
                    }),
                );
            } else {
                const org = await queryRunner.manager.findOneBy(
                    OrganizationEntity,
                    { email: userDto.company.email },
                );
                let asyncTaskTwo: TaskEntity = plainToClass(TaskEntity, {
                    className: 'UserService',
                    functionName: 'guardianUserCreate',
                    args: [],
                    state: TaskEnum.PENDING,
                    retryAttemps: 3,
                    retryUntilSuccess: true,
                    millisBetweenAttempts: 3000,
                    previousTask: asyncTask,
                });
                asyncTaskTwo = await queryRunner.manager.save(
                    TaskEntity,
                    asyncTaskTwo,
                );

                await queryRunner.manager.update(
                    TaskEntity,
                    { id: asyncTaskTwo.id },
                    plainToClass(TaskEntity, {
                        args: [
                            userDto,
                            org.id,
                            org.group,
                            true,
                            asyncTaskTwo.id,
                            true,
                            requestUser,
                        ],
                    }),
                );
            }

            await queryRunner.commitTransaction();
        } catch (er) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(
                'Failed to save user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async guardianAssignPolicy(userDto: UsersDTO, updateTaskId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.GUARDIAN_ASSIGN_POLICY,
            );

            const updateAccResult = await this.verifyGuardianAsyncTask(
                userDto,
                updateTaskId,
            );
            if (!updateAccResult) {
                throw new HttpException(
                    'Account Config Update Failed',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
            await this.guardianService.assignPolicyToUser(userDto.email, true);

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async guardianCreateGroupType(userDto: UsersDTO) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.GUARDIAN_CREATE_GROUP_TYPE,
            );

            if (userDto.company) {
                const groupTypeBlock =
                    await this.utilService.getBlocksByBlockName(
                        GUARDIAN_API.BLOCKS.CREATE_GROUP_TYPE,
                        this.configService.get('policy.id'),
                    );

                const user = await queryRunner.manager.findOne(UsersEntity, {
                    where: { email: userDto.email },
                });

                const decryptedPassword = await this.decryptPassword(user);
                await this.guardianService.createGroupType(
                    userDto.email,
                    decryptedPassword,
                    groupTypeBlock?.blockId,
                    {
                        group: userDto.company.companyRole,
                        label: userDto.company.name,
                    },
                );
            }
            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async orgHederaAccGen(
        userDto: UsersDTO,
        taskEntityId: number,
        isUserActive?: boolean,
        requestUser?: JWTPayload,
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.ORGANIZATION_HEDERA_ACC_GEN,
            );
            let accGenTaskId: string;

            if (
                !userDto.company.hederaAccountId &&
                !userDto.company.hederaAccountKey
            ) {
                accGenTaskId = await this.hederaAccGenerate(userDto);
            }

            const prevTask = await queryRunner.manager.findOneBy(TaskEntity, {
                id: taskEntityId,
            });

            let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                className: 'UserService',
                functionName: 'guardianOrganizationSave',
                args: [],
                state: TaskEnum.PENDING,
                retryAttemps: 3,
                retryUntilSuccess: true,
                millisBetweenAttempts: 3000,
                previousTask: prevTask,
            });
            asyncTask = await queryRunner.manager.save(TaskEntity, asyncTask);

            await queryRunner.manager.update(
                TaskEntity,
                { id: asyncTask.id },
                plainToClass(TaskEntity, {
                    args: [
                        userDto,
                        accGenTaskId,
                        taskEntityId,
                        isUserActive,
                        requestUser,
                    ],
                }),
            );

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async guardianOrganizationSave(
        userDto: UsersDTO,
        accGenTaskId: string,
        taskEntityId: number,
        isUserActive?: boolean,
        requestUser?: JWTPayload,
    ) {
        let hederaAccResult: any;

        if (
            !(
                userDto.company.hederaAccountId &&
                userDto.company.hederaAccountKey
            )
        ) {
            hederaAccResult = await this.verifyGuardianAsyncTask(
                userDto,
                accGenTaskId,
            );
            if (!hederaAccResult) {
                throw new HttpException(
                    'Hedera Account Generation Failed',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();

            await queryRunner.manager.update(
                OrganizationEntity,
                { email: userDto.company.email },
                plainToClass(OrganizationEntity, {
                    hederaAccountId: userDto.company.hederaAccountId
                        ? userDto.company.hederaAccountId
                        : hederaAccResult?.id,
                    hederaAccountKey: userDto.company.hederaAccountKey
                        ? userDto.company.hederaAccountKey
                        : hederaAccResult?.key,
                }),
            );

            const organisation = await queryRunner.manager.findOneBy(
                OrganizationEntity,
                {
                    email: userDto.company.email,
                },
            );

            let events: EventEntity = plainToClass(EventEntity, {
                type: EventTypeEnum.CREATE,
                status: EventStateEnum.PENDING,
                affectedTableName: 'OrganizationEntity',
                affectedRecordId: organisation.id,
                rollbackOnFail: false,
                maxVerifyDurationSec: 120,
                documentRefId: organisation.refId,
                gridType: GridTypeEnum.ORGANIZATION_GRID,
            });

            events = await queryRunner.manager.save(EventEntity, events);

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.GUARDIAN_ORGANIZATION_SAVE,
            );

            const orgType = await queryRunner.manager.findOne(
                OrganizationTypeEntity,
                {
                    where: { name: userDto?.company?.companyRole },
                },
            );

            const organization = await queryRunner.manager.findOneBy(
                OrganizationEntity,
                { email: userDto.company.email },
            );

            const blockName = orgType.multiple
                ? GUARDIAN_API.BLOCKS.CREATE_MULTIPLE_ORGANIZATION
                : GUARDIAN_API.BLOCKS.CREATE_SINGLE_ORGANIZATION;
            const createOrganizationResponse =
                await this.guardianService.saveDocument(
                    userDto.email,
                    blockName,
                    {
                        document: {
                            name: userDto.company.name,
                            role: userDto.company.companyRole,
                            email: userDto.company.email,
                            taxId: userDto.company.taxId,
                            phoneNumber: userDto.company.phoneNo,
                            paymentId: userDto.company.paymentId,
                            faxNumber: userDto.company.faxNo,
                            provinces: userDto.company.provinces,
                            website: userDto.company.website,
                            address: userDto.company.address,
                            logo: userDto.company.logo,
                            createdTime: Number(organization.createdTime),
                            updatedTime: Number(new Date().getTime()),
                            refId: organization.refId,
                            eventIds: [events.id],
                        },
                        ref: null,
                    },
                );

            const prevTask = await queryRunner.manager.findOneBy(TaskEntity, {
                id: taskEntityId,
            });

            let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                className: 'UserService',
                functionName: 'guardianUserCreate',
                args: [],
                state: TaskEnum.PENDING,
                retryAttemps: 3,
                retryUntilSuccess: true,
                millisBetweenAttempts: 3000,
                previousTask: prevTask,
                events: [events],
            });

            asyncTask = await queryRunner.manager.save(TaskEntity, asyncTask);

            await queryRunner.manager.update(
                TaskEntity,
                { id: asyncTask.id },
                plainToClass(TaskEntity, {
                    args: [
                        userDto,
                        organisation.id,
                        createOrganizationResponse.group,
                        orgType.multiple,
                        asyncTask.id,
                        isUserActive,
                        requestUser,
                    ],
                }),
            );

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async guardianUserCreate(
        userDto: UsersDTO,
        orgId: number,
        orgGroup: string,
        isMultiple: boolean,
        taskEntityId: number,
        isUserActive?: boolean,
        requestUser?: JWTPayload,
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.GUARDIAN_USER_CREATE,
            );

            if (userDto.company) {
                await queryRunner.manager.update(
                    OrganizationEntity,
                    { id: orgId },
                    plainToClass(OrganizationEntity, {
                        state: isMultiple
                            ? OrganizationStateEnum.PENDING
                            : OrganizationStateEnum.ACTIVE,
                        group: orgGroup,
                    }),
                );
            }

            const user = await queryRunner.manager.findOneBy(UsersEntity, {
                email: userDto.email,
            });

            let events: EventEntity = plainToClass(EventEntity, {
                type: EventTypeEnum.CREATE,
                status: EventStateEnum.PENDING,
                affectedTableName: 'UsersEntity',
                affectedRecordId: user.id,
                rollbackOnFail: false,
                maxVerifyDurationSec: 120,
                documentRefId: user.refId,
                gridType: GridTypeEnum.USER_GRID,
            });

            events = await queryRunner.manager.save(EventEntity, events);

            const prevTask = await queryRunner.manager.findOneBy(TaskEntity, {
                id: taskEntityId,
            });

            if (userDto.company) {
                await this.addOrgAdmin(userDto, events.id, queryRunner);

                let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                    className: 'UserService',
                    functionName: 'guardianApproveOrg',
                    args: [],
                    state: TaskEnum.PENDING,
                    retryAttemps: 3,
                    retryUntilSuccess: true,
                    millisBetweenAttempts: 3000,
                    previousTask: prevTask,
                    events: [events],
                });
                asyncTask = await queryRunner.manager.save(
                    TaskEntity,
                    asyncTask,
                );

                await queryRunner.manager.update(
                    TaskEntity,
                    { id: asyncTask.id },
                    plainToClass(TaskEntity, {
                        args: [
                            userDto,
                            asyncTask.id,
                            isUserActive,
                            requestUser,
                        ],
                    }),
                );
            } else {
                await this.addNewUserViaInvite(
                    userDto,
                    events.id,
                    requestUser,
                    queryRunner,
                );

                let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                    className: 'UserService',
                    functionName: 'emailSedning',
                    args: [userDto, isUserActive],
                    state: TaskEnum.PENDING,
                    retryAttemps: 3,
                    retryUntilSuccess: true,
                    millisBetweenAttempts: 3000,
                    previousTask: prevTask,
                });
                asyncTask = await queryRunner.manager.save(
                    TaskEntity,
                    asyncTask,
                );
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async guardianApproveOrg(
        userDto: UsersDTO,
        taskEntityId: number,
        isUserActive?: boolean,
        requestUser?: JWTPayload,
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();

            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.GUARDIAN_APPROVE_ORGANIZATION,
            );

            if (userDto.company) {
                const orgEntity = await queryRunner.manager.findOne(
                    OrganizationEntity,
                    {
                        where: { email: userDto.company.email },
                    },
                );
                if (
                    requestUser?.organizationRole ===
                        OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
                    (requestUser?.userRole === RoleEnum.Admin ||
                        requestUser?.userRole === RoleEnum.Root)
                ) {
                    await this.orgaisationService.approve(
                        requestUser?.email,
                        orgEntity.id,
                        { remarks: '' },
                    );
                }
            }

            const prevTask = await queryRunner.manager.findOneBy(TaskEntity, {
                id: taskEntityId,
            });

            let asyncTask: TaskEntity = plainToClass(TaskEntity, {
                className: 'UserService',
                functionName: 'emailSedning',
                args: [userDto, isUserActive],
                state: TaskEnum.PENDING,
                retryAttemps: 3,
                retryUntilSuccess: true,
                millisBetweenAttempts: 3000,
                previousTask: prevTask,
            });
            asyncTask = await queryRunner.manager.save(TaskEntity, asyncTask);

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async emailSedning(userDto: UsersDTO, isUserActive: boolean) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();
            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.EMAIL_SENDING,
            );
            await this.sendRegistrationEmails(
                userDto,
                queryRunner,
                isUserActive,
            );
            await this.registerProcessSave(
                queryRunner,
                userDto.email,
                UserStageEnum.COMPLETED,
            );
            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    // --------------- Helpers --------------------

    private async hederaAccGenerate(userDTO: UsersDTO): Promise<string> {
        const accGenTaskId = await this.guardianService.generateHederaAccount(
            userDTO.email,
        );
        return accGenTaskId.taskId;
    }

    private async verifyGuardianAsyncTask(
        userDTO: UsersDTO,
        taskId: string,
    ): Promise<any> {
        const getAsyncTask = await this.guardianService.fetchAsyncTaskResponse(
            taskId,
            userDTO.email,
        );

        if (!getAsyncTask) {
            throw new HttpException(
                `Guardian task: ${taskId} failed`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        return getAsyncTask;
    }

    private async addOrgAdmin(
        userDto: UsersDTO,
        eventId: number,
        queryRunner: QueryRunner = null,
    ): Promise<void> {
        if (!queryRunner) {
            queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
        }
        try {
            if (!queryRunner) {
                await queryRunner.startTransaction();
            }
            const user = await queryRunner.manager.findOneBy(UsersEntity, {
                email: userDto.email,
            });

            const orgEntity = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { email: userDto.company.email },
                },
            );

            const orgType = await queryRunner.manager.findOne(
                OrganizationTypeEntity,
                {
                    where: {
                        name: userDto?.company?.companyRole,
                    },
                },
            );

            const guardianRole = await this.getGuardianRole(
                queryRunner,
                orgType.id,
                userDto.role,
            );

            await this.updateUser(
                queryRunner,
                userDto,
                orgEntity,
                guardianRole,
            );

            await this.guardianService.saveDocument(
                userDto.email,
                GUARDIAN_API.BLOCKS.CREATE_USER,
                {
                    document: {
                        name: userDto.name,
                        role: userDto.role,
                        email: userDto.email,
                        phoneNumber: userDto.phoneNo,
                        hederaAccount: user?.hederaAccount,
                        refId: user.refId,
                        createdTime: Number(user.createdTime),
                        updatedTime: Number(new Date().getTime()),
                        organization: orgEntity.refId,
                        eventIds: [eventId],
                    },
                    ref: null,
                },
            );

            if (!queryRunner) {
                await queryRunner.commitTransaction();
            }
        } catch (err) {
            if (!queryRunner) {
                await queryRunner.rollbackTransaction();
            }
        } finally {
            if (!queryRunner) {
                await this.releaseQueryRunner(queryRunner);
            }
        }
    }

    private async addNewUserViaInvite(
        userDto: UsersDTO,
        eventId: number,
        reqUser?: JWTPayload,
        queryRunner: QueryRunner = null,
    ): Promise<any> {
        if (!queryRunner) {
            queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
        }
        try {
            if (!queryRunner) {
                await queryRunner.startTransaction();
            }
            const user = await queryRunner.manager.findOneBy(UsersEntity, {
                email: userDto.email,
            });

            const org: OrganizationEntity = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: {
                        id: reqUser?.organizationId,
                    },
                    relations: {
                        organizationType: true,
                    },
                },
            );

            const guardianRole = await this.getGuardianRole(
                queryRunner,
                org?.organizationType?.id,
                userDto.role,
            );

            await this.updateUser(queryRunner, userDto, org, guardianRole);

            const inviteBlock = await this.utilService.getBlocksByBlockName(
                GUARDIAN_API.BLOCKS.USER_CREATE_INVITE,
                this.configService.get('policy.id'),
            );

            const inviteResponse = await this.guardianService.createInvitation(
                reqUser?.email,
                inviteBlock?.blockId,
                {
                    action: 'invite',
                    group: org.group,
                    role: guardianRole.name,
                },
            );

            // 2. Submit the generated invitation for user creation
            const groupTypeBlock = await this.utilService.getBlocksByBlockName(
                GUARDIAN_API.BLOCKS.CREATE_GROUP_TYPE,
                this.configService.get('policy.id'),
            );
            await this.guardianService.createGroupType(
                userDto.email,
                decryptPayload(
                    user.password,
                    this.configService.get<string>('security.pwdSecret'),
                )?.password,
                groupTypeBlock?.blockId,
                {
                    invitation: inviteResponse.invitation,
                },
            );

            await this.guardianService.saveDocument(
                reqUser.email,
                GUARDIAN_API.BLOCKS.CREATE_USER,
                {
                    document: {
                        name: userDto.name,
                        role: userDto.role,
                        email: userDto.email,
                        phoneNumber: userDto.phoneNo,
                        hederaAccount: user.hederaAccount,
                        refId: user.refId,
                        createdTime: Number(user.createdTime),
                        updatedTime: Number(new Date().getTime()),
                        organization: org.refId,
                        eventIds: [eventId],
                    },
                    ref: null,
                },
            );

            if (!queryRunner) {
                await queryRunner.commitTransaction();
            }
        } catch (e) {
            if (!queryRunner) {
                await queryRunner.rollbackTransaction();
            }
        } finally {
            if (!queryRunner) {
                await this.releaseQueryRunner(queryRunner);
            }
        }
    }

    private async sendRegistrationEmails(
        userDto: UsersDTO,
        queryRunner: QueryRunner = null,
        isUserActive: boolean = UserStateConstant.DEACTIVE,
    ): Promise<void> {
        if (!queryRunner) {
            queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
        }
        const countryName = this.configService.get('country');
        const user = await queryRunner.manager.findOneBy(UsersEntity, {
            email: userDto.email,
        });
        const decryptedPassword = decryptPayload(
            user.password,
            this.configService.get<string>('security.pwdSecret'),
        )?.password;

        if (userDto.company) {
            const mailDTOOrg: MailTemplateDTO = {
                subject: ORG_CREATE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
                template: MailTemplateEnum.ORG_CREATE,
                to: userDto.company.email,
                context: {
                    organizationName: userDto.company.name,
                    countryName,
                    organizationRole:
                        OrganizationTypeFormatEnum[userDto.company.companyRole],
                    home: this.configService.get('url'),
                },
                priority: MailPriorityGroupsEnum.HIGH_PRIORITY,
            };
            await this.mailService.sendMail(mailDTOOrg);
        }

        const mailDTOUser: MailTemplateDTO = {
            subject: USER_REGISTER_HEADER.replace(
                '{{countryName}}',
                countryName,
            ),
            template:
                isUserActive === true
                    ? MailTemplateEnum.PASSWORD_CREATE
                    : MailTemplateEnum.PENDING_USER_CREATE,
            to: userDto.email,
            context: {
                name: userDto.name,
                countryName,
                home: this.configService.get('url'),
                email: userDto.email,
                tempPassword: decryptedPassword,
            },
            priority: MailPriorityGroupsEnum.HIGH_PRIORITY,
        };
        await this.mailService.sendMail(mailDTOUser);
    }

    private async registerProcessSave(
        queryRunner: QueryRunner,
        email: string,
        status: UserStageEnum,
    ): Promise<void> {
        await queryRunner.manager.update(
            UsersEntity,
            { email: email },
            plainToClass(UsersEntity, {
                updatedTime: new Date().getTime(),
                stage: status,
            }),
        );
    }

    private async decryptPassword(user: UsersEntity): Promise<string> {
        return decryptPayload(
            user.password,
            this.configService.get<string>('security.pwdSecret'),
        )?.password;
    }

    async download(queryData: DataExportQueryDto) {
        let query = new QueryDto();
        query.filterAnd = queryData.filterAnd;
        query.filterOr = queryData.filterOr;
        query.sort = queryData.sort;

        // if (query.filterAnd) {
        //     query.filterAnd.push({
        //     key: "companyRole",
        //     operation: "!=",
        //     value: "API",
        //   });
        // } else {
        //   const filterAnd: FilterEntry[] = [];
        //   filterAnd.push({
        //     key: "companyRole",
        //     operation: "!=",
        //     value: "API",
        //   });
        //   query.filterAnd = filterAnd;
        // }

        if (!query.filterAnd) {
            const filterAnd: FilterEntry[] = [];
            query.filterAnd = filterAnd;
        }
        query.filterAnd.push({
            key: 'organizationType"."name',
            operation: 'IS NOT',
            value: null,
        });
        const newToOldFieldMap: Record<string, string> = {
            id: 'user"."id',
            name: 'user"."name',
            email: 'user"."email',
            companyRole: 'organizationType"."name',
            role: 'role"."name',
            companyId: 'organization"."id',
        };
        query = this.helperService.mapNewWhereClausetoOldWhereClause(
            query,
            newToOldFieldMap,
        );

        const resp = await this.usersRepository
            .createQueryBuilder('user')
            .leftJoin('user.organization', 'organization')
            .leftJoin('user.guardianRole', 'guardianRole')
            .leftJoin('organization.organizationType', 'organizationType')
            .leftJoin('guardianRole.role', 'role')
            .addSelect([
                'organization',
                'guardianRole',
                'role',
                'organizationType',
            ])
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .getMany();

        const oldFormatData = resp.map((user) =>
            this.mapNewQueryToOldQuery(user),
        );

        if (oldFormatData.length > 0) {
            const prepData = this.prepareUserDataForExport(oldFormatData);

            const headers: string[] = [];
            const titleKeys = Object.keys(prepData[0]);
            for (const key of titleKeys) {
                headers.push(this.userExportMap[key]);
            }

            const path = await this.dataExportService.generateCsv(
                prepData,
                headers,
                this.userExportMap['users'],
            );
            return path;
        }
        throw new HttpException(
            this.userExportMap['nothingToExport'],
            HttpStatus.BAD_REQUEST,
        );
    }

    private prepareUserDataForExport(users: any) {
        const exportData: DataExportUserDto[] = [];

        for (const user of users) {
            const dto = new DataExportUserDto();
            dto.id = user.id;
            dto.email = user.email;
            dto.role = user.role;
            dto.name = user.name;
            dto.phoneNo = user.phoneNo;
            dto.companyId = user.companyId;
            dto.companyName = user.company?.name;
            dto.companyRole = this.userExportMap[user?.company?.companyRole];
            dto.createdTime = this.helperService.formatTimestamp(
                user.createdTime,
            );
            exportData.push(dto);
        }

        return exportData;
    }

    public async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.helperService.validateRequestUser(requestUser);
        if (!query.filterAnd) {
            const filterAnd: FilterEntry[] = [];
            query.filterAnd = filterAnd;
        }
        query.filterAnd.push({
            key: 'organizationType"."name',
            operation: 'IS NOT',
            value: null,
        });

        query.filterAnd.push({
            key: 'is_api_user',
            operation: '=',
            value: false,
        });

        if (
            !(
                requestUser.organizationRole ==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            query.filterAnd.push({
                key: 'organization"."id',
                operation: '=',
                value: requestUser.organizationId,
            });
        }

        //Formatting Query
        const newToOldFieldMap: Record<string, string> = {
            id: 'user"."id',
            name: 'user"."name',
            email: 'user"."email',
            companyRole: 'organizationType"."name',
            role: 'role"."name',
            companyId: 'organization"."id',
        };
        query = this.helperService.mapNewWhereClausetoOldWhereClause(
            query,
            newToOldFieldMap,
        );

        const [entities, total] = await this.usersRepository
            .createQueryBuilder('user')
            .leftJoin('user.organization', 'organization')
            .leftJoin('user.guardianRole', 'guardianRole')
            .leftJoin('organization.organizationType', 'organizationType')
            .leftJoin('guardianRole.role', 'role')
            .addSelect([
                'organization',
                'guardianRole',
                'role',
                'organizationType',
            ])
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getManyAndCount();

        const oldFormatData = entities.map((user) =>
            this.mapNewQueryToOldQuery(user),
        );
        return new DataListResponseDto(
            entities ? oldFormatData : undefined,
            total ? total : undefined,
        );
    }

    public async getUserProfile(requestUser: JWTPayload) {
        this.helperService.validateRequestUser(requestUser);
        // const userProfile = await this.usersRepository.findOne({
        //     where: {
        //         id: requestUser.userId,
        //     },
        //     relations: {
        //         organization: {
        //             organizationType: true,
        //         },
        //         guardianRole: {
        //             role: true,
        //         },
        //     },
        // });
        const userProfile = await this.usersRepository
            .createQueryBuilder('users')
            .leftJoinAndSelect('users.organization', 'organization')
            .leftJoin('organization.projects', 'project')
            .leftJoinAndSelect('users.guardianRole', 'guardianRole')
            .leftJoinAndSelect('guardianRole.role', 'role')
            .leftJoinAndSelect(
                'organization.organizationType',
                'organizationType',
            )
            .where('users.id = :userId', { userId: requestUser.userId })
            .loadRelationCountAndMap(
                'organization.numberOfProjects',
                'organization.projects',
            )
            .getOne();
        // get credits
        const receiverSum = await this.dataSource
            .getRepository(CreditBlocksEntity)
            .createQueryBuilder('creditBlock')
            .leftJoin('creditBlock.receiver', 'receiver')
            .where('receiver.id = :organizationId', {
                organizationId: userProfile.organization.id,
            })
            .select('COALESCE(SUM(creditBlock.creditAmount), 0)', 'recvSum')
            .getRawOne();

        userProfile.organization['creditBalance'] = Number(receiverSum.recvSum);

        return {
            user: this.mapNewQueryToOldQuery(userProfile),
            Organisation: this.orgaisationService.mapNewQueryToOldQuery(
                userProfile?.organization,
            ),
        };
    }

    async resetPassword(
        passwordUpdateDto: PasswordUpdateDto,
        requestUser: JWTPayload,
    ) {
        this.helperService.validateRequestUser(requestUser);

        const userDetails = await this.usersRepository.findOneBy({
            email: requestUser.email,
        });
        const oldPwdVerified = verifyPassword(
            userDetails.password,
            passwordUpdateDto.oldPassword,
            this.configService.get<string>('security.pwdSecret'),
        );

        if (!userDetails || !oldPwdVerified) {
            throw new HttpException(
                'Entered old password is incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const encryptedPassword = encryptPayload(
            {
                password: passwordUpdateDto.newPassword,
            },
            this.configService.get<string>('security.pwdSecret'),
        );
        // const serverSalt = this.configService.get('security.salt');
        const guardianResponse = await this.guardianService.passwordChange({
            newPassword: passwordUpdateDto.newPassword,
            oldPassword: oldPwdVerified,
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

    async updateUserDetails(
        userUpdateDto: UserUpdateDto,
        requestUser: JWTPayload,
    ): Promise<HTTPResponseDto> {
        this.helperService.validateRequestUser(requestUser);

        const userDetails = await this.usersRepository.findOneBy({
            id: userUpdateDto.id,
        });

        if (!userDetails) {
            throw new HttpException(
                'No visible user found',
                HttpStatus.NOT_FOUND,
            );
        }

        const userVcDocument =
            await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.USER_GRID,
                userDetails.refId,
                requestUser.email,
            );

        const userData: UserSchemaDtos = new UserSchemaDtos(
            userVcDocument.document.credentialSubject[0],
        );

        if (
            userUpdateDto.name == userData?.name &&
            userUpdateDto.phoneNo == userData?.phoneNumber
        ) {
            const response: HTTPResponseDto = {
                statusCode: HttpStatus.OK,
                message: 'The user account has been updated successfully',
            };

            return response;
        }

        userData.name = userUpdateDto.name;
        userData.phoneNumber = userUpdateDto.phoneNo
            ? userUpdateDto.phoneNo
            : userData?.phoneNumber
              ? userData?.phoneNumber
              : undefined;

        const blockName = GUARDIAN_API.BLOCKS.CREATE_USER;

        if (userVcDocument.option.status !== GuardianStateEnum.REVOKED) {
            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.USER_REVOKE,
                ButtonActionEnum.SUBMIT,
                userVcDocument,
                requestUser.email,
            );
        }

        await this.guardianService.saveDocument(requestUser.email, blockName, {
            document: { ...userData },
            ref: null,
        });

        const result = await this.usersRepository
            .update(
                {
                    id: userUpdateDto.id,
                },
                {
                    name: userUpdateDto.name,
                    phoneNumber: userUpdateDto.phoneNo
                        ? userUpdateDto.phoneNo
                        : userDetails.phoneNumber,
                },
            )
            .catch((err: any) => {
                throw new HttpException(
                    'User update failed. Please try again',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            });

        if (result.affected > 0) {
            const response: HTTPResponseDto = {
                statusCode: HttpStatus.OK,
                message: 'The user account has been updated successfully',
            };

            return response;
        } else {
            throw new HttpException(
                'User update failed. Please try again',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async deleteUser(
        userId: number,
        requestUser: JWTPayload,
    ): Promise<HTTPResponseDto> {
        this.helperService.validateRequestUser(requestUser);
        const actionUserDetails = await this.usersRepository.findOne({
            where: { id: requestUser.userId },
            relations: {
                guardianRole: {
                    role: true,
                },
                organization: {
                    organizationType: true,
                },
            },
        });
        const userDetails = await this.usersRepository.findOne({
            where: { id: userId },
            relations: {
                guardianRole: {
                    role: true,
                },
                organization: {
                    organizationType: true,
                },
            },
        });

        if (!userDetails) {
            throw new HttpException(
                'No visible user found',
                HttpStatus.FORBIDDEN,
            );
        }

        if (userDetails?.guardianRole?.role?.name == RoleEnum.Root) {
            throw new HttpException(
                'Root user cannot be deleted',
                HttpStatus.FORBIDDEN,
            );
        } else if (userDetails?.guardianRole?.role?.name == RoleEnum.Admin) {
            const orgAdminCount = await this.usersRepository.countBy({
                organization: { id: userDetails?.organization?.id },
                guardianRole: {
                    role: {
                        name: RoleEnum.Admin,
                    },
                },
            });
            if (
                userDetails?.organization?.organizationType?.name !==
                    OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
                orgAdminCount <= 1
            ) {
                throw new HttpException(
                    'The user cannot be deleted as the user is the only admin',
                    HttpStatus.FORBIDDEN,
                );
            }
        }

        if (actionUserDetails.organization.id == userDetails.organization.id) {
            if (
                !(
                    actionUserDetails.guardianRole.role.name ==
                        RoleEnum.Admin ||
                    actionUserDetails.guardianRole.role.name == RoleEnum.Root
                )
            ) {
                throw new HttpException(
                    'This action is unauthorised',
                    HttpStatus.FORBIDDEN,
                );
            }
        } else {
            if (
                actionUserDetails.organization.organizationType.name !==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            ) {
                throw new HttpException(
                    'This action is unauthorised',
                    HttpStatus.FORBIDDEN,
                );
            } else {
                if (
                    actionUserDetails.guardianRole.role.name !== RoleEnum.Root
                ) {
                    throw new HttpException(
                        'This action is unauthorised',
                        HttpStatus.FORBIDDEN,
                    );
                }
            }
        }

        try {
            await this.guardianService.assignPolicyToUser(
                userDetails?.email,
                false,
            );

            const userVcDocument =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.USER_GRID,
                    userDetails.refId,
                    requestUser.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.USER_REVOKE,
                ButtonActionEnum.SUBMIT,
                userVcDocument,
                requestUser.email,
            );
        } catch (e) {
            throw new HttpException(
                'Delete failed. Please try again',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        const result = await this.usersRepository
            .update(
                {
                    id: userDetails.id,
                },
                {
                    isActive: false,
                },
            )
            .catch((_: any) => {
                throw new HttpException(
                    'Delete failed. Please try again',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            });

        if (result.affected > 0) {
            const response: HTTPResponseDto = {
                statusCode: HttpStatus.OK,
                message: 'The user has been deleted successfully',
            };

            return response;
        } else {
            throw new HttpException(
                'Delete failed. Please try again',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getAdminsByIds(ids: string[]): Promise<UsersEntity[]> {
        return this.usersRepository.find({
            where: {
                organization: { id: In(ids) },
            },
            relations: { organization: true },
        });
    }
    async getAdminsByType(
        organizationType: OrganizationTypeEnum,
    ): Promise<UsersEntity[]> {
        return this.usersRepository.find({
            where: {
                guardianRole: {
                    organizationType: {
                        name: organizationType,
                    },
                    role: {
                        name: RoleEnum.Admin,
                    },
                },
            },
            relations: {
                guardianRole: {
                    organizationType: true,
                    role: true,
                },
            },
        });
    }

    async releaseQueryRunner(queryRunner: QueryRunner) {
        if (!queryRunner.isReleased) {
            try {
                await queryRunner.release();
            } catch (e) {
                this.logger.error(
                    'Error occurred while releasing query runner',
                    e,
                );
            }
        }
    }
}
