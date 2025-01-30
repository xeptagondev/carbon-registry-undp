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

@Injectable()
export class GuardianService {
    constructor(
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
        @InjectRepository(UsersEntity)
        protected readonly usersRepository: Repository<UsersEntity>,
    ) {}

    async getRefreshToken(username: string) {
        const user: UsersEntity = await this.usersRepository.findOne({
            where: { email: username },
        });
        return user?.refreshToken;
    }
    private buildGuardianUrl(pathKey: string): string {
        return `${this.configService.get('guardian.url')}${this.configService.get(`guardian.${pathKey}`)}`;
    }

    private async getAccessToken(refreshToken: string): Promise<string> {
        try {
            const url = `${this.configService.get('guardian.url')}${this.configService.get(
                'guardian.accessToken',
            )}`;
            console.log(url);
            console.log(refreshToken);
            const accessTokenResponse = await axios.post(url, {
                refreshToken: refreshToken,
            });
            console.log(accessTokenResponse);
            return accessTokenResponse?.data?.accessToken;
        } catch (e) {
            throw e;
        }
    }

    public async registerUser(email: string, password: string): Promise<any> {
        try {
            const url = this.buildGuardianUrl('register');
            const response = await axios.post(url, {
                username: email,
                password,
                password_confirmation: password,
                role: 'USER',
            });
            return response.data;
        } catch (e) {
            throw e;
        }
    }

    public async updateUserProfile(
        email: string,
        refreshToken: string,
        parentDid: string,
        hederaAccount: string,
        hederaKey: string,
    ): Promise<any> {
        try {
            const url = `${this.buildGuardianUrl('profileUpdate')}/${email}`;
            const token = await this.getAccessToken(refreshToken);
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
            throw e;
        }
    }

    public async assignPolicyToUser(
        email: string,
        refreshToken: string,
    ): Promise<any> {
        try {
            const url = `${this.buildGuardianUrl('policyAsign1')}/${email}${this.configService.get(
                'guardian.policyAsign2',
            )}`;

            console.log(url);
            console.log(this.configService.get('policy.id'));
            const token = await this.getAccessToken(refreshToken);
            console.log(token);
            const response = await axios.post(
                url,
                {
                    policyIds: [this.configService.get('policy.id')],
                    assign: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            console.log(response.data);
            return response.data;
        } catch (e) {
            throw e;
        }
    }

    public async createGroupType(
        refreshToken: string,

        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const token = await this.getAccessToken(refreshToken);
            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    public async createOrganization(
        refreshToken: string,
        blockId: string,
        organizationName: string,
        organizationRole: string,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const token = await this.getAccessToken(refreshToken);

            const response = await axios.post(
                url,
                {
                    document: {
                        name: organizationName,
                        role: organizationRole,
                    },
                    ref: null,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    public async createUser(
        refreshToken: string,
        blockId: string,
        username: string,
        organizationName: string,
        organizationRole: string,
        userRole: string,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const token = await this.getAccessToken(refreshToken);

            const response = await axios.post(
                url,
                {
                    document: {
                        name: username,
                        organization: {
                            name: organizationName,
                            role: organizationRole,
                        },
                        role: userRole,
                    },
                    ref: null,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    public async createInvitation(
        refreshToken: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const token = await this.getAccessToken(refreshToken);

            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    }
    public async approve(
        refreshToken: string,
        blockId: string,
        payload: any,
    ): Promise<any> {
        try {
            const url = this.buildGuardianUrl(
                `/api/v1/policies/${this.configService.get('policy.id')}/blocks/${blockId}`,
            );
            const token = await this.getAccessToken(refreshToken);

            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    }
    public async login(loginDto: LoginDto): Promise<any> {
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
                    await await this.usersRepository.update(
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
            throw new HttpException(
                'Guardian User Login Failed',
                HttpStatus.UNAUTHORIZED,
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
