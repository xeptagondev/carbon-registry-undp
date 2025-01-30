import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';

import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SuperService } from '@app/core/service/super.service';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { RoleEntity } from '@app/shared/role/entity/role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { TransactionService } from '@app/shared/transaction/service/transaction.service';
import { TransactionStage } from '@app/shared/transaction/enum/transaction.stage.enum';
import { TransactionType } from '@app/shared/transaction/enum/transaction.type.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganisationDto } from '@app/shared/organization/dto/organisation.dto';
import { PolicyBlocksEntity } from '@app/shared/policy-block/entity/policy-blocks.entity';
import { generatePassword, hashPassword } from '@app/shared/util/util';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import { USER_REGISTER_HEADER } from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { MailService } from '@app/shared/mail/service/mail.service';

@Injectable()
export class UserService extends SuperService<UsersEntity, UsersDTO> {
    private readonly logger = new Logger(UserService.name);
    constructor(
        protected readonly guardianService: GuardianService,
        protected readonly transactionService: TransactionService,
        protected readonly auditService: AuditService,
        protected readonly configService: ConfigService,
        private readonly mailService: MailService,
        @InjectRepository(UsersEntity)
        protected readonly usersRepository: Repository<UsersEntity>,
        @InjectRepository(PolicyBlocksEntity)
        protected readonly policyBlocksRepository: Repository<PolicyBlocksEntity>,
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
        const policyBlocks = await this.getBlocksByPolicy(
            this.configService.get('policy.id'),
        );
        policyBlocks.forEach((block) => {
            this.tagToIdMap[block.blockName] = block.blockId;
        });
    }

