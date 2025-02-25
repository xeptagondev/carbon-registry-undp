/* eslint-disable @typescript-eslint/no-unused-vars */
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { PolicyBlocksEntity } from '@app/shared/policy-block/entity/policy-blocks.entity';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { In, Repository } from 'typeorm';

@Injectable()
export class UtilService {
    constructor(
        @InjectRepository(PolicyBlocksEntity)
        private readonly policyBlocksRepository: Repository<PolicyBlocksEntity>,
        private readonly configService: ConfigService,
        private readonly guardianService: GuardianService,
    ) {}
    private tagToIdMap: Record<string, string> = {};

    getBlock(blokName: string) {
        return this.tagToIdMap[blokName];
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
            const sruLoginResponse = await this.guardianService.login({
                username: this.configService.get('sru.username'),
                password: this.configService.get('sru.password'),
            });

            const refreshToken = await this.guardianService.getRefreshToken(
                this.configService.get('sru.username'),
            );
            const response = await axios.get(
                // eslint-disable-next-line max-len
                `${this.configService.get('guardian.url')}${GUARDIAN_API.POLICIES}${this.configService.get('policy.id')}`,
                {
                    headers: {
                        Authorization: `Bearer ${await this.guardianService.accessToken(refreshToken)}`,
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

    public async getBlocksByBlockName(
        blockName: string,
        policyId: string,
    ): Promise<PolicyBlocksEntity> {
        try {
            const block = await this.policyBlocksRepository.findOne({
                where: { policyId: policyId, blockName: blockName },
            });
            return block;
        } catch (error) {
            throw new Error('Failed to execute getBlocksByBlockName');
        }
    }
}
