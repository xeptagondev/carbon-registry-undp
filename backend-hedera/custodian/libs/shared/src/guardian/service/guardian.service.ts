import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { AuditDTO } from '@app/shared/audit/dto/audit.dto';
import { LogLevel } from '@app/shared/audit/enum/log-level.enum';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { Repository } from 'typeorm';
import { GuardianPwChangeDto } from '../dto/guardian-pw-change.dto';
import { GUARDIAN_ERROR } from '../constant/guardian-error.constant';
import { GUARDIAN_API } from '../constant/guardian-api-blocks.contant';
import { GridTypeEnum } from '../enum/grid-type.enum';
import { GridInterface } from '../interface/guardian-grid.interface';
import { UtilService } from '@app/shared/util/service/util.service';
import {
    ButtonActionEnum,
    ButtonNameEnum,
    ButtonTypeEnum,
} from '../enum/button-type.enum';
import { ButtonPayloadInterface } from '../interface/guardian-button-payload.interface';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';

@Injectable()
export class GuardianService {
    private readonly loggerContext = 'GuardianService';
    constructor(
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
        private readonly utilService: UtilService,
        @InjectRepository(UsersEntity)
        protected readonly usersRepository: Repository<UsersEntity>,
        private readonly logger: InstantLogger,
    ) {}

