import { DataSource } from 'typeorm';
import { CarbonCreditGuardianService } from './carbon-credit-guardian.service';
import { MintNFTJobPayload } from '../constant/min-nft-payload';
import { CarbonCreditService } from './carbon-credit.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class NftMintProcessor {
    constructor(
        private readonly carbonCreditGuardianService: CarbonCreditGuardianService,
        private readonly carbonCreditService: CarbonCreditService,
        private readonly dataSource: DataSource,
    ) {}

    async handleMintJob(job: MintNFTJobPayload) {
        const {
            tokenId,
            metadata,
            amount,
            accountId,
            privateKey,
            projectRefId,
            receiverRefId,
        } = job;

        try {
            const mintedSerials =
                await this.carbonCreditGuardianService.mintProjectNFT(
                    tokenId,
                    metadata,
                    amount,
                    accountId,
                    privateKey,
                );

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                for (const serial of mintedSerials) {
                    await this.carbonCreditService.issueCredit(
                        tokenId,
                        serial.toString(),
                        projectRefId,
                        receiverRefId,
                        queryRunner,
                    );
                }
                await queryRunner.commitTransaction();
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            throw new HttpException(
                'Failed to handle mint job',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
