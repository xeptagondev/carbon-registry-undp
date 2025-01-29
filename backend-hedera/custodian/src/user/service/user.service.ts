import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';
import { v4 as uuidv4 } from 'uuid';
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

@Injectable()
export class UserService extends SuperService<UsersEntity, UsersDTO> {
    private readonly logger = new Logger(UserService.name);
    constructor(
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

    generateMessageId(): string {
        const seconds = Math.floor(Date.now() / 1000);
        const nanoseconds = process.hrtime()[1];
        return `${seconds}.${nanoseconds}`;
    }

    generateMessageHash(data: any): string {
        const jsonString = JSON.stringify(data);
        return crypto.createHash('sha256').update(jsonString).digest('hex');
    }

    generateUUID24(): string {
        return uuidv4().replace(/-/g, '').substring(0, 24);
    }

    async createPayload(response: any, role: string) {
        return JSON.stringify({
            document: {
                createDate: new Date().toISOString(),
                updateDate: new Date().toISOString(),
                owner: response.owner,
                hash: response.hash,
                document: response.document,
                documentFileId: await this.generateUUID24(),
                documentFields: [
                    'id',
                    'credentialSubject.id',
                    'credentialSubject.0.id',
                    'credentialSubject.0.name',
                    'credentialSubject.0.type',
                ],
                hederaStatus: 'ISSUE',
                signature: 0,
                type: this.configService.get(`metadata.approve.type.${role}`),
                policyId: response.policyId,
                tag: this.configService.get(`metadata.approve.tag.${role}`),
                option: {
                    status: 'pending',
                },
                schema: response.schema,
                messageId: this.generateMessageId(),
                topicId: this.configService.get('policy.topicId'),
                relationships: response.relationships,
                accounts: response.accounts,
                group: response.group,
                messageHash: this.generateMessageHash(response.document),
                _id: await this.generateUUID24(),
                __sourceTag__: this.configService.get(
                    `metadata.approve.sourceTag.${role}`,
                ),
                id: await this.generateUUID24(),
            },
            tag: 'Button_0',
        });
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
                const registerResponse = await axios.post(
                    `${this.configService.get('guardian.url')}${this.configService.get('guardian.register')}`,
                    {
                        username: userDto.email,
                        password: userDto.password, // This needs to be a password with SALT from API side
                        password_confirmation: userDto.password,
                        role: 'USER',
                    },
                );
            } catch (e) {
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
            const updateResponse = await axios.put(
                `${this.configService.get('guardian.url')}${this.configService.get('guardian.profileUpdate')}/${userDto.email}`,
                {
                    parent: this.configService.get('sru.did'),
                    hederaAccountId: userDto.hederaAccount,
                    hederaAccountKey: userDto.hederaKey,
                    useFireblocksSigning: false,
                    fireblocksConfig: {
                        fireBlocksVaultId: '',
                        fireBlocksAssetId: '',
                        fireBlocksApiKey: '',
                        fireBlocksPrivateiKey: '',
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(
                            userLoginResponse.refreshToken,
                        )}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            await this.delay(10000);

            // 5. Assign the policy for the user
            const policyAssignResponse = await axios.post(
                `${this.configService.get('guardian.url')}${this.configService.get('guardian.policyAsign1')}/${userDto.email}${this.configService.get('guardian.policyAsign2')}`,
                {
                    policyIds: [this.configService.get('policy.id')],
                    assign: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(sruLoginResponse.refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

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

            const inviteResponse = await axios.post(
                `${this.configService.get('guardian.url')}/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.getBlock(this.configService.get(`blocks.invite.${org.organizationType.name}`))}`,
                {
                    action: 'invite',
                    group: org.group,
                    role: guardianRole.name,
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(this.getRefreshToken(userDto?.request?.email))}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            // 2. Submit the generated invitation for user creation
            const createGroupTypeResponse = await axios.post(
                `${this.configService.get('guardian.url')}/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.getBlock(this.configService.get('blocks.group.group'))}`,
                {
                    invitation: inviteResponse.data.invitation,
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(userLoginResponse.refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            // 3. Create the user with the role

            const createGroupResponse = await axios.post(
                `${this.configService.get('guardian.url')}/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.getBlock(this.configService.get(`blocks.registration.${guardianRole.name}`))}`,
                {
                    document: {
                        name: userDto.name,
                        role: this.capitalizeFirst(userDto.role),
                        organization: {
                            name: org.name,
                            role: this.capitalizeFirst(
                                org.organizationType.name,
                            ),
                        },
                    },
                    ref: null,
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(userLoginResponse.refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            await this.updateUser(userDto, org, guardianRole);

            return createGroupResponse.data;
        } catch (e) {
            throw e;
        }
    }

    async approve(id: number, organizationApproveDto: OrganisationApproveDto) {
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
            console.log(organizationApproveDto);
            console.log(orgEntity);
            const groupApproveResponse = await axios.post(
                `${this.configService.get('guardian.url')}/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.getBlock(this.configService.get(`blocks.approve.${orgEntity.organizationType.name}`))}`,
                orgEntity.payload,
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(organizationApproveDto.refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            await this.organizationRepository.update(
                {
                    id: orgEntity.id,
                },
                { state: OrganizationStateEnum.ACTIVE },
            );
            return groupApproveResponse.data;
        } catch (e) {
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
            const createGroupTypeResponse = await axios.post(
                `${this.configService.get('guardian.url')}/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.getBlock(this.configService.get('blocks.group.group'))}`,
                {
                    group: this.capitalizeFirst(userDto.company.companyRole),
                    label: userDto.company.name,
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(userLoginResponse.refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            await this.delay(5000);
            const createOrganizationResponse = await axios.post(
                `${this.configService.get('guardian.url')}/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.getBlock(this.configService.get(`blocks.group.${userDto.company.companyRole}`))}`,
                {
                    document: {
                        name: userDto.company.name,
                        role: this.capitalizeFirst(userDto.company.companyRole),
                    },
                    ref: null,
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(userLoginResponse.refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

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
            const createGroupResponse = await axios.post(
                `${this.configService.get('guardian.url')}/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.getBlock(this.configService.get(`blocks.user.${userDto.company.companyRole}`))}`,
                {
                    document: {
                        name: userDto.name,
                        organization: {
                            name: userDto.company.name,
                            role: this.capitalizeFirst(
                                userDto.company.companyRole,
                            ),
                        },
                        role: this.capitalizeFirst(userDto.role),
                    },
                    ref: null,
                },
                {
                    headers: {
                        Authorization: `Bearer ${await this.accessToken(userLoginResponse.refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            // // 3. Create the required payload for group (organization) save
            const payload = await this.createPayload(
                createGroupResponse.data,
                this.capitalizeFirst(userDto.company.companyRole),
            );

            // // 4. Send request for approval
            await this.organizationRepository.update(
                {
                    id: orgEntity.id,
                },
                { payload: payload, group: createGroupResponse?.data?.group },
            );
            if (userDto?.request?.userRole === RoleEnum.Root) {
                await this.approve(orgEntity.id, {
                    refreshToken: this.getRefreshToken(userDto?.request?.email),
                    remarks: '',
                });
            }

            const guardianRole = await this.getGuardianRole(
                orgType?.id,
                userDto.role,
            );
            await this.updateUser(userDto, orgEntity, guardianRole);

            return createGroupResponse.data;
        } catch (e) {
            throw e;
        }
    }
}
