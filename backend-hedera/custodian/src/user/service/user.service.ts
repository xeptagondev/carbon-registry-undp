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
import { TransactionService } from '@app/shared/transaction/service/transaction.service';
import { TransactionStage } from '@app/shared/transaction/enum/transaction.stage.enum';
import { TransactionType } from '@app/shared/transaction/enum/transaction.type.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganisationDto } from '@app/shared/organization/dto/organisation.dto';
import {
    generatePassword,
    hashPassword,
    verifyPassword,
} from '@app/shared/util/util';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import {
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
import { OrganizationService } from 'src/organization/service/organization.service';
import { FileHandlerInterface } from '@app/shared/file-handler/filehandler.interface';
import { PasswordUpdateDto } from '@app/shared/users/dto/password-update.dto';
import { HTTPResponseDto } from '@app/shared/util/dto/http.response.dto';

@Injectable()
export class UserService extends SuperService<UsersEntity, UsersDTO> {
    private readonly logger = new Logger(UserService.name);
    constructor(
        private readonly guardianService: GuardianService,
        private readonly transactionService: TransactionService,
        private readonly configService: ConfigService,
        private readonly utilService: UtilService,
        private readonly mailService: MailService,
        private readonly fileHandler: FileHandlerInterface,
        private readonly helperService: HelperService,
        private readonly orgaisationService: OrganizationService,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
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

    async delay(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    async register(
        userDto: UsersDTO,
        defaultPass: string = '',
        reqUser?: JWTPayload,
    ) {
        try {
            this.logger.log(
                `Request received to register user with email ${userDto.email}`,
            );
            await this.utilService.setTagToIdMap();
            // 1: Login SRU and Gov. Root

            const sruLoginResponse = await this.guardianService.login({
                username: this.configService.get('sru.username'),
                password: this.configService.get('sru.password'),
            });

            // 1.1 Generate random password for user
            const passwordLen = 8;
            let userPass: string;
            if (defaultPass === '') {
                userPass = generatePassword(passwordLen);
            } else {
                userPass = defaultPass;
            }
            // const serverSalt = this.configService.get('security.salt');
            // const guardianPass = userPass + serverSalt;
            const hashedPass = hashPassword(userPass);

            // 2: Register the new user as a 'USER' in guardian backend
            try {
                await this.guardianService.registerUser(
                    userDto.email,
                    hashedPass,
                );
                await this.transactionService.save({
                    user: reqUser?.email,
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
                password: hashedPass,
                phoneNumber: userDto.phoneNo,
            };

            // i. Save user in db without organization and role
            const user: UsersEntity =
                await this.usersRepository.save(userEntity);

            // 3. User login to the guardian backend
            const userLoginResponse = await this.guardianService.login({
                username: userDto.email,
                password: hashedPass,
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
                    user: reqUser?.email,
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
                    user: reqUser?.email,
                    stage: TransactionStage.ASSIGN_POLICY,
                    type: TransactionType.USER_REGISTER,
                    createdTime: Date.now(),
                });
            } catch (e) {
                console.log(e);
                throw e;
            }
            let res;
            if (userDto.company) {
                // 6. Register new organization
                res = await this.registerGroup(
                    userDto,
                    userLoginResponse,
                    reqUser,
                );
            } else {
                // 6. Accept an invitation (generate an invitation and create the user)
                res = await this.inviteNewUser(
                    userDto,
                    userLoginResponse,
                    reqUser,
                );
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

    private async inviteNewUser(
        userDto: UsersDTO,
        userLoginResponse,
        reqUser: JWTPayload,
    ) {
        try {
            // 1. Generate an invite for the given role
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
            let inviteResponse = { invitation: '' };
            try {
                const refreshToken = await this.guardianService.getRefreshToken(
                    reqUser?.email,
                );
                inviteResponse = await this.guardianService.createInvitation(
                    refreshToken,
                    this.utilService.getBlock(
                        this.configService.get('blocks.userCreateInvite'),
                    ),
                    {
                        action: 'invite',
                        group: org.group,
                        role: guardianRole.name,
                    },
                );
                await this.transactionService.save({
                    user: reqUser?.email,
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
                        this.utilService.getBlock(
                            this.configService.get('blocks.createGroupType'),
                        ),
                        {
                            invitation: inviteResponse.invitation,
                        },
                    );
                await this.transactionService.save({
                    user: reqUser?.email,
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
                    this.utilService.getBlock(
                        this.configService.get('blocks.createUser'),
                    ),
                    {
                        document: {
                            name: userDto.name,
                            role: userDto.role,
                        },
                        ref: null,
                    },
                );
                await this.transactionService.save({
                    user: reqUser?.email,
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

    private async registerGroup(
        userDto: UsersDTO,
        userLoginResponse,
        reqUser: JWTPayload,
    ) {
        try {
            // 1. Create a new group type in guardian
            try {
                const createGroupTypeResponse =
                    await this.guardianService.createGroupType(
                        userLoginResponse.refreshToken,
                        this.utilService.getBlock(
                            this.configService.get('blocks.createGroupType'),
                        ),
                        {
                            group: userDto.company.companyRole,
                            label: userDto.company.name,
                        },
                    );
                await this.transactionService.save({
                    user: reqUser?.email,
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
                    ? 'blocks.createMultipleOrganization'
                    : 'blocks.createSingleOrganization';
                createOrganizationResponse =
                    await this.guardianService.createOrganization(
                        userLoginResponse.refreshToken,
                        this.utilService.getBlock(
                            this.configService.get(blockName),
                        ),
                        {
                            document: {
                                name: userDto.company.name,
                                role: userDto.company.companyRole,
                            },
                            ref: null,
                        },
                    );

                await this.transactionService.save({
                    user: reqUser?.email,
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
                email: userDto?.company?.email,
                taxId: userDto?.company?.taxId,
                phoneNumber: userDto?.company?.phoneNo,
                paymentId: userDto?.company?.paymentId,
                faxNumber: userDto?.company?.faxNo,
                province: userDto?.company?.provinces,
                website: userDto?.company?.website,
                address: userDto?.company?.address,
            };

            // iii. Save organization
            orgEntity = await this.organizationRepository.save(orgEntity);

            // 2. Create a group (organization) => Create the organization of org type

            await this.delay(10000);

            if (
                userDto?.company?.logo &&
                this.helperService.isBase64(userDto?.company?.logo)
            ) {
                const response: any = await this.fileHandler.uploadFile(
                    `profile_images/${orgEntity.id}_${new Date().getTime()}.png`,
                    userDto?.company?.logo,
                );
                if (response) {
                    userDto.company.logo = response;
                    // if (
                    //     process.env.ASYNC_OPERATIONS_TYPE ===
                    //     AsyncOperationType.Queue
                    // ) {
                    //     createdUserDto.company.logo = response;
                    // }
                } else {
                    throw new HttpException(
                        'Error while uploading company logo',
                        HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                }
            }

            try {
                const createUserResponse =
                    await this.guardianService.createUser(
                        userLoginResponse.refreshToken,
                        this.utilService.getBlock(
                            this.configService.get('blocks.createUser'),
                        ),
                        {
                            document: {
                                name: userDto.name,
                                role: userDto.role,
                            },
                            ref: null,
                        },
                    );
                await this.transactionService.save({
                    user: reqUser?.email,
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
                {
                    payload: payload,
                    group: createOrganizationResponse?.group,
                    logo: userDto?.company?.logo,
                },
            );
            if (reqUser?.userRole === RoleEnum.Root) {
                await this.orgaisationService.approve(
                    reqUser?.email,
                    orgEntity.id,
                    {
                        remarks: '',
                    },
                );
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
        if (this.configService.get('system.initPolicy') === 'true') {
            await this.utilService.fetchPolicyBlocks();
        }
        if (this.configService.get('system.initOrgs') === 'true') {
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
                    user.phoneNo = this.configService.get(
                        `organizations.${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}.phoneNo`,
                    );
                    user.role = RoleEnum.Root;
                    user.company = orgDto;

                    const groupResponse = await this.register(
                        user,
                        user.password,
                    );
                    await this.organizationRepository.update(
                        {
                            group: groupResponse?.group,
                        },
                        { state: OrganizationStateEnum.ACTIVE },
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
            createdTime: null,
            isPending: false,
            company: {
                companyId: newUser.organization?.id,
                name: newUser.organization?.name,
                taxId: null,
                paymentId: null,
                email: null,
                phoneNo: newUser.phoneNumber ?? null,
                website: null,
                address: null,
                country: null,
                logo: null,
                companyRole:
                    newUser.organization?.organizationType?.name ?? null,
                state: newUser.organization?.state ?? null,
                creditBalance: null,
                secondaryAccountBalance: null,
                programmeCount: null,
                lastUpdateVersion: null,
                creditTxTime: null,
                remarks: null,
                createdTime: null,
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

    public async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.helperService.validateRequestUser(requestUser);
        if (
            !(
                requestUser.organizationRole ==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            if (query.filterAnd) {
                query.filterAnd.push({
                    key: 'organization"."id',
                    operation: '=',
                    value: requestUser.organizationId,
                });
            } else {
                const filterAnd: FilterEntry[] = [];
                filterAnd.push({
                    key: 'organization"."id',
                    operation: '=',
                    value: requestUser.organizationId,
                });
                query.filterAnd = filterAnd;
            }
        }

        //Formatting Query
        const newToOldFieldMap: Record<string, string> = {
            id: 'user"."id',
            name: 'user"."name',
            email: 'user"."email',
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
            user: userProfile,
            Organisation: userProfile?.organization,
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
        const isOldPwdVerified = verifyPassword(
            passwordUpdateDto.oldPassword,
            userDetails.password,
        );

        if (!userDetails || !isOldPwdVerified) {
            throw new HttpException(
                'Entered old password is incorrect',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const hashedPass = hashPassword(passwordUpdateDto.newPassword);
        // const serverSalt = this.configService.get('security.salt');
        const guardianResponse = await this.guardianService.passwordChange({
            newPassword: hashedPass,
            oldPassword: userDetails.password,
            username: userDetails.email,
        });

        if (guardianResponse) {
            await this.transactionService.save({
                user: userDetails?.email,
                stage: TransactionStage.CHANGE_PASSOWRD,
                type: TransactionType.CHANGE_PASSOWRD,
                createdTime: Date.now(),
            });
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
                .catch((err: any) => {
                    return err;
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