    async getGuardianError(error: any, calledMainFunction: string) {
        this.logger.error(
            `Error Occurred in Guardian Service ${calledMainFunction}`,
            error,
            this.loggerContext,
        );
        if (axios.isAxiosError(error)) {
            throw new HttpException(
                GUARDIAN_ERROR[error.response.status],
                error.response.status,
            );
        } else {
            throw new HttpException(
                GUARDIAN_ERROR[HttpStatus.INTERNAL_SERVER_ERROR],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getRefreshToken(username: string) {
        const user: UsersEntity = await this.usersRepository.findOne({
            where: { email: username },
        });
        return user?.refreshToken;
    }

    async accessToken(refreshToken: string) {
        const accessTokenResponse = await axios.post(
            `${this.configService.get('guardian.url')}${GUARDIAN_API.ACCESS_TOKEN}`,
            {
                refreshToken: refreshToken,
            },
        );
        return accessTokenResponse.data.accessToken;
    }

    private buildGuardianUrl(pathKey: string): string {
        return `${this.configService.get('guardian.url')}${pathKey}`;
    }

    private async getAccessToken(refreshToken: string): Promise<string> {
        try {
            const url = `${this.configService.get('guardian.url')}${GUARDIAN_API.ACCESS_TOKEN}`;
            const accessTokenResponse = await axios.post(url, {
                refreshToken: refreshToken,
            });
            return accessTokenResponse?.data?.accessToken;
        } catch (e) {
            await this.getGuardianError(e, 'getAccessToken');
        }
    }

    public async registerUser(email: string, password: string): Promise<any> {
        try {
            const url = this.buildGuardianUrl(GUARDIAN_API.REGISTER);
            await axios.post(url, {
                username: email,
                password,
                // eslint-disable-next-line camelcase
                password_confirmation: password,
                role: 'USER',
            });
        } catch (e) {
            await this.getGuardianError(e, 'registerUser');
        }
    }

    public async updateUserProfile(
        email: string,
        hashedPass: string,
        parentDid: string,
        hederaAccount: string,
        hederaKey: string,
    ): Promise<any> {
        try {
            const userLoginResponse = await this.login({
                username: email,
                password: hashedPass,
            });
            const url = `${this.buildGuardianUrl(GUARDIAN_API.PROFILE_UPDATE)}/${email}`;
            const token = await this.getAccessToken(
                userLoginResponse.refreshToken,
            );
            const response = await axios.put(
                url,
                {
                    parent: parentDid,
                    hederaAccountId: hederaAccount,
                    hederaAccountKey: hederaKey,
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
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (e) {
            await this.getGuardianError(e, 'updateUserProfile');
        }
    }

    public async assignPolicyToUser(
        email: string,
        assign: boolean = true,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `${GUARDIAN_API.POLICY_ASSIGN_ONE}/${email}${GUARDIAN_API.POLICY_ASSIGN_TWO}`,
            );

            const userLoginResponse = await this.login({
                username: this.configService.get('sru.username'),
                password: this.configService.get('sru.password'),
            });

            const token = await this.getAccessToken(
                userLoginResponse.refreshToken,
            );
            const response = await axios.post(
                url,
                {
                    policyIds: [this.configService.get('policy.id')],
                    assign: assign,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (e) {
            await this.getGuardianError(e, 'assignPolicyToUser');
        }
    }

    public async createGroupType(
        email: string,
        hashedPass: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const userLoginResponse = await this.login({
                username: email,
                password: hashedPass,
            });
            const token = await this.getAccessToken(
                userLoginResponse.refreshToken,
            );
            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'createGroupType');
        }
    }

    public async createOrganization(
        email: string,
        hashedPass: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const userLoginResponse = await this.login({
                username: email,
                password: hashedPass,
            });
            const token = await this.getAccessToken(
                userLoginResponse.refreshToken,
            );

            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'createOrganization');
        }
    }

    public async getGridDataUsingRefId(
        grid: GridTypeEnum,
        refId: string,
        email: string,
    ): Promise<any> {
        let gridApis: GridInterface;

        switch (grid) {
            case GridTypeEnum.USER_GRID:
                gridApis = GUARDIAN_API.BLOCKS.USER_QUERY;
                break;
            case GridTypeEnum.ORGANIZATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.ORGANIZATION_QUERY;
                break;
            case GridTypeEnum.PROJECT_GRID:
                gridApis = GUARDIAN_API.BLOCKS.PROJECT_QUERY;
                break;
            case GridTypeEnum.INF_GRID:
                gridApis = GUARDIAN_API.BLOCKS.INF_QUERY;
                break;
            case GridTypeEnum.PDD_GRID:
                gridApis = GUARDIAN_API.BLOCKS.PDD_QUERY;
                break;
            case GridTypeEnum.VALIDATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.VALIDATION_QUERY;
                break;
            case GridTypeEnum.ACTIVITY_GRID:
                gridApis = GUARDIAN_API.BLOCKS.ACTIVITY_QUERY;
                break;
            case GridTypeEnum.MONITORING_GRID:
                gridApis = GUARDIAN_API.BLOCKS.MONITORING_QUERY;
                break;
            case GridTypeEnum.VERIFICATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.VERIFICATION_QUERY;
                break;
            default:
                throw new Error(`Unsupported grid type: ${grid}`);
        }

        const user = await this.usersRepository.findOne({
            where: { email: email },
        });

        const token = await this.getAccessToken(user.refreshToken);
        const policyId = this.configService.get('policy.id');

        const refIdFilterUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.FILTER_REF_ID)}`,
        );

        const notStatusFilterUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.FILTER_NOT_STATUS)}`,
        );

        const gridUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.GRID)}`,
        );

        const notStatusFilterResponse = await axios.get(notStatusFilterUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        let activeFilterResponse: AxiosResponse;
        if (notStatusFilterResponse.status === HttpStatus.OK) {
            activeFilterResponse = await axios.post(
                notStatusFilterUrl,
                { filterValue: 'REVOKED' },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            if (activeFilterResponse.status !== HttpStatus.OK) {
                throw new Error('Failed to set the Filter');
            }
        }

        const filterResponse = await axios.post(
            refIdFilterUrl,
            { filterValue: refId },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            },
        );
        if (filterResponse.status !== HttpStatus.OK) {
            throw new Error('Failed to set the Filter');
        }

        const gridResponse = await axios.get(gridUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (gridResponse.status !== HttpStatus.OK) {
            throw new Error('Failed to fetch grid data');
        }

        const fullVCDocument = gridResponse.data?.data.find((response: any) => {
            return response?.document?.credentialSubject[0]?.refId === refId;
        });

        if (!fullVCDocument) {
            throw new Error('No document found for the given refId');
        }

        return fullVCDocument.document?.credentialSubject[0];
    }

    public async getGridDocumentUsingRefId(
        grid: GridTypeEnum,
        refId: string,
        email: string,
    ): Promise<any> {
        let gridApis: GridInterface;

        switch (grid) {
            case GridTypeEnum.USER_GRID:
                gridApis = GUARDIAN_API.BLOCKS.USER_QUERY;
                break;
            case GridTypeEnum.ORGANIZATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.ORGANIZATION_QUERY;
                break;
            case GridTypeEnum.PROJECT_GRID:
                gridApis = GUARDIAN_API.BLOCKS.PROJECT_QUERY;
                break;
            case GridTypeEnum.INF_GRID:
                gridApis = GUARDIAN_API.BLOCKS.INF_QUERY;
                break;
            case GridTypeEnum.PDD_GRID:
                gridApis = GUARDIAN_API.BLOCKS.PDD_QUERY;
                break;
            case GridTypeEnum.VALIDATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.VALIDATION_QUERY;
                break;
            case GridTypeEnum.ACTIVITY_GRID:
                gridApis = GUARDIAN_API.BLOCKS.ACTIVITY_QUERY;
                break;
            case GridTypeEnum.MONITORING_GRID:
                gridApis = GUARDIAN_API.BLOCKS.MONITORING_QUERY;
                break;
            case GridTypeEnum.VERIFICATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.VERIFICATION_QUERY;
                break;
            default:
                throw new Error(`Unsupported grid type: ${grid}`);
        }

        const user = await this.usersRepository.findOne({
            where: { email: email },
        });

        const token = await this.getAccessToken(user.refreshToken);
        const policyId = this.configService.get('policy.id');

        const refIdFilterUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.FILTER_REF_ID)}`,
        );

        const notStatusFilterUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.FILTER_NOT_STATUS)}`,
        );

        const gridUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.GRID)}`,
        );

        const notStatusFilterResponse = await axios.get(notStatusFilterUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        let activeFilterResponse: AxiosResponse;
        if (notStatusFilterResponse.status === HttpStatus.OK) {
            activeFilterResponse = await axios.post(
                notStatusFilterUrl,
                { filterValue: 'REVOKED' },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            if (activeFilterResponse.status !== HttpStatus.OK) {
                throw new Error('Failed to set the Filter');
            }
        }

        const filterResponse = await axios.post(
            refIdFilterUrl,
            { filterValue: refId },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            },
        );
        if (filterResponse.status !== HttpStatus.OK) {
            throw new Error('Failed to set the Filter');
        }

        const gridResponse = await axios.get(gridUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (gridResponse.status !== HttpStatus.OK) {
            throw new Error('Failed to fetch grid data');
        }

        const fullVCDocument = gridResponse.data?.data.find((response: any) => {
            return response?.document?.credentialSubject[0]?.refId === refId;
        });

        if (!fullVCDocument) {
            throw new Error('No document found for the given refId');
        }

        return fullVCDocument;
    }

    public async getGridHistoryByRefId(
        grid: GridTypeEnum,
        refId: string,
        email: string,
    ): Promise<any> {
        let gridApis: GridInterface;

        switch (grid) {
            case GridTypeEnum.USER_GRID:
                gridApis = GUARDIAN_API.BLOCKS.USER_QUERY;
                break;
            case GridTypeEnum.ORGANIZATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.ORGANIZATION_QUERY;
                break;
            case GridTypeEnum.PROJECT_GRID:
                gridApis = GUARDIAN_API.BLOCKS.PROJECT_QUERY;
                break;
            case GridTypeEnum.INF_GRID:
                gridApis = GUARDIAN_API.BLOCKS.INF_QUERY;
                break;
            case GridTypeEnum.PDD_GRID:
                gridApis = GUARDIAN_API.BLOCKS.PDD_QUERY;
                break;
            case GridTypeEnum.VALIDATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.VALIDATION_QUERY;
                break;
            case GridTypeEnum.ACTIVITY_GRID:
                gridApis = GUARDIAN_API.BLOCKS.ACTIVITY_QUERY;
                break;
            case GridTypeEnum.MONITORING_GRID:
                gridApis = GUARDIAN_API.BLOCKS.MONITORING_QUERY;
                break;
            case GridTypeEnum.VERIFICATION_GRID:
                gridApis = GUARDIAN_API.BLOCKS.VERIFICATION_QUERY;
                break;
            default:
                throw new Error(`Unsupported grid type: ${grid}`);
        }

        const user = await this.usersRepository.findOne({
            where: { email: email },
        });

        const token = await this.getAccessToken(user.refreshToken);
        const policyId = this.configService.get('policy.id');

        const refIdFilterUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.FILTER_REF_ID)}`,
        );

        const notStatusFilterUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.FILTER_NOT_STATUS)}`,
        );

        const gridUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.GRID)}`,
        );

        const notStatusFilterResponse = await axios.get(notStatusFilterUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        let activeFilterResponse: AxiosResponse;
        if (notStatusFilterResponse.status === HttpStatus.OK) {
            activeFilterResponse = await axios.post(
                notStatusFilterUrl,
                { filterValue: 'REVOKED' },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            if (activeFilterResponse.status !== HttpStatus.OK) {
                throw new Error('Failed to set the Filter');
            }
        }

        const filterResponse = await axios.post(
            refIdFilterUrl,
            { filterValue: refId },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            },
        );
        if (filterResponse.status !== HttpStatus.OK) {
            throw new Error('Failed to set the Filter');
        }

        const gridResponse = await axios.get(gridUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (gridResponse.status !== HttpStatus.OK) {
            throw new Error('Failed to fetch grid data');
        }

        const fullVCDocument = gridResponse.data?.data.find((response: any) => {
            return response?.document?.credentialSubject[0]?.refId === refId;
        });

        if (!fullVCDocument) {
            throw new Error('No document found for the given refId');
        }

        return fullVCDocument?.history;
    }

    public async createEntity(
        email: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const user = await this.usersRepository.findOne({
                where: { email: email },
            });
            const token = await this.getAccessToken(user.refreshToken);

            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'createProject');
        }
    }

    public async query(email: string, blockId: string): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const user = await this.usersRepository.findOne({
                where: { email: email },
            });
            const token = await this.getAccessToken(user.refreshToken);

            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'getProjects');
        }
    }

    public async createUser(
        email: string,
        hashedPass: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const userLoginResponse = await this.login({
                username: email,
                password: hashedPass,
            });
            const token = await this.getAccessToken(
                userLoginResponse.refreshToken,
            );

            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'createUser');
        }
    }

    public async createInvitation(
        email: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const refreshToken = await this.getRefreshToken(email);
            const token = await this.getAccessToken(refreshToken);

            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'createInvitation');
        }
    }

    public async buttonActionRequest(
        buttonBlockName: ButtonNameEnum,
        action: ButtonActionEnum,
        document: any,
        requestUserEmail: string,
        remarks?: string,
    ): Promise<void> {
        const buttonUrl = this.buildGuardianUrl(
            // eslint-disable-next-line max-len
            `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.utilService.getBlock(buttonBlockName)}`,
        );
        const refreshToken = await this.getRefreshToken(requestUserEmail);
        let buttonType: ButtonTypeEnum = ButtonTypeEnum.SELECTOR;

        // Check if Remark Exists
        if (remarks.trim()) {
            const buttonGetResponse = await axios.get(buttonUrl, {
                headers: {
                    Authorization: `Bearer ${await this.getAccessToken(refreshToken)}`,
                    'Content-Type': 'application/json',
                },
            });

            if (buttonGetResponse.status == HttpStatus.OK) {
                const isRemarkButton =
                    buttonGetResponse.data?.uiMetaData.buttons.find(
                        (button: any) =>
                            button?.tag === action &&
                            button?.type === ButtonTypeEnum.SELECTOR_DIALOG,
                    );
                if (isRemarkButton) {
                    buttonType = ButtonTypeEnum.SELECTOR_DIALOG;
                }
            }
        }

        if (buttonType == ButtonTypeEnum.SELECTOR_DIALOG) {
            if (!document.option) {
                document.option = {};
            }
            if (!Array.isArray(document.option.comment)) {
                document.option.comment = [];
            }
            document.option.comment.push(remarks);
        }

        const finalPayload: ButtonPayloadInterface = {
            document: { ...document },
            tag: action,
        };

        try {
            const buttonPostResponse = await axios.post(
                buttonUrl,
                finalPayload,
                {
                    headers: {
                        Authorization: `Bearer ${await this.getAccessToken(refreshToken)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            if (buttonPostResponse.status == HttpStatus.OK) {
                this.logger.log(
                    `Successfully ${action} called ${buttonBlockName} by ${requestUserEmail}`,
                    this.loggerContext,
                );
            }
        } catch (error) {
            await this.getGuardianError(error, 'buttonActionRequest');
        }
    }

    public async approve(
        email: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const refreshToken = await this.getRefreshToken(email);
            const token = await this.getAccessToken(refreshToken);

            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'approve');
        }
    }
    public async login(loginDto: LoginDto): Promise<any> {
        try {
            const response = await axios.post(
                `${this.configService.get('guardian.url')}${GUARDIAN_API.LOGIN}`,
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
                    await this.usersRepository.update(
                        {
                            email: loginDto.username,
                        },
                        { refreshToken: response?.data?.refreshToken },
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
            return response.data;
        } catch (error) {
            await this.getGuardianError(error, 'login');
        }
    }

    async passwordChange(guardianPwChangeDto: GuardianPwChangeDto) {
        const logInDetails = await this.login({
            username: guardianPwChangeDto.username,
            password: guardianPwChangeDto.oldPassword,
        });

        const url = `${this.buildGuardianUrl(GUARDIAN_API.CHANGE_PASSWORD)}`;
        const token = await this.getAccessToken(logInDetails?.refreshToken);
        const response = await axios.post(url, guardianPwChangeDto, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response && response.status == HttpStatus.OK) {
            return response;
        } else {
            throw new HttpException(
                'Password Changed Failed',
                HttpStatus.BAD_REQUEST,
            );
        }
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
}
