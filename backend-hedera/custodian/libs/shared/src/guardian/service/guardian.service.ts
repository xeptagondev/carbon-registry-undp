import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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
            `Error Occurred in Guardian Service ${calledMainFunction} 
            ${JSON.stringify(error)}`,
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

    public async updateDocument(
        email: string,
        blockName: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                // eslint-disable-next-line max-len
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.utilService.getBlock(blockName)}`,
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
            await this.getGuardianError(error, 'updateOrganization');
            return;
        }
    }

    private getGridApi(grid: GridTypeEnum): GridInterface {
        const gridMappings = {
            [GridTypeEnum.USER_GRID]: GUARDIAN_API.BLOCKS.USER_QUERY,
            [GridTypeEnum.ORGANIZATION_GRID]:
                GUARDIAN_API.BLOCKS.ORGANIZATION_QUERY,
            [GridTypeEnum.PROJECT_GRID]: GUARDIAN_API.BLOCKS.PROJECT_QUERY,
            [GridTypeEnum.INF_GRID]: GUARDIAN_API.BLOCKS.INF_QUERY,
            [GridTypeEnum.PDD_GRID]: GUARDIAN_API.BLOCKS.PDD_QUERY,
            [GridTypeEnum.VALIDATION_GRID]:
                GUARDIAN_API.BLOCKS.VALIDATION_QUERY,
            [GridTypeEnum.ACTIVITY_GRID]: GUARDIAN_API.BLOCKS.ACTIVITY_QUERY,
            [GridTypeEnum.MONITORING_GRID]:
                GUARDIAN_API.BLOCKS.MONITORING_QUERY,
            [GridTypeEnum.VERIFICATION_GRID]:
                GUARDIAN_API.BLOCKS.VERIFICATION_QUERY,
        };
        if (!gridMappings[grid]) {
            throw new Error(`Unsupported grid type: ${grid}`);
        }
        return gridMappings[grid];
    }

    private async getAuthenticatedUserToken(email: string): Promise<string> {
        const user = await this.usersRepository.findOne({ where: { email } });
        return this.getAccessToken(user.refreshToken);
    }

    private async applyFilters(
        policyId: string,
        token: string,
        filterType: string,
        filterValue: string,
    ) {
        const filterBlock = this.utilService.getBlock(filterType);

        if (!filterBlock) {
            this.logger.warn(`Filter not found, skipping the ${filterType}`);
            return;
        }

        const filterUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${filterBlock}`,
        );

        const filterResponse = await axios.post(
            filterUrl,
            { filterValue },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        if (filterResponse.status !== HttpStatus.OK) {
            throw new Error(`Failed to apply filter: ${filterType}`);
        }
    }

    private async fetchGridData(
        gridApis: GridInterface,
        policyId: string,
        token: string,
    ) {
        const gridUrl = this.buildGuardianUrl(
            `/api/v1/policies/${policyId}/blocks/${this.utilService.getBlock(gridApis.GRID)}`,
        );

        const gridResponse = await axios.get(gridUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (gridResponse.status !== HttpStatus.OK) {
            throw new Error('Failed to fetch grid data');
        }

        return gridResponse.data?.data || [];
    }

    public async getGridDataUsingRefId(
        grid: GridTypeEnum,
        refId: string,
        email: string,
    ): Promise<any> {
        const gridApis = this.getGridApi(grid);
        const token = await this.getAuthenticatedUserToken(email);
        const policyId = this.configService.get('policy.id');

        await this.applyFilters(
            policyId,
            token,
            gridApis.FILTER_NOT_STATUS,
            'REVOKED',
        );
        await this.applyFilters(policyId, token, gridApis.FILTER_REF_ID, refId);

        const gridData = await this.fetchGridData(gridApis, policyId, token);

        const fullVCDocument = gridData.find(
            (response: any) =>
                response?.document?.credentialSubject[0]?.refId === refId,
        );
        if (!fullVCDocument) {
            throw new Error('No document found for the given refId');
        }

        return fullVCDocument.document?.credentialSubject[0];
    }

    public async getGridDataUsingProjectId(
        grid: GridTypeEnum,
        projectId: string,
        email: string,
    ): Promise<any> {
        const gridApis = this.getGridApi(grid);
        const token = await this.getAuthenticatedUserToken(email);
        const policyId = this.configService.get('policy.id');

        await this.applyFilters(
            policyId,
            token,
            gridApis.FILTER_NOT_STATUS,
            'REVOKED',
        );
        await this.applyFilters(
            policyId,
            token,
            gridApis.FILTER_PROJECT_ID,
            projectId,
        );

        const gridData = await this.fetchGridData(gridApis, policyId, token);

        const fullVCDocuments = gridData.map(
            (response: any) => response?.document?.credentialSubject[0],
        );
        if (!fullVCDocuments.length) {
            throw new Error('No document found for the given project ID');
        }

        return fullVCDocuments;
    }

    public async getGridDataUsingActivityId(
        grid: GridTypeEnum,
        activityId: string,
        email: string,
    ): Promise<any> {
        const gridApis = this.getGridApi(grid);
        const token = await this.getAuthenticatedUserToken(email);
        const policyId = this.configService.get('policy.id');

        await this.applyFilters(
            policyId,
            token,
            gridApis.FILTER_NOT_STATUS,
            'REVOKED',
        );

        await this.applyFilters(
            policyId,
            token,
            gridApis.FILTER_ACTIVITY_ID,
            activityId,
        );

        const gridData = await this.fetchGridData(gridApis, policyId, token);

        const fullVCDocuments = gridData.map(
            (response: any) => response?.document?.credentialSubject[0],
        );
        if (!fullVCDocuments.length) {
            throw new Error('No document found for the given project ID');
        }

        return fullVCDocuments;
    }

    public async getGridDocumentUsingRefId(
        grid: GridTypeEnum,
        refId: string,
        email: string,
    ): Promise<any> {
        const gridApis = this.getGridApi(grid);
        const token = await this.getAuthenticatedUserToken(email);
        const policyId = this.configService.get('policy.id');

        await this.applyFilters(
            policyId,
            token,
            gridApis.FILTER_NOT_STATUS,
            'REVOKED',
        );

        // const gridDataOne = await this.fetchGridData(gridApis, policyId, token);
        // console.log('---------------One----------', gridDataOne);

        await this.applyFilters(policyId, token, gridApis.FILTER_REF_ID, refId);

        const gridData = await this.fetchGridData(gridApis, policyId, token);
        // console.log('---------------Two----------', gridData);
        const fullVCDocument = gridData.find(
            (response: any) =>
                response?.document?.credentialSubject[0]?.refId === refId,
        );
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
        const gridApis = this.getGridApi(grid);
        const token = await this.getAuthenticatedUserToken(email);
        const policyId = this.configService.get('policy.id');

        await this.applyFilters(
            policyId,
            token,
            gridApis.FILTER_NOT_STATUS,
            'REVOKED',
        );
        await this.applyFilters(policyId, token, gridApis.FILTER_REF_ID, refId);

        const gridData = await this.fetchGridData(gridApis, policyId, token);

        const fullVCDocument = gridData.find(
            (response: any) =>
                response?.document?.credentialSubject[0]?.refId === refId,
        );
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
            console.log(error);
            await this.getGuardianError(error, 'createEntity');
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
        try {
            const buttonUrl = this.buildGuardianUrl(
                // eslint-disable-next-line max-len
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${this.utilService.getBlock(buttonBlockName)}`,
            );
            const refreshToken = await this.getRefreshToken(requestUserEmail);
            let buttonType: ButtonTypeEnum = ButtonTypeEnum.SELECTOR;

            // Check if Remark Exists
            if (remarks?.trim()) {
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
            throw new HttpException(
                'Action Failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
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
