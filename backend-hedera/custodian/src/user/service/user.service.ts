import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { SuperService } from '@app/core/service/super.service';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { UtilService } from '@app/shared/util/service/util.service';
import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { RoleEntity } from '@app/shared/role/entity/role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { LogLevel } from '@app/shared/audit/enum/log-level.enum';
import { AuditDTO } from '@app/shared/audit/dto/audit.dto';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { TransactionService } from '@app/shared/transaction/service/transaction.service';
import { TransactionStage } from '@app/shared/transaction/enum/transaction.stage.enum';
import { TransactionType } from '@app/shared/transaction/enum/transaction.type.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';

@Injectable()
export class UserService extends SuperService<UsersEntity, UsersDTO> {
    private readonly logger = new Logger(UserService.name);
    constructor(
        protected readonly guardianService: GuardianService,
        protected readonly transactionService: TransactionService,
        protected readonly auditService: AuditService,
        protected readonly utilService: UtilService,
        protected readonly configService: ConfigService,
        @InjectRepository(UsersEntity)
        protected readonly usersRepository: Repository<UsersEntity>,
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

    private tagToIdMap: Record<string, string> = {};
    private refreshTokens: Record<string, string> = {};

    setRefreshToken(username: string, refreshToken: string) {
        this.refreshTokens[username] = refreshToken;
    }

    getRefreshToken(username: string) {
        return this.refreshTokens[username];
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
            { organization: orgEntity, guardianRole: guardRole },
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

    async login(loginDto: LoginDto) {
        try {
            this.logger.log(
                `Request received to login user with username ${loginDto.username}`,
            );
            const response = await axios.post(
                `${this.configService.get('guardian.url')}${this.configService.get(
                    'guardian.login',
                )}`,
                loginDto,
            );

            if (response?.status === 200) {
                const message: string = `User: ${loginDto.username} has logged into the system.`;
                const auditLog: AuditDTO = {
                    logLevel: LogLevel.INFO,
                    data: { message: message },
                    createdTime: Date.now(),
                };
                try {
                    await this.auditService.save(auditLog);

                    this.setRefreshToken(
                        loginDto.username,
                        response?.data?.refreshToken,
                    );
                    return response.data;
                } catch (error) {
                    console.error(`Failed to add log: "${message}"`, error);
                }
            } else {
                throw new HttpException(
                    'Guardian User Login Failed',
                    HttpStatus.UNAUTHORIZED,
                );
            }
        } catch (error) {
            throw new HttpException(
                'Guardian User Login Failed',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    async accessToken(refreshToken: string) {
        const accessTokenResponse = await axios.post(
            `${this.configService.get('guardian.url')}${this.configService.get(
                'guardian.accessToken',
            )}`,
            {
                refreshToken: refreshToken,
            },
        );
        return accessTokenResponse.data.accessToken;
    }

    async delay(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    private async setTagToIdMap() {
        this.tagToIdMap = {};
        const policyBlocks = await this.utilService.getBlocksByPolicy(
            this.configService.get('policy.id'),
        );
        policyBlocks.forEach((block) => {
            this.tagToIdMap[block.blockName] = block.blockId;
        });
    }

    async register(userDto: UsersDTO) {
        try {
            this.logger.log(
                `Request received to register user with email ${userDto.email}`,
            );
            await this.setTagToIdMap();
            // 1: Login SRU and Gov. Root
            const sruLoginResponse = await this.login({
                username: this.configService.get('sru.username'),
                password: this.configService.get('sru.password'),
            });

            // 2: Register the new user as a 'USER' in guardian backend
            try {
                await this.guardianService.registerUser(
                    userDto.email,
                    userDto.password,
                );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.USER_REGISTER,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }

            const userEntity: UsersEntity = {
                email: userDto.email,
                name: userDto.name,
                password: userDto.password,
                phoneNumber: userDto.phoneNumber,
            };

            // i. Save user in db without organization and role
            const user: UsersEntity =
                await this.usersRepository.save(userEntity);

            // 3. User login to the guardian backend
            const userLoginResponse = await this.login({
                username: userDto.email,
                password: userDto.password,
            });
            await this.delay(5000);
            // 4. Update the user profile with the parent (SRU)
            try {
                await this.guardianService.updateUserProfile(
                    userDto.email,
                    userLoginResponse.refreshToken,
                    this.configService.get('sru.did'),
                    userDto.hederaAccount,
                    userDto.hederaKey,
                );
            } catch (e) {
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.ASSIGN_REGISTRY,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            }

            await this.delay(10000);

            // 5. Assign the policy for the user
            try {
                await this.guardianService.assignPolicyToUser(
                    userDto.email,
                    sruLoginResponse.refreshToken,
                );
            } catch (e) {
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.ASSIGN_POLICY,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            }

            if (userDto.company) {
                // 6. Register new organization
                return await this.registerGroup(userDto, userLoginResponse);
            } else {
                // 6. Accept an invitation (generate an invitation and create the user)
                return await this.inviteNewUser(userDto, userLoginResponse);
            }
        } catch (error) {
            console.error('Error occurred:', error);
            throw error;
        }
    }

    private getBlock(blokName: string) {
        return this.tagToIdMap[blokName];
    }
    private async inviteNewUser(userDto: UsersDTO, userLoginResponse) {
        try {
            // 1. Generate an invite for the given role
            const org: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: {
                        id: userDto.request.organizationId,
                    },
                    relations: {
                        organizationType: true,
                    },
                });
            const guardianRole = await this.getGuardianRole(
                org?.organizationType?.id,
                userDto.role,
            );
            let inviteResponse = { invitation: '' };
            try {
                inviteResponse = await this.guardianService.createInvitation(
                    this.getRefreshToken(userDto?.request?.email),
                    this.getBlock(
                        this.configService.get('blocks.user_create_invite'),
                    ),
                    {
                        action: 'invite',
                        group: org.group,
                        role: guardianRole.name,
                    },
                );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.CREATE_INVITATION,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }

            // 2. Submit the generated invitation for user creation

            try {
                const createGroupTypeResponse =
                    await this.guardianService.createGroupType(
                        userLoginResponse.refreshToken,
                        this.getBlock(
                            this.configService.get('blocks.create_group_type'),
                        ),
                        {
                            invitation: inviteResponse.invitation,
                        },
                    );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.CREATE_GROUP_TYPE,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }

            // 3. Create the user with the role
            let createUserResponse = { group: '' };
            try {
                createUserResponse = await this.guardianService.createUser(
                    userLoginResponse.refreshToken,
                    this.getBlock(this.configService.get('blocks.create_user')),
                    userDto.name,
                    org.name,
                    this.capitalizeFirst(
                        this.capitalizeFirst(org.organizationType.name),
                    ),
                    this.capitalizeFirst(userDto.role),
                );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.CREATE_USER_BLOCK,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }

            await this.updateUser(userDto, org, guardianRole);

            return createUserResponse;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    async approve(
        email: string,
        id: number,
        organizationApproveDto: OrganisationApproveDto,
    ) {
        try {
            await this.setTagToIdMap();
            const orgEntity: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: {
                        id: id,
                    },
                    relations: {
                        organizationType: true,
                    },
                });
            let approveResponse = {};
            try {
                approveResponse = await this.guardianService.approve(
                    organizationApproveDto.refreshToken,
                    this.getBlock(
                        this.configService.get('blocks.appove_organization'),
                    ),
                    orgEntity.payload,
                );
                await this.transactionService.save({
                    user: email,
                    stage: TransactionStage.APPROVE_ORGANIZATION,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }

            await this.organizationRepository.update(
                {
                    id: orgEntity.id,
                },
                { state: OrganizationStateEnum.ACTIVE },
            );
            return approveResponse;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    capitalizeFirst(input: string): string {
        if (!input) {
            return input;
        }
        return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }

    private async registerGroup(userDto: UsersDTO, userLoginResponse) {
        try {
            // 1. Create a new group type in guardian
            try {
                const createGroupTypeResponse =
                    await this.guardianService.createGroupType(
                        userLoginResponse.refreshToken,
                        this.getBlock(
                            this.configService.get('blocks.create_group_type'),
                        ),
                        {
                            group: this.capitalizeFirst(
                                userDto.company.companyRole,
                            ),
                            label: userDto.company.name,
                        },
                    );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.CREATE_GROUP_TYPE,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }
            await this.delay(5000);
            try {
                const createOrganizationResponse =
                    await this.guardianService.createOrganization(
                        userLoginResponse.refreshToken,
                        this.getBlock(
                            this.configService.get(
                                'blocks.create_multiple_organization',
                            ),
                        ),
                        userDto.company.name,
                        this.capitalizeFirst(userDto.company.companyRole),
                    );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.CREATE_ORGANIZATION_BLOCK,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }

            // I. Save organization in DB
            // i. Get orgType
            const orgType = await this.organizationTypeRepository.findOneBy({
                name: userDto.company.companyRole,
            });

            // ii. Create organization
            let orgEntity: OrganizationEntity = {
                name: userDto.company.name,
                organizationType: orgType,
                state: OrganizationStateEnum.PENDING,
            };

            // iii. Save organization
            orgEntity = await this.organizationRepository.save(orgEntity);

            // 2. Create a group (organization) => Create the organization of org type

            await this.delay(10000);
            let createUserResponse = { group: '' };
            try {
                createUserResponse = await this.guardianService.createUser(
                    userLoginResponse.refreshToken,
                    this.getBlock(this.configService.get('create_user')),
                    userDto.name,
                    userDto.company.name,
                    this.capitalizeFirst(userDto.company.companyRole),
                    this.capitalizeFirst(userDto.role),
                );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.CREATE_USER_BLOCK,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }
            // // 3. Create the required payload for group (organization) save
            const payload = await this.guardianService.createPayload(
                createUserResponse,
                this.capitalizeFirst(userDto.company.companyRole),
            );

            // // 4. Send request for approval
            await this.organizationRepository.update(
                {
                    id: orgEntity.id,
                },
                { payload: payload, group: createUserResponse?.group },
            );
            if (userDto?.request?.userRole === RoleEnum.Root) {
                await this.approve(userDto?.request?.email, orgEntity.id, {
                    refreshToken: this.getRefreshToken(userDto?.request?.email),
                    remarks: '',
                });
            }

            const guardianRole = await this.getGuardianRole(
                orgType?.id,
                userDto.role,
            );
            await this.updateUser(userDto, orgEntity, guardianRole);

            return createUserResponse;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }
}
