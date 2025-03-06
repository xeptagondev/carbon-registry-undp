/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class UserInitializationService implements OnModuleInit {
    private readonly logger = new Logger(UserInitializationService.name);
    constructor(
        private readonly configService: ConfigService,
        private readonly utilService: UtilService,
        private readonly userService: UserService,
        @InjectRepository(OrganizationEntity)
        private readonly organizationRepository: Repository<OrganizationEntity>,
        @InjectRepository(OrganizationTypeEntity)
        private readonly organizationTypeRepository: Repository<OrganizationTypeEntity>,
    ) {}

    async onModuleInit() {
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
}