    async register(userDto: UsersDTO, defaultPass: string = '') {
        try {
            this.logger.log(
                `Request received to register user with email ${userDto.email}`,
            );
            await this.setTagToIdMap();
            // 1: Login SRU and Gov. Root
            if (
                !this.guardianService.getRefreshToken(
                    this.configService.get('sru.username'),
                )
            ) {
                const sruLoginResponse = await this.guardianService.login({
                    username: this.configService.get('sru.username'),
                    password: this.configService.get('sru.password'),
                });
            }

            // 1.1 Generate random password for user
            const passwordLen = 8;
            let userPass: string;
            if (defaultPass === '') {
                userPass = generatePassword(passwordLen);
            } else {
                userPass = defaultPass;
            }
            const serverSalt = this.configService.get('security.salt');
            const guardianPass = userPass + serverSalt;
            const hashedPass = hashPassword(userPass);

            // 2: Register the new user as a 'USER' in guardian backend
            try {
                await this.guardianService.registerUser(
                    userDto.email,
                    guardianPass,
                );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.USER_REGISTER,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                throw e;
            }

            const userEntity: UsersEntity = {
                email: userDto.email,
                name: userDto.name,
                password: hashedPass,
                phoneNumber: userDto.phoneNumber,
            };

            // i. Save user in db without organization and role
            const user: UsersEntity =
                await this.usersRepository.save(userEntity);

            // 3. User login to the guardian backend
            const userLoginResponse = await this.guardianService.login({
                username: userDto.email,
                password: guardianPass,
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
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.ASSIGN_REGISTRY,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }

            await this.delay(15000);

            // 5. Assign the policy for the user
            try {
                const refreshToken = await this.guardianService.getRefreshToken(
                    this.configService.get('sru.username'),
                );
                await this.guardianService.assignPolicyToUser(
                    userDto.email,
                    refreshToken,
                );
                await this.transactionService.save({
                    user: userDto?.request?.email,
                    stage: TransactionStage.ASSIGN_POLICY,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }
            console.log('$$$$$$$$$$$$$$$$$');
            let res;
            if (userDto.company) {
                // 6. Register new organization
                res = await this.registerGroup(userDto, userLoginResponse);
            } else {
                // 6. Accept an invitation (generate an invitation and create the user)
                res = await this.inviteNewUser(userDto, userLoginResponse);
            }

            // 7. Send password creation email to user
            const countryName = this.configService.get('country');
            const mailDTO: MailTemplateDTO = {
                subject: USER_REGISTER_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
                template: MailTemplateEnum.PASSWORD_CREATE,
                to: userDto.email,
                context: {
                    name: userDto.name,
                    countryName: countryName,
                    home: this.configService.get('url'),
                    email: userDto.email,
                    tempPassword: userPass,
                },
            };
            await this.mailService.sendMail(mailDTO);

            return res;
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
                const refreshToken = await this.guardianService.getRefreshToken(
                    userDto?.request?.email,
                );
                inviteResponse = await this.guardianService.createInvitation(
                    refreshToken,
                    this.getBlock(
                        this.configService.get('blocks.userCreateInvite'),
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
                            this.configService.get('blocks.createGroupType'),
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
                    this.getBlock(this.configService.get('blocks.createUser')),
                    {
                        document: {
                            name: userDto.name,
                            organization: {
                                name: org.name,
                                role: org.organizationType.name,
                            },
                            role: userDto.role,
                        },
                        ref: null,
                    },
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
                        this.configService.get('blocks.appoveOrganization'),
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

    private async registerGroup(userDto: UsersDTO, userLoginResponse) {
        try {
            // 1. Create a new group type in guardian
            try {
                const createGroupTypeResponse =
                    await this.guardianService.createGroupType(
                        userLoginResponse.refreshToken,
                        this.getBlock(
                            this.configService.get('blocks.createGroupType'),
                        ),
                        {
                            group: userDto.company.companyRole,
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
            const orgType = await this.organizationTypeRepository.findOne({
                where: {
                    name: userDto?.company?.companyRole,
                },
            });
            let createOrganizationResponse = { group: '' };
            try {
                const blockName = orgType.multiple
                    ? `blocks.createMultipleOrganization`
                    : `blocks.createSingleOrganization`;
                createOrganizationResponse =
                    await this.guardianService.createOrganization(
                        userLoginResponse.refreshToken,
                        this.getBlock(this.configService.get(blockName)),
                        {
                            document: {
                                name: userDto.company.name,
                                role: userDto.company.companyRole,
                            },
                            ref: null,
                        },
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

            try {
                const createUserResponse =
                    await this.guardianService.createUser(
                        userLoginResponse.refreshToken,
                        this.getBlock(
                            this.configService.get('blocks.createUser'),
                        ),
                        {
                            document: {
                                name: userDto.name,
                                organization: {
                                    name: userDto.company.name,
                                    role: userDto.company.companyRole,
                                },
                                role: userDto.role,
                            },
                            ref: null,
                        },
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
                createOrganizationResponse,
                userDto.company.companyRole,
            );

            // // 4. Send request for approval
            await this.organizationRepository.update(
                {
                    id: orgEntity.id,
                },
                { payload: payload, group: createOrganizationResponse?.group },
            );
            if (userDto?.request?.userRole === RoleEnum.Root) {
                const refreshToken = await this.guardianService.getRefreshToken(
                    userDto?.request?.email,
                );
                await this.approve(userDto?.request?.email, orgEntity.id, {
                    refreshToken: refreshToken,
                    remarks: '',
                });
            }

            const guardianRole = await this.getGuardianRole(
                orgType?.id,
                userDto.role,
            );
            await this.updateUser(userDto, orgEntity, guardianRole);

            return createOrganizationResponse;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    async init() {
        if (this.configService.get('system.initPolicy')) {
            await this.fetchPolicyBlocks();
        }
        if (this.configService.get('system.initOrgs')) {
            await this.createInitialOrganizations();
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
                    const orgDto = new OrganisationDto();
                    orgDto.companyRole =
                        OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY;
                    orgDto.name = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.orgName`,
                    );
                    const user = new UsersDTO();
                    user.email = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.email`,
                    );
                    user.name = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.name`,
                    );
                    user.hederaAccount = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.hederaAccount`,
                    );
                    user.hederaKey = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.hederaKey`,
                    );
                    user.password = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.password`,
                    );
                    user.role = RoleEnum.Root;
                    user.company = orgDto;

                    await this.register(user, user.password);
                }
            }
        } catch (e) {
            this.logger.error(
                'Error occurred while creating inital organizations',
            );
            throw e;
        }
    }

    async fetchPolicyBlocks() {
        const policy = await this.loadPolicyJson();
        this.tagToIdMap = this.mapTagsToIds(policy);
        await this.saveTagIdMap();
    }

    private async loadPolicyJson() {
        try {
            const sruLoginResponse = await this.guardianService.login({
                username: this.configService.get('sru.username'),
                password: this.configService.get('sru.password'),
            });

            const refreshToken = await this.guardianService.getRefreshToken(
                this.configService.get('sru.username'),
            );
            const response = await axios.get(
                `${this.configService.get('guardian.url')}${this.configService.get(
                    'guardian.policies',
                )}${this.configService.get('policy.id')}`,
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (e) {
            throw new Error('Failed to fetch the policy');
        }
    }
    mapTagsToIds(policy) {
        const result = {};
        function traverse(block) {
            if (block.tag && block.id) {
                result[block.tag] = block.id;
            }

            if (Array.isArray(block.children)) {
                for (const child of block.children) {
                    traverse(child);
                }
            }
        }

        if (policy && policy.config) {
            traverse(policy.config);
        }

        return result;
    }

    async saveTagIdMap() {
        if (!this.tagToIdMap || Object.keys(this.tagToIdMap).length === 0) {
            return;
        }
        try {
            const tagIdMap = this.tagToIdMap;

            const policyBlocks = Object.entries(tagIdMap).map(
                ([blockName, blockId]) => ({
                    blockName,
                    blockId,
                    policyId: this.configService.get<string>('policy.id'),
                }),
            );

            const existingBlocks = await this.policyBlocksRepository.find({
                where: { blockId: In(Object.values(tagIdMap)) },
            });

            const existingBlockIds = existingBlocks.map(
                (block) => block.blockId,
            );

            const newPolicyBlocks = policyBlocks.filter(
                (block) => !existingBlockIds.includes(block.blockId),
            );

            if (newPolicyBlocks.length === 0) {
                return;
            }

            await this.policyBlocksRepository.save(newPolicyBlocks);
        } catch (error) {
            throw new Error('Failed to save tagIdMap to PolicyBlocksEntity');
        }
    }

    public async getBlocksByPolicy(
        policyId: string,
    ): Promise<PolicyBlocksEntity[]> {
        try {
            const blocks = await this.policyBlocksRepository.find({
                where: { policyId: policyId },
            });
            return blocks;
        } catch (error) {
            throw new Error('Failed to execute getBlocksByPolicy');
        }
    }

    public async getBlocksByBlockName(
        blockName: string,
        policyId: string,
    ): Promise<PolicyBlocksEntity[]> {
        try {
            const blocks = await this.policyBlocksRepository.find({
                where: { policyId: policyId, blockName: blockName },
            });
            return blocks;
        } catch (error) {
            throw new Error('Failed to execute getBlocksByBlockName');
        }
    }
}
