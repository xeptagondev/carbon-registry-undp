import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
    AccountId,
    PrivateKey,
    Client,
    TokenBurnTransaction,
    TransactionReceipt,
} from '@hashgraph/sdk';
import { ConfigService } from '@nestjs/config';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';

@Injectable()
export class TokenRetirementService implements OnModuleDestroy {
    private client: Client;
    private accountId: AccountId;
    private privateKey: PrivateKey;
    private supplyPrivateKey: PrivateKey;

    constructor(
        private readonly configService: ConfigService,
        private readonly instantLogger: InstantLogger,
    ) {}

    async retireToken(
        tokenId: string,
        amount: number,
    ): Promise<{ status: string; txId: string }> {
        try {
            // Load Hedera credentials from environment variables
            const accountIdStr =
                this.configService.get<string>('HEDERA_ACCOUNT_ID');
            const privateKeyStr =
                this.configService.get<string>('HEDERA_PRIVATE_KEY');
            const supplyPrivateKeyStr = this.configService.get<string>(
                'HEDERA_SUPPLY_PRIVATE_KEY',
            );

            if (!accountIdStr || !privateKeyStr || !supplyPrivateKeyStr) {
                throw new Error(
                    'Hedera credentials are not set in the environment variables.',
                );
            }

            this.accountId = AccountId.fromString(accountIdStr);
            this.privateKey = PrivateKey.fromStringED25519(privateKeyStr);
            this.supplyPrivateKey =
                PrivateKey.fromStringED25519(supplyPrivateKeyStr);

            // Initialize Hedera client for testnet
            this.client = Client.forTestnet();
            this.client.setOperator(this.accountId, this.privateKey);
            // Create a token burn transaction
            const burnTx = await new TokenBurnTransaction()
                .setTokenId(tokenId) // Set the token ID
                .setAmount(amount) // Set the amount to burn
                .freezeWith(this.client);

            // Sign with the supply private key
            const signedTx = await burnTx.sign(this.supplyPrivateKey);

            // Execute transaction
            const txResponse = await signedTx.execute(this.client);

            // Get transaction receipt
            const receipt: TransactionReceipt = await txResponse.getReceipt(
                this.client,
            );
            const status = receipt.status.toString();
            const txId = txResponse.transactionId.toString();

            this.instantLogger.log(
                '--------------------------------- Burn Token ---------------------------------',
            );
            this.instantLogger.log('Receipt Status:', status);
            this.instantLogger.log('Transaction ID:', txId);
            this.instantLogger.log(
                'Hashscan URL:',
                `https://hashscan.io/testnet/tx/${txId}`,
            );

            return { status, txId };
        } catch (error) {
            this.instantLogger.error('Error during token retirement:', error);
            throw new Error('Token retirement failed.');
        }
    }

    // Cleanup Hedera client when the module is destroyed
    onModuleDestroy() {
        if (this.client) {
            this.client.close();
            this.instantLogger.log('Hedera client closed.');
        }
    }
}
