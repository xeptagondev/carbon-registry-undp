/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { OrganizationDto } from '@app/shared/organization/dto/organization.dto';
import {
    generatePassword,
    hashPassword,
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
import { OrganizationService } from 'src/organization/service/organization.service';
import { FileHandlerInterface } from '@app/shared/file-handler/filehandler.interface';
import { PasswordUpdateDto } from '@app/shared/users/dto/password-update.dto';
import { HTTPResponseDto } from '@app/shared/util/dto/http.response.dto';
import { UserUpdateDto } from '@app/shared/users/dto/user-update.dto';
import { UserStageEnum } from '@app/shared/users/enum/user.stage.enum';
import { DataExportQueryDto } from '@app/shared/util/dto/data.export.query.dto';
import { DataExportUserDto } from '@app/shared/util/dto/data.export.user.dto';
import { DataExportService } from '@app/shared/util/service/data-export.service';
import { UserStateConstant } from '@app/shared/users/constants/user.state.constants';

@Injectable()
export class UserService extends SuperService<UsersEntity, UsersDTO> {
    private readonly logger = new Logger(UserService.name);
    constructor(
        private readonly guardianService: GuardianService,
        private readonly configService: ConfigService,
        private readonly utilService: UtilService,
        private readonly mailService: MailService,
        private readonly fileHandler: FileHandlerInterface,
        private readonly helperService: HelperService,
        private readonly dataExportService: DataExportService,
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
        PP: 'Project Participant',
        DNA: 'Designated National Authority',
        DOE: 'Indinependant Certifier',
        ClimateFund: 'Zimbabwe Climate Fund',
        ExecutiveCommittee: 'Executive Committee',
        Ministry: 'Ministry',
    };

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

    async delay(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
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

    async register(
        userDto: UsersDTO,
        defaultPass: string = '',
        reqUser?: JWTPayload,
        isUserActive: boolean = UserStateConstant.DEACTIVE,
    ) {
        // this.helperService.validateRequestUser(reqUser);
        const userDetails = await this.usersRepository.findOne({
            where: {
                email: userDto.email,
            },
        });
        if (userDetails && userDetails.stage === UserStageEnum.APPROVE_USER) {
            throw new HttpException(
                'Account creation failed: The provided email address is already registered in the system.',
                HttpStatus.FORBIDDEN,
            );
        }

        const countryName = this.configService.get('country');
        this.logger.log(
            `Request received to register user with email ${userDto.email}`,
        );
        await this.utilService.setTagToIdMap();
        // 1: Login SRU and Gov. Root

        // 1.1 Generate random password for user
        const passwordLen = 8;
        let userPass: string;
        if (defaultPass === '') {
            userPass = generatePassword(passwordLen);
        } else {
            userPass = defaultPass;
        }

        const hashedPass = hashPassword(userPass);

        // 2: Register the new user as a 'USER' in guardian backend
        const regUser = await this.findUser(userDto.email);
        if (!regUser) {
            await this.checkForUserDuplicates(
                userDto.email,
                userDto.hederaAccount,
            );

            await this.guardianService.registerUser(userDto.email, hashedPass);
            await this.delay(5000);

            const userEntity: UsersEntity = {
                email: userDto.email,
                name: userDto.name,
                password: hashedPass,
                phoneNumber: userDto.phoneNo,
                hederaAccount: userDto.hederaAccount,
                stage: UserStageEnum.REGISTER,
                isActive: isUserActive,
                createdTime: new Date().getTime(),
            };

            // i. Save user in db without organization and role
            const user: UsersEntity =
                await this.usersRepository.save(userEntity);

            // 3. User login to the guardian backend
        }
        // 4. Update the user profile with the parent (SRU)
        const updateUser = await this.findUser(userDto.email);
        if (updateUser && updateUser.stage === UserStageEnum.REGISTER) {
            await this.guardianService.updateUserProfile(
                userDto.email,
                updateUser.password,
                this.configService.get('sru.did'),
                userDto.hederaAccount,
                userDto.hederaKey,
            );
            await this.delay(15000);

            await this.usersRepository.update(
                {
                    email: userDto.email,
                },
                { stage: UserStageEnum.ASIGN_REGISTRY },
            );
        }
        // 5. Assign the policy for the user

        const assignUser = await this.findUser(userDto.email);

        if (assignUser && assignUser.stage === UserStageEnum.ASIGN_REGISTRY) {
            await this.guardianService.assignPolicyToUser(userDto.email, true);
            await this.usersRepository.update(
                {
                    email: userDto.email,
                },
                { stage: UserStageEnum.ASIGN_POLICY },
            );
        }

        let res;
        if (userDto.company) {
            await this.checkForOrganizationDuplicates(
                userDto.company.email,
                userDto.company.taxId,
                userDto.company.paymentId,
            );
            // 6. Register new organization
            res = await this.registerGroup(userDto, reqUser);

            // 6.1 Send organization email
            const mailDTO: MailTemplateDTO = {
                subject: ORG_CREATE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
                template: MailTemplateEnum.ORG_CREATE,
                to: userDto.company.email,
                context: {
                    organizationName: userDto.company.name,
                    countryName: countryName,
                    organizationRole:
                        OrganizationTypeFormatEnum[userDto.company.companyRole],
                    home: this.configService.get('url'),
                },
            };

            await this.mailService.sendMail(mailDTO);
        } else {
            // 6. Accept an invitation (generate an invitation and create the user)
            res = await this.inviteNewUser(userDto, reqUser);
        }

        // 7. Send password creation email to user

        const mailDTO: MailTemplateDTO = {
            subject: USER_REGISTER_HEADER.replace(
                '{{countryName}}',
                countryName,
            ),
            template: isUserActive
                ? MailTemplateEnum.PASSWORD_CREATE
                : MailTemplateEnum.PENDING_USER_CREATE,
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

        const response: HTTPResponseDto = {
            statusCode: HttpStatus.OK,
            message: userDto.company
                ? 'Successfully created organization with admin user'
                : 'Successfully created the user',
        };
        return response;
    }

    private async inviteNewUser(userDto: UsersDTO, reqUser: JWTPayload) {
        try {
            // 1. Generate an invite for the given role
            const groupTypeUser = await this.findUser(userDto.email);
            if (
                groupTypeUser &&
                groupTypeUser.stage === UserStageEnum.ASIGN_POLICY
            ) {
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
                const inviteResponse =
                    await this.guardianService.createInvitation(
                        reqUser?.email,
                        this.utilService.getBlock(
                            this.configService.get('blocks.userCreateInvite'),
                        ),
                        {
                            action: 'invite',
                            group: org.group,
                            role: guardianRole.name,
                        },
                    );

                // 2. Submit the generated invitation for user creation

                await this.guardianService.createGroupType(
                    userDto.email,
                    groupTypeUser.password,
                    this.utilService.getBlock(
                        this.configService.get('blocks.createGroupType'),
                    ),
                    {
                        invitation: inviteResponse.invitation,
                    },
                );
                await this.usersRepository.update(
                    {
                        email: userDto.email,
                    },
                    { stage: UserStageEnum.CREATE_GROUP_TYPE },
                );
            }
            // 3. Create the user with the role
            const user = await this.findUser(userDto.email);
            if (user && user.stage === UserStageEnum.CREATE_GROUP_TYPE) {
                await this.guardianService.createUser(
                    userDto.email,
                    user.password,
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

                await this.updateUser(userDto, org, guardianRole);
                await this.usersRepository.update(
                    {
                        email: userDto.email,
                    },
                    {
                        stage: UserStageEnum.APPROVE_USER,
                    },
                );
            }

            return true;
        } catch (e) {
            throw new HttpException(
                'Error occurred while adding the user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async registerGroup(userDto: UsersDTO, reqUser: JWTPayload) {
        try {
            // 1. Create a new group type in guardian
            const groupTypeUser = await this.findUser(userDto.email);
            if (
                groupTypeUser &&
                groupTypeUser.stage === UserStageEnum.ASIGN_POLICY
            ) {
                await this.guardianService.createGroupType(
                    userDto.email,
                    groupTypeUser.password,
                    this.utilService.getBlock(
                        this.configService.get('blocks.createGroupType'),
                    ),
                    {
                        group: userDto.company.companyRole,
                        label: userDto.company.name,
                    },
                );

                await this.usersRepository.update(
                    {
                        email: userDto.email,
                    },
                    { stage: UserStageEnum.CREATE_GROUP_TYPE },
                );
                await this.delay(5000);
            }

            const orgType = await this.organizationTypeRepository.findOne({
                where: {
                    name: userDto?.company?.companyRole,
                },
            });

            let createOrganizationResponse = { group: '' };
            const groupUser = await this.findUser(userDto.email);
            if (
                groupUser &&
                groupUser.stage === UserStageEnum.CREATE_GROUP_TYPE
            ) {
                const blockName = orgType.multiple
                    ? 'blocks.createMultipleOrganization'
                    : 'blocks.createSingleOrganization';
                createOrganizationResponse =
                    await this.guardianService.createOrganization(
                        userDto.email,
                        groupUser.password,
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
                    provinces: userDto?.company?.provinces,
                    website: userDto?.company?.website,
                    address: userDto?.company?.address,
                    createdTime: new Date().getTime(),
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
                    } else {
                        throw new HttpException(
                            'Error while uploading company logo',
                            HttpStatus.INTERNAL_SERVER_ERROR,
                        );
                    }
                }
                await this.usersRepository.update(
                    {
                        email: userDto.email,
                    },
                    { stage: UserStageEnum.CREATE_GROUP },
                );
            }
            const user = await this.findUser(userDto.email);
            if (user && user.stage === UserStageEnum.CREATE_GROUP) {
                await this.guardianService.createUser(
                    userDto.email,
                    user.password,
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

                // // 3. Create the required payload for group (organization) save
                const payload = await this.guardianService.createPayload(
                    createOrganizationResponse,
                    userDto.company.companyRole,
                );
                await this.usersRepository.update(
                    {
                        email: userDto.email,
                    },
                    { stage: UserStageEnum.CREATE_USER },
                );

                // // 4. Send request for approval
                const orgEntity = await this.organizationRepository.findOne({
                    where: { email: userDto?.company?.email },
                });
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
            }
            const approveUser = await this.findUser(userDto.email);
            if (
                approveUser &&
                approveUser.stage === UserStageEnum.CREATE_USER
            ) {
                const orgEntity = await this.organizationRepository.findOne({
                    where: { email: userDto?.company?.email },
                });
                const guardianRole = await this.getGuardianRole(
                    orgType?.id,
                    userDto.role,
                );
                await this.updateUser(userDto, orgEntity, guardianRole);
                if (
                    reqUser?.organizationRole ==
                        OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
                    (reqUser?.userRole === RoleEnum.Admin ||
                        reqUser?.userRole === RoleEnum.Root)
                ) {
                    await this.orgaisationService.approve(
                        reqUser?.email,
                        orgEntity.id,
                        {
                            remarks: '',
                        },
                    );
                }
            }

            return true;
        } catch (e) {
            throw new HttpException(
                'Error occurred while creating group type, group and user',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
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
                    const orgDto = new OrganizationDto();
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
                        undefined,
                        UserStateConstant.ACTIVE,
                    );
                    await this.organizationRepository.update(
                        {
                            email: orgDto.email,
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
        // Guardian Implmentation Not Yet Completed
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
}
