import { Test, TestingModule } from '@nestjs/testing';
import { CarbonCreditGuardianService } from './carbon-credit-guardian.service';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import { ConfigService } from '@nestjs/config';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';

describe('CarbonCreditGuardianService', () => {
    let service: CarbonCreditGuardianService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CarbonCreditGuardianService,
                {
                    provide: ConfigService,
                    useValue: {
                        carbonCredit: {
                            tokenName: 'CRU',
                            tokenSymbol: 'CRU',
                        },
                    },
                },
                {
                    provide: InstantLogger,
                    useValue: {
                        log: jest.fn(),
                        error: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<CarbonCreditGuardianService>(
            CarbonCreditGuardianService,
        );
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should run project NFT flow', async () => {
        const accountId = '0.0.5143903';
        const privateKey = '###';
        const operatorId = AccountId.fromString(accountId);
        const operatorKey = PrivateKey.fromStringED25519(privateKey);
        const client = Client.forTestnet();
        client.setOperator(operatorId, operatorKey);

        const tokenId = await service.createProjectNFT(
            accountId,
            privateKey,
            1000,
        );
        expect(tokenId).toBeDefined();
        console.log('Created NFT Token ID:', tokenId);

        // await service.associateNFTToUser(tokenId, accountId, privateKey);
        // console.log('Associated NFT with user account:', userAccountId);

        const metadata = Uint8Array.from(Buffer.from('NFT #1', 'utf8'));
        const mintedSerials = await service.mintProjectNFT(
            tokenId,
            metadata,
            10,
            accountId,
            privateKey,
        );
        expect(mintedSerials).toBeDefined();
        const txTokenMintId = mintedSerials?.transactionId?.toString();
        console.log('id', txTokenMintId);
        console.log('Minted NFT serials:', mintedSerials);
    }, 30000);
});
