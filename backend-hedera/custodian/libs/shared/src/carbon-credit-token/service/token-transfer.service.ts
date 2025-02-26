import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
    AccountId,
    PrivateKey,
    Client,
    TransferTransaction,
    TransactionReceipt,
} from '@hashgraph/sdk';
import { ConfigService } from '@nestjs/config';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';

@Injectable()
export class TokenTransferService implements OnModuleDestroy {
    private client: Client;
    private accountId: AccountId;
    private privateKey: PrivateKey;

    constructor(
        private readonly configService: ConfigService,
        private readonly instantLogger: InstantLogger,
    ) {}

    async transferToken(
        tokenId: string,
        receiverAccount: string,
    ): Promise<{ status: string; txId: string }> {
        try {
            // Load Hedera credentials from environment variables
            const accountIdStr =
                this.configService.get<string>('HEDERA_ACCOUNT_ID');
            const privateKeyStr =
                this.configService.get<string>('HEDERA_PRIVATE_KEY');

            if (!accountIdStr || !privateKeyStr) {
                throw new Error(
                    'Hedera credentials are not set in the environment variables.',
                );
            }

            this.accountId = AccountId.fromString(accountIdStr);
            this.privateKey = PrivateKey.fromStringED25519(privateKeyStr);

            this.client = Client.forTestnet();
            this.client.setOperator(this.accountId, this.privateKey);
            const transferTx = await new TransferTransaction()
                .addTokenTransfer(tokenId, this.accountId, -1) // Sender
                .addTokenTransfer(tokenId, receiverAccount, 1) // Receiver
                .freezeWith(this.client);

            // Sign with sender's private key
            const signedTx = await transferTx.sign(this.privateKey);

            // Execute transaction
            const txResponse = await signedTx.execute(this.client);

            // Get transaction receipt
            const receipt: TransactionReceipt = await txResponse.getReceipt(
                this.client,
            );
            const status = receipt.status.toString();
            const txId = txResponse.transactionId.toString();

            this.instantLogger.log(
                '--------------------------------- Token Transfer ---------------------------------',
            );
            this.instantLogger.log('Receipt Status:', status);
            this.instantLogger.log('Transaction ID:', txId);
            this.instantLogger.log(
                'Hashscan URL:',
                `https://hashscan.io/testnet/tx/${txId}`,
            );

            return { status, txId };
        } catch (error) {
            this.instantLogger.error('Error during token transfer:', error);
            throw new Error('Token transfer failed.');
        }
    }

    onModuleDestroy() {
        if (this.client) {
            this.client.close();
            this.instantLogger.log('Hedera client closed.');
        }
    }
}
