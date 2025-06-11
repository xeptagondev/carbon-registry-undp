import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
    Client,
    AccountId,
    PrivateKey,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TokenAssociateTransaction,
    TokenMintTransaction,
    TransactionReceipt,
    TransferTransaction,
    TokenBurnTransaction,
    Hbar,
} from '@hashgraph/sdk';
import { ConfigService } from '@nestjs/config';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';

@Injectable()
export class CarbonCreditGuardianService implements OnModuleDestroy {
    private client: Client;

    constructor(
        private readonly configService: ConfigService,
        private readonly instantLogger: InstantLogger,
    ) {}

    async createProjectNFT(
        accountId: string,
        privateKey: string,
        maxSupply: number,
    ): Promise<string> {
        const client = Client.forTestnet();
        const treasuryAccountId = AccountId.fromString(accountId);
        const treasuryPrivateKey = PrivateKey.fromStringED25519(privateKey);
        client.setOperator(treasuryAccountId, treasuryPrivateKey);

        const tokenCreateTx = await new TokenCreateTransaction()
            // .setTokenName(this.configService.get('carbonCredit.tokenName'))
            // .setTokenSymbol(this.configService.get('carbonCredit.tokenSymbol'))
            .setTokenName('CRU')
            .setTokenSymbol('CRU')
            .setTokenType(TokenType.NonFungibleUnique)
            .setDecimals(0)
            .setInitialSupply(0)
            .setTreasuryAccountId(treasuryAccountId)
            .setSupplyType(TokenSupplyType.Finite)
            .setMaxSupply(maxSupply)
            .setSupplyKey(treasuryPrivateKey)
            .freezeWith(client);

        const tokenCreateSign = await tokenCreateTx.sign(treasuryPrivateKey);
        const tokenCreateSubmit = await tokenCreateSign.execute(client);
        const receipt: TransactionReceipt =
            await tokenCreateSubmit.getReceipt(client);
        const newTokenId = receipt.tokenId!.toString();
        return newTokenId;
    }

    async associateNFTToUser(
        tokenId: string,
        accountId: string,
        privateKey: string,
    ): Promise<void> {
        const client = Client.forTestnet();
        const treasuryAccountId = AccountId.fromString(accountId);
        const treasuryPrivateKey = PrivateKey.fromStringED25519(privateKey);
        client.setOperator(treasuryAccountId, treasuryPrivateKey);
        const associateTx = await new TokenAssociateTransaction()
            .setAccountId(AccountId.fromString(accountId))
            .setTokenIds([tokenId])
            .freezeWith(client);

        const associateSign = await associateTx.sign(treasuryPrivateKey);
        const associateSubmit = await associateSign.execute(client);
        await associateSubmit.getReceipt(client);
    }

    async mintProjectNFT(
        tokenId: string,
        metadata: Uint8Array,
        amount: number,
        accountId: string,
        privateKey: string,
    ): Promise<any> {
        const client = Client.forTestnet();
        const treasuryAccountId = AccountId.fromString(accountId);
        const treasuryPrivateKey = PrivateKey.fromStringED25519(privateKey);
        client.setOperator(treasuryAccountId, treasuryPrivateKey);

        const serials: any[] = [];
        const batchSize = 10;

        for (let i = 0; i < amount; i += batchSize) {
            const currentBatchSize = Math.min(batchSize, amount - i);
            const metadataArray: Uint8Array[] =
                Array(currentBatchSize).fill(metadata);

            try {
                const mintTx = await new TokenMintTransaction()
                    .setTokenId(tokenId)
                    .setMetadata(metadataArray)
                    .freezeWith(client);

                const mintSign = await mintTx.sign(treasuryPrivateKey);
                const mintSubmit = await mintSign.execute(client);
                const receipt: TransactionReceipt =
                    await mintSubmit.getReceipt(client);

                if (receipt.serials) {
                    serials.push(...receipt.serials);
                }

                console.log(
                    `Minted ${currentBatchSize} NFTs, total minted so far: ${serials.length}`,
                );
            } catch (error) {
                console.error(
                    `Failed to mint batch starting from ${i + 1}:`,
                    error.message,
                );
                throw new Error(
                    `Minting failed for batch starting from ${i + 1}: ${error.message}`,
                );
            }
        }

        return serials;
    }

    async transferProjectNFT(
        tokenId: string,
        serial: number,
        senderAccountId: string,
        senderPrivateKey: string,
        receiverAccountId: string,
    ): Promise<any> {
        const client = Client.forTestnet();
        const senderId = AccountId.fromString(senderAccountId);
        const senderKey = PrivateKey.fromStringED25519(senderPrivateKey);
        client.setOperator(senderId, senderKey);

        const transferTx = await new TransferTransaction()
            .addNftTransfer(tokenId, serial, senderAccountId, receiverAccountId)
            .freezeWith(client);

        const transferSign = await transferTx.sign(senderKey);
        const transferSubmit = await transferSign.execute(client);
        const receipt: TransactionReceipt =
            await transferSubmit.getReceipt(client);

        return receipt.status;
    }

    async retireProjectNFT(
        tokenId: string,
        serial: number,
        userAccountId: string,
        userPrivateKeyStr: string,
        supplyKeyStr: string,
        treasuryAccountId: string,
        treasuryPrivateKeyStr: string,
    ): Promise<string> {
        if (userAccountId !== treasuryAccountId) {
            const userClient = Client.forTestnet().setOperator(
                AccountId.fromString(userAccountId),
                PrivateKey.fromStringED25519(userPrivateKeyStr),
            );

            const transferTx = await new TransferTransaction()
                .addNftTransfer(
                    tokenId,
                    serial,
                    userAccountId,
                    treasuryAccountId,
                )
                .setMaxTransactionFee(new Hbar(5))
                .freezeWith(userClient);

            const transferSign = await transferTx.sign(
                PrivateKey.fromStringED25519(userPrivateKeyStr),
            );
            const transferSubmit = await transferSign.execute(userClient);
            const transferReceipt = await transferSubmit.getReceipt(userClient);

            if (transferReceipt.status.toString() !== 'SUCCESS') {
                throw new Error(
                    `Failed to transfer NFT to treasury: ${transferReceipt.status}`,
                );
            }
        }

        const supplyClient = Client.forTestnet().setOperator(
            AccountId.fromString(treasuryAccountId),
            PrivateKey.fromStringED25519(treasuryPrivateKeyStr),
        );

        const burnTx = await new TokenBurnTransaction()
            .setTokenId(tokenId)
            .setSerials([serial])
            .setMaxTransactionFee(new Hbar(5))
            .freezeWith(supplyClient);

        const burnSign = await burnTx.sign(
            PrivateKey.fromStringED25519(supplyKeyStr),
        );

        const burnSubmit = await burnSign.execute(supplyClient);
        const burnReceipt: TransactionReceipt =
            await burnSubmit.getReceipt(supplyClient);

        return burnReceipt.status.toString();
    }

    onModuleDestroy() {
        if (this.client) {
            this.client.close();
            this.instantLogger.log('Hedera client closed.');
        }
    }
}
