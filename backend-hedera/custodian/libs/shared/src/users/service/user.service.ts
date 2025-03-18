/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';

import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>,
        @InjectRepository(GuardianRoleEntity)
        private readonly guardianRoleRepository: Repository<GuardianRoleEntity>,
        @InjectRepository(RoleEntity)
        private readonly roleRepository: Repository<RoleEntity>,
        @InjectRepository(OrganizationEntity)
        private readonly organizationRepository: Repository<OrganizationEntity>,
        @InjectRepository(OrganizationTypeEntity)
        private readonly organizationTypeRepository: Repository<OrganizationTypeEntity>,
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
        userDTO: UsersDTO,
        orgEntity: OrganizationEntity,
        guardRole: GuardianRoleEntity,
    ): Promise<boolean> {
        await this.usersRepository.update(
            {
                email: userDTO.email,
            },
            {
                updatedTime: new Date().getTime(),
                organization: orgEntity,
                guardianRole: guardRole,
            },
        );

        return true;
    }

    private async getGuardianRole(orgTypeId: number, userRole: string) {
        const orgType: OrganizationTypeEntity =
            await this.organizationTypeRepository.findOneBy({
                id: orgTypeId,
            });

        const role: RoleEntity = await this.roleRepository.findOneBy({
            name: userRole,
        });

        // get guardian role
        const guardRole: GuardianRoleEntity =
            await this.guardianRoleRepository.findOneBy({
                organizationType: orgType,
                role: role,
            });
        return guardRole;
    }

    private async findUser(email: string) {
        const user: UsersEntity = await this.usersRepository.findOne({
            where: {
                email: email,
            },
        });

        return user;
    }

    async checkForOrganizationDuplicates(
        email: string,
        taxId: string,
        paymentId: string,
    ) {
        const existingOrganization = await this.organizationRepository.findOne({
            where: [
                { email: email },
                { taxId: taxId },
                { paymentId: paymentId },
            ],
        });

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
        const user = await this.findUser(userDto.email);
        if (user) {
            await this.guardianService.login({
                username: userDto.email,
                password: decryptPayload(
                    user.password,
                    this.configService.get<string>('security.pwdSecret'),
                )?.password,
            });
        }
        return this.registerUserFlow(
            userDto,
            user?.stage || UserStageEnum.REGISTER,
            defaultPass,
            isUserActive,
            requestUser,
        );
    }

    public async registerUserFlow(
        userDto: UsersDTO,
        currentStage: UserStageEnum | string,
        defaultPass = '',
        isUserActive: boolean,
        requestUser?: JWTPayload,
    ): Promise<HTTPResponseDto> {
        this.utilService.setTagToIdMap();
        this.logger.log(
            `Received a request for email ${userDto.email} at stage ${currentStage}`,
            this.loggerContext,
        );

        while (!(currentStage == UserStageEnum.COMPLETED)) {
            try {
                switch (currentStage) {
                    case UserStageEnum.REGISTER: {
                        this.logger.log(
                            `Registration step ${UserStageEnum.REGISTER} started`,
                            this.loggerContext,
                        );
                        const existing = await this.startUserRegistration(
                            userDto,
                            defaultPass,
                            isUserActive,
                        );
                        await this.guardianService.login({
                            username: userDto.email,
                            password: decryptPayload(
                                existing.password,
                                this.configService.get<string>(
                                    'security.pwdSecret',
                                ),
                            )?.password,
                        });

                        await this.registerProcessSave(
                            userDto,
                            UserStageEnum.ASSIGN_REGISTRY,
                        );
                        this.logger.log(
                            `Registration step ${UserStageEnum.REGISTER} completed; 
                             next step: ${UserStageEnum.ASSIGN_REGISTRY}`,
                            this.loggerContext,
                        );
                        currentStage = existing.stage
                            ? existing.stage
                            : UserStageEnum.ASSIGN_REGISTRY;
                        break;
                    }
                    case UserStageEnum.ASSIGN_REGISTRY: {
                        this.logger.log(
                            `Registration step ${UserStageEnum.ASSIGN_REGISTRY} started`,
                            this.loggerContext,
                        );

                        // Check if Hedera account exists; if not, generate it
                        if (!userDto.hederaAccount && !userDto.hederaKey) {
                            const accGenTaskId =
                                await this.guardianService.generateHederaAccount(
                                    userDto.email,
                                );
                            const hederaAccResult =
                                await this.guardianService.fetchAsyncTaskResponse(
                                    accGenTaskId.taskId,
                                    userDto.email,
                                );

                            // If no immediate result, add task and return
                            if (!hederaAccResult) {
                                const asyncTask: TaskEntity =
                                    this.taskRepository.create({
                                        className: 'UserService',
                                        functionName:
                                            'updateGuardianUserConfig',
                                        args: [
                                            userDto,
                                            requestUser,
                                            isUserActive,
                                            accGenTaskId.taskId,
                                            undefined,
                                        ],
                                        retryAttemps: 2,
                                        state: TaskEnum.PENDING,
                                    });
                                await this.taskRepository.save(asyncTask);
                                return {
                                    statusCode: HttpStatus.OK,
                                    message: userDto.company
                                        ? 'Successfully added task to create organization with admin user'
                                        : 'Successfully added task to create the user',
                                };
                            } else {
                                const nextStage =
                                    await this.updateGuardianUserConfig(
                                        userDto,
                                        requestUser,
                                        isUserActive,
                                        undefined,
                                        hederaAccResult,
                                    );
                                if (
                                    nextStage === UserStageEnum.ASSIGN_REGISTRY
                                ) {
                                    return {
                                        statusCode: HttpStatus.OK,
                                        message: userDto.company
                                            ? 'Successfully added task to create organization with admin user'
                                            : 'Successfully added task to create the user',
                                    };
                                } else if (
                                    nextStage === UserStageEnum.ASSIGN_POLICY
                                ) {
                                    currentStage = UserStageEnum.ASSIGN_POLICY;
                                }
                            }
                        } else {
                            const nextStage =
                                await this.updateGuardianUserConfig(
                                    userDto,
                                    requestUser,
                                    isUserActive,
                                    undefined,
                                    undefined,
                                );
                            if (nextStage === UserStageEnum.ASSIGN_REGISTRY) {
                                return {
                                    statusCode: HttpStatus.OK,
                                    message: userDto.company
                                        ? 'Successfully added task to create organization with admin user'
                                        : 'Successfully added task to create the user',
                                };
                            } else if (
                                nextStage === UserStageEnum.ASSIGN_POLICY
                            ) {
                                currentStage = UserStageEnum.ASSIGN_POLICY;
                            }
                        }

                        this.logger.log(
                            `Registration step ${UserStageEnum.ASSIGN_REGISTRY} completed; 
                             next step: ${UserStageEnum.ASSIGN_POLICY}`,
                            this.loggerContext,
                        );
                        break;
                    }

                    case UserStageEnum.ASSIGN_POLICY: {
                        this.logger.log(
                            `Registration step ${UserStageEnum.ASSIGN_POLICY} started`,
                            this.loggerContext,
                        );
                        await this.guardianService.assignPolicyToUser(
                            userDto.email,
                            true,
                        );
                        await this.registerProcessSave(
                            userDto,
                            UserStageEnum.CREATE_GROUP_TYPE,
                        );
                        this.logger.log(
                            `Registration step ${UserStageEnum.ASSIGN_POLICY} completed;
                             next step: ${UserStageEnum.CREATE_GROUP_TYPE}`,
                            this.loggerContext,
                        );
                        currentStage = UserStageEnum.CREATE_GROUP_TYPE;
                        break;
                    }

                    case UserStageEnum.CREATE_GROUP_TYPE: {
                        this.logger.log(
                            `Registration step ${UserStageEnum.CREATE_GROUP_TYPE} started`,
                            this.loggerContext,
                        );
                        const existing = await this.findUser(userDto.email);
                        const decryptedPassword = decryptPayload(
                            existing.password,
                            this.configService.get<string>(
                                'security.pwdSecret',
                            ),
                        )?.password;

                        if (userDto.company) {
                            await this.checkForOrganizationDuplicates(
                                userDto.company.email,
                                userDto.company.taxId,
                                userDto.company.paymentId,
                            );
                            const groupTypeBlock =
                                await this.utilService.getBlocksByBlockName(
                                    GUARDIAN_API.BLOCKS.CREATE_GROUP_TYPE,
                                    this.configService.get('policy.id'),
                                );
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
                        await this.registerProcessSave(
                            userDto,
                            UserStageEnum.CREATE_GROUP,
                        );
                        this.logger.log(
                            `Registration step ${UserStageEnum.CREATE_GROUP_TYPE} completed; 
                            next step: ${UserStageEnum.CREATE_GROUP}`,
                            this.loggerContext,
                        );
                        currentStage = UserStageEnum.CREATE_GROUP;
                        break;
                    }

                    case UserStageEnum.CREATE_GROUP: {
                        this.logger.log(
                            `Registration step ${UserStageEnum.CREATE_GROUP} started`,
                            this.loggerContext,
                        );
                        if (userDto.company) {
                            if (
                                !userDto?.company?.hederaAccountId &&
                                !userDto?.company?.hederaAccountKey
                            ) {
                                const accGenTaskId =
                                    await this.guardianService.generateHederaAccount(
                                        userDto.email,
                                    );
                                const hederaAccResult =
                                    await this.guardianService.fetchAsyncTaskResponse(
                                        accGenTaskId.taskId,
                                        userDto.email,
                                    );

                                // If no immediate result, add task and return
                                if (!hederaAccResult) {
                                    const asyncTask: TaskEntity = {
                                        className: 'UserService',
                                        functionName: 'hederaOrgAccountStatus',
                                        args: [
                                            accGenTaskId.taskId,
                                            userDto,
                                            isUserActive,
                                            requestUser,
                                        ],
                                        retryAttemps: 2,
                                        state: TaskEnum.PENDING,
                                    };
                                    await this.taskRepository.save(asyncTask);
                                    return {
                                        statusCode: HttpStatus.OK,
                                        message: userDto.company
                                            ? 'Successfully added task to create organization with admin user'
                                            : 'Successfully added task to create the user',
                                    };
                                } else {
                                    await this.registerOrganizationInGuardian(
                                        userDto,
                                        isUserActive,
                                        hederaAccResult,
                                        false,
                                        requestUser,
                                    );
                                }
                            } else {
                                await this.registerOrganizationInGuardian(
                                    userDto,
                                    isUserActive,
                                    undefined,
                                    false,
                                    requestUser,
                                );
                            }
                        }
                        this.logger.log(
                            `Registration step ${UserStageEnum.CREATE_GROUP} completed; 
                             next step: ${UserStageEnum.CREATE_USER}`,
                            this.loggerContext,
                        );
                        currentStage = UserStageEnum.CREATE_USER;
                        break;
                    }

                    case UserStageEnum.CREATE_USER: {
                        this.logger.log(
                            `Registration step ${UserStageEnum.CREATE_USER} started`,
                            this.loggerContext,
                        );
                        if (userDto.company) {
                            await this.finalizeOrganizationUser(userDto);
                        } else {
                            await this.inviteNewUser(userDto, requestUser);
                        }
                        if (isUserActive) {
                            await this.registerProcessSave(
                                userDto,
                                UserStageEnum.APPROVE_USER,
                            );
                            this.logger.log(
                                `Registration step ${UserStageEnum.CREATE_USER} completed; 
                                 next step: ${UserStageEnum.APPROVE_USER}`,
                                this.loggerContext,
                            );
                            currentStage = UserStageEnum.APPROVE_USER;
                        } else {
                            await this.sendRegistrationEmails(userDto, false);
                            await this.registerProcessSave(
                                userDto,
                                UserStageEnum.COMPLETED,
                            );
                            this.logger.log(
                                `Registration step ${UserStageEnum.CREATE_USER} completed; 
                                 next step: ${UserStageEnum.COMPLETED}`,
                                this.loggerContext,
                            );
                            currentStage = UserStageEnum.COMPLETED;
                        }

                        break;
                    }

                    case UserStageEnum.APPROVE_USER: {
                        this.logger.log(
                            `Registration step ${UserStageEnum.APPROVE_USER} started`,
                            this.loggerContext,
                        );
                        if (userDto.company) {
                            const orgEntity =
                                await this.organizationRepository.findOne({
                                    where: { email: userDto.company.email },
                                });
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

                        await this.sendRegistrationEmails(userDto, true);
                        await this.registerProcessSave(
                            userDto,
                            UserStageEnum.COMPLETED,
                        );
                        this.logger.log(
                            `Registration step ${UserStageEnum.APPROVE_USER} completed; flow finished.`,
                            this.loggerContext,
                        );
                        currentStage = UserStageEnum.COMPLETED;
                        break;
                    }

                    default:
                        throw new Error(
                            `Unknown registration stage: ${currentStage}`,
                        );
                }
            } catch (error) {
                this.logger.error(
                    `Error at stage ${currentStage}: ${error.message}`,
                );
                throw new HttpException(
                    `Registration failed at stage ${currentStage}: ${error.message}`,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
        return {
            statusCode: HttpStatus.OK,
            message: userDto.company
                ? 'Successfully created organization with admin user'
                : 'Successfully created the user',
        };
    }

    private async startUserRegistration(
        userDto: UsersDTO,
        defaultPass = '',
        isUserActive: boolean,
    ): Promise<UsersEntity> {
        const existing = await this.findUser(userDto.email);

        // If user is already at COMPLETED stage, block re-registration
        if (existing && existing.stage === UserStageEnum.COMPLETED) {
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

        // If no local user record, register new user in Guardian
        if (!existing) {
            // Check duplicates before Guardian signup
            await this.checkForUserDuplicates(
                userDto.email,
                userDto.hederaAccount,
            );

            // Guardian registration
            await this.guardianService.registerUser(
                userDto.email,
                decryptedPassword,
            );

            // Save user locally
            const userEntity = new UsersEntity();
            userEntity.email = userDto.email;
            userEntity.name = userDto.name;
            userEntity.password = encryptedPassword;
            userEntity.phoneNumber = userDto.phoneNo;
            userEntity.hederaAccount = userDto.hederaAccount;
            userEntity.stage = UserStageEnum.REGISTER;
            userEntity.isActive = isUserActive;
            userEntity.createdTime = new Date().getTime();
            userEntity.updatedTime = new Date().getTime();

            return this.usersRepository.save(userEntity);
        }
        return existing;
    }

    private async hederaOrgAccountStatus(
        accGenTaskId: string,
        userDto: UsersDTO,
        isUserActive: boolean,
        requestUser: JWTPayload,
    ) {
        const hederaAccResult =
            await this.guardianService.fetchAsyncTaskResponse(
                accGenTaskId,
                userDto.email,
            );
        if (!hederaAccResult) {
            throw new HttpException(
                'Hedera Account Generation Failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        return await this.registerOrganizationInGuardian(
            userDto,
            isUserActive,
            hederaAccResult,
            true,
            requestUser,
        );
    }

    private async registerOrganizationInGuardian(
        userDto: UsersDTO,
        isUserActive: boolean,
        hederaAccResult?: any,
        isTask?: boolean,
        requestUser?: JWTPayload,
    ): Promise<void> {
        const orgCreateTime = new Date().getTime();
        // Create organization in Guardian
        const orgType = await this.organizationTypeRepository.findOne({
            where: { name: userDto?.company?.companyRole },
        });

        const orgEntity = new OrganizationEntity();
        orgEntity.name = userDto.company.name;
        orgEntity.organizationType = orgType;
        orgEntity.email = userDto?.company?.email;
        orgEntity.taxId = userDto?.company?.taxId;
        orgEntity.state = OrganizationStateEnum.PENDING;
        orgEntity.hederaAccountId =
            userDto?.company?.hederaAccountId || hederaAccResult?.id;
        orgEntity.hederaAccountKey =
            userDto?.company?.hederaAccountKey || hederaAccResult?.key;
        orgEntity.phoneNumber = userDto?.company?.phoneNo;
        orgEntity.paymentId = userDto?.company?.paymentId;
        orgEntity.faxNumber = userDto?.company?.faxNo;
        orgEntity.provinces = userDto?.company?.provinces;
        orgEntity.website = userDto?.company?.website;
        orgEntity.address = userDto?.company?.address;
        orgEntity.createdTime = orgCreateTime;
        orgEntity.updatedTime = new Date().getTime();

        // iii. Save organization
        const savedOrg = await this.organizationRepository.save(orgEntity);
        if (
            userDto?.company?.logo &&
            this.helperService.isBase64(userDto.company.logo)
        ) {
            const response: any = await this.fileHandler.uploadFile(
                `profile_images/${savedOrg.refId}_${new Date().getTime()}.png`,
                userDto.company.logo,
            );
            if (response) {
                userDto.company.logo = response;
            } else {
                throw new HttpException(
                    'Error while uploading company logo',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }

        const blockName = orgType.multiple
            ? GUARDIAN_API.BLOCKS.CREATE_MULTIPLE_ORGANIZATION
            : GUARDIAN_API.BLOCKS.CREATE_SINGLE_ORGANIZATION;
        const createOrganizationResponse =
            await this.guardianService.saveDocument(userDto.email, blockName, {
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
                    createdTime: Number(orgCreateTime),
                    updatedTime: Number(new Date().getTime()),
                    refId: savedOrg.refId,
                },
                ref: null,
            });

        // const payload = await this.guardianService.createPayload(
        // createOrganizationResponse,
        // userDto.company.companyRole,
        // );
        await this.organizationRepository.update(
            { id: savedOrg.id },
            {
                state: orgType.multiple
                    ? OrganizationStateEnum.PENDING
                    : OrganizationStateEnum.ACTIVE,
                group: createOrganizationResponse.group,
                logo: userDto.company.logo,
                updatedTime: new Date().getTime(),
            },
        );

        if (isTask) {
            const user = await this.findUser(userDto.email);
            if (user.stage == UserStageEnum.CREATE_GROUP) {
                this.logger.log(
                    `Registration step ${UserStageEnum.CREATE_GROUP} completed; 
                     next step: ${UserStageEnum.CREATE_USER}`,
                    this.loggerContext,
                );
                await this.registerProcessSave(
                    userDto,
                    UserStageEnum.CREATE_USER,
                );
            }
            await this.register(userDto, '', isUserActive, requestUser);
        }
    }

    private async finalizeOrganizationUser(userDto: UsersDTO): Promise<void> {
        const user = await this.findUser(userDto.email);
        const orgEntity = await this.organizationRepository.findOne({
            where: { email: userDto.company.email },
        });

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
                },
                ref: null,
            },
        );

        const orgType = await this.organizationTypeRepository.findOne({
            where: {
                name: userDto?.company?.companyRole,
            },
        });

        const guardianRole = await this.getGuardianRole(
            orgType.id,
            userDto.role,
        );

        await this.updateUser(userDto, orgEntity, guardianRole);
    }

    private async sendRegistrationEmails(
        userDto: UsersDTO,
        isUserActive: boolean = UserStateConstant.DEACTIVE,
    ): Promise<void> {
        const countryName = this.configService.get('country');
        const user = await this.findUser(userDto.email);
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
        };
        await this.mailService.sendMail(mailDTOUser);
    }

    async updateGuardianUserConfig(
        userDto: UsersDTO,
        requestUser: JWTPayload,
        isUserActive: boolean,
        accGenTaskId?: string,
        hederaAccResult?: any,
    ): Promise<UserStageEnum> {
        if (!hederaAccResult && !(userDto.hederaAccount || userDto.hederaKey)) {
            hederaAccResult = await this.guardianService.fetchAsyncTaskResponse(
                accGenTaskId,
                userDto.email,
            );
            if (!hederaAccResult) {
                throw new HttpException(
                    'Hedera Account Generation Failed',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }

        await this.usersRepository.update(
            { email: userDto.email },
            {
                hederaAccount: userDto.hederaAccount
                    ? userDto.hederaAccount
                    : hederaAccResult?.id,
            },
        );

        // Update user profile with the parent (SRU)
        const updateTaskId = await this.guardianService.updateUserProfile(
            userDto.email,
            this.configService.get('sru.did'),
            userDto.hederaAccount ? userDto.hederaAccount : hederaAccResult?.id,
            userDto.hederaKey ? userDto.hederaKey : hederaAccResult?.key,
        );

        const isAccountUpdated =
            await this.guardianService.fetchAsyncTaskResponse(
                updateTaskId.taskId,
                userDto.email,
            );
        if (!isAccountUpdated) {
            const asyncTask: TaskEntity = this.taskRepository.create({
                className: 'UserService',
                functionName: 'checkGuardianUserUpdate',
                args: [userDto, isUserActive, requestUser, updateTaskId.taskId],
                retryAttemps: 3,
                state: TaskEnum.PENDING,
            });
            await this.taskRepository.save(asyncTask);
            return UserStageEnum.ASSIGN_REGISTRY;
        }
        this.logger.log(
            `Registration step ${UserStageEnum.ASSIGN_REGISTRY} completed; 
             next step: ${UserStageEnum.ASSIGN_POLICY}`,
            this.loggerContext,
        );
        await this.registerProcessSave(userDto, UserStageEnum.ASSIGN_POLICY);
        return UserStageEnum.ASSIGN_POLICY;
    }

    async checkGuardianUserUpdate(
        userDto: UsersDTO,
        isUserActive: boolean,
        requestUser: JWTPayload,
        taskId: string,
    ) {
        const isAccountUpdated =
            await this.guardianService.fetchAsyncTaskResponse(
                taskId,
                userDto.email,
            );
        if (!isAccountUpdated) {
            throw new HttpException(
                'Update Guardian User Config Failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        // Check before executing task if user already Completed
        const user = await this.findUser(userDto.email);
        if (user.stage == UserStageEnum.ASSIGN_REGISTRY) {
            this.logger.log(
                `Registration step ${UserStageEnum.ASSIGN_REGISTRY} completed; 
                 next step: ${UserStageEnum.ASSIGN_POLICY}`,
                this.loggerContext,
            );
            await this.registerProcessSave(
                userDto,
                UserStageEnum.ASSIGN_POLICY,
            );
        }
        await this.register(userDto, '', isUserActive, requestUser);
    }

    private async inviteNewUser(
        userDto: UsersDTO,
        reqUser?: JWTPayload,
    ): Promise<boolean> {
        try {
            // 1. Generate an invite for the given role
            const user = await this.findUser(userDto.email);

            const org: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: {
                        id: reqUser?.organizationId,
                    },
                    relations: {
                        organizationType: true,
                    },
                });
            const guardianRole = await this.getGuardianRole(
                org?.organizationType?.id,
                userDto.role,
            );
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
                    },
                    ref: null,
                },
            );

            await this.updateUser(userDto, org, guardianRole);

            return true;
        } catch (e) {
            throw new HttpException(
                'Error occurred while adding the user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async registerProcessSave(
        userDto: UsersDTO,
        status: UserStageEnum,
    ): Promise<void> {
        await this.usersRepository.update(
            { email: userDto.email },
            {
                updatedTime: new Date().getTime(),
                stage: status,
            },
        );
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
        const userProfile = await this.usersRepository.findOne({
            where: {
                id: requestUser.userId,
            },
            relations: {
                organization: {
                    organizationType: true,
                },
                guardianRole: {
                    role: true,
                },
            },
        });
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
}
