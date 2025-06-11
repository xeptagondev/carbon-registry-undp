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

    // it('should run project NFT flow', async () => {
    //     const accountId = '0.0.5143903';
    //     const privateKey = '##';
    //     const operatorId = AccountId.fromString(accountId);
    //     const operatorKey = PrivateKey.fromStringED25519(privateKey);
    //     const client = Client.forTestnet();
    //     client.setOperator(operatorId, operatorKey);

    //     const tokenId = await service.createProjectNFT(
    //         accountId,
    //         privateKey,
    //         1000,
    //     );
    //     expect(tokenId).toBeDefined();
    //     console.log('Created NFT Token ID:', tokenId);

    //     // await service.associateNFTToUser(tokenId, accountId, privateKey);
    //     // console.log('Associated NFT with user account:', userAccountId);

    //     const metadata = Uint8Array.from(Buffer.from('NFT #1', 'utf8'));
    //     const mintedSerials = await service.mintProjectNFT(
    //         tokenId,
    //         metadata,
    //         10,
    //         accountId,
    //         privateKey,
    //     );
    //     expect(mintedSerials).toBeDefined();
    //     console.log(
    //         'Minted NFT serials:',
    //         mintedSerials.map((serial) => serial.toNumber()),
    //     );
    // }, 30000);

    it('should run token transfer flow', async () => {
        // Sender details
        const senderAccountId = '0.0.5143903';
        const senderPrivateKey =
            '302e020100300506032b6570042204208c4b9fc63c8e166990072f8000be1a29bcea81ac437d895891d5b3e52fd8871a';
        const senderOperatorId = AccountId.fromString(senderAccountId);
        const senderOperatorKey =
            PrivateKey.fromStringED25519(senderPrivateKey);
        const client = Client.forTestnet();
        client.setOperator(senderOperatorId, senderOperatorKey);

        const receiverAccountId = '0.0.5721214';
        const receiverPrivateKey =
            '302e020100300506032b6570042204200081c7d4c4b99ab5e45ff140cb119c81df87408ddd4929f7b6399bea16af7539';

        const tokenId = await service.createProjectNFT(
            senderAccountId,
            senderPrivateKey,
            1000,
        );
        expect(tokenId).toBeDefined();
        console.log('Created NFT Token ID:', tokenId);

        // Mint an NFT for transfer
        const metadata = Uint8Array.from(
            Buffer.from('NFT for transfer', 'utf8'),
        );
        const mintedSerials = await service.mintProjectNFT(
            tokenId,
            metadata,
            1,
            senderAccountId,
            senderPrivateKey,
        );
        expect(mintedSerials).toBeDefined();
        const serialToTransfer = mintedSerials[0];
        console.log('Minted NFT serial:', serialToTransfer.toNumber());

        await service.associateNFTToUser(
            tokenId,
            receiverAccountId,
            receiverPrivateKey,
        );
        console.log('Associated NFT with receiver account:', receiverAccountId);

        // Now transfer the minted NFT from sender to receiver.
        const transferStatus = await service.transferProjectNFT(
            tokenId,
            serialToTransfer.toNumber(),
            senderAccountId,
            senderPrivateKey,
            receiverAccountId,
        );
        expect(transferStatus).toBeDefined();
        console.log('Transfer status:', transferStatus);

        const supplyKey = senderPrivateKey;
        const treasuryAccountId = senderAccountId;

        const retireStatus = await service.retireProjectNFT(
            tokenId,
            serialToTransfer.toNumber(),
            receiverAccountId,
            receiverPrivateKey,
            supplyKey,
            senderAccountId,
            senderPrivateKey,
        );
        expect(retireStatus).toBeDefined();
        console.log('Retire status:', retireStatus);
    }, 30000);
});
