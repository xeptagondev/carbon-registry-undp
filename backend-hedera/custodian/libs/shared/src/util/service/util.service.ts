/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEntity } from '@app/shared/event/entity/event.entity';
import { EventStateEnum } from '@app/shared/event/enum/event-state.enum';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { PolicyBlocksEntity } from '@app/shared/policy-block/entity/policy-blocks.entity';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class UtilService {
    constructor(
        @InjectRepository(PolicyBlocksEntity)
        private readonly policyBlocksRepository: Repository<PolicyBlocksEntity>,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
    ) {}
    private tagToIdMap: Record<string, string> = {};

    public async getBlocksByPolicy(
        policyId: string,
    ): Promise<PolicyBlocksEntity[]> {
        try {
            const blocks = await this.policyBlocksRepository.find({
                where: { policyId: policyId },
            });
            return blocks;
        } catch (_) {
            throw new Error('Failed to execute getBlocksByPolicy');
        }
    }

    async setTagToIdMap() {
        this.tagToIdMap = {};
        const policyBlocks = await this.getBlocksByPolicy(
            this.configService.get('policy.id'),
        );
        policyBlocks.forEach((block) => {
            this.tagToIdMap[block.blockName] = block.blockId;
        });
    }

    async fetchPolicyBlocks() {
        const policy = await this.loadPolicyJson();
        this.tagToIdMap = this.mapTagsToIds(policy);
        await this.saveTagIdMap();
    }

    private async loadPolicyJson() {
        try {
            const srUserLoginCredentials: LoginDto = {
                username: this.configService.get('sru.username'),
                password: this.configService.get('sru.password'),
            };

            const loginResponse = await axios.post(
                `${this.configService.get('guardian.url')}${GUARDIAN_API.LOGIN}`,
                srUserLoginCredentials,
            );

            await this.usersRepository.update(
                {
                    email: srUserLoginCredentials.username,
                },
                { refreshToken: loginResponse?.data?.refreshToken },
            );

            const user: UsersEntity = await this.usersRepository.findOne({
                where: { email: srUserLoginCredentials.username },
            });

            const refreshToken = user?.refreshToken;

            const accessTokenResponse = await axios.post(
                `${this.configService.get('guardian.url')}${GUARDIAN_API.ACCESS_TOKEN}`,
                {
                    refreshToken: refreshToken,
                },
            );

            const response = await axios.get(
                // eslint-disable-next-line max-len
                `${this.configService.get('guardian.url')}${GUARDIAN_API.POLICIES}${this.configService.get('policy.id')}`,
                {
                    headers: {
                        Authorization: `Bearer ${
                            accessTokenResponse.data.accessToken
                        }`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            return response.data;
        } catch (e) {
            throw new Error('Failed to fetch the policy');
        }
    }

    mapTagsToIds(policy: any): Record<string, string> {
        const result: Record<string, string> = {};
        function traverse(block: any) {
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
            const policyId = this.configService.get<string>('policy.id');
            const tagIdMap = this.tagToIdMap;
            const policyBlocks = Object.entries(tagIdMap).map(
                ([blockName, blockId]) => ({
                    blockName,
                    blockId,
                    policyId,
                }),
            );

            await this.policyBlocksRepository.upsert(policyBlocks, [
                'policyId',
                'blockName',
            ]);
        } catch (error) {
            throw new Error('Failed to save tagIdMap to PolicyBlocksEntity');
        }
    }

    public async getBlocksByBlockName(
        blockName: string,
        policyId: string,
    ): Promise<PolicyBlocksEntity> {
        try {
            const block = await this.policyBlocksRepository.findOne({
                where: { policyId: policyId, blockName: blockName },
            });
            return block;
        } catch (_) {
            throw new Error('Failed to execute getBlocksByBlockName');
        }
    }

    public async isVerified(
        tableName: string,
        recordId: number,
    ): Promise<boolean> {
        const events: EventEntity[] = await this.dataSource
            .createEntityManager()
            .find(EventEntity, {
                where: {
                    affectedTableName: tableName,
                    affectedRecordId: recordId,
                    status: EventStateEnum.PENDING,
                },
            });

        if (events?.length > 0) {
            return false;
        }
        return true;
    }

    public async verifyRequestUser(requestUser: JWTPayload): Promise<boolean> {
        if (
            !(await this.isVerified(
                'OrganizationEntity',
                requestUser.organizationId,
            ))
        ) {
            throw new HttpException(
                'Organisation not verified',
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        if (!(await this.isVerified('UsersEntity', requestUser.userId))) {
            throw new HttpException(
                'User not verified',
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        return true;
    }
}
