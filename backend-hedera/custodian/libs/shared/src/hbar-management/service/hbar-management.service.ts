/* eslint-disable no-magic-numbers */
import { Injectable } from '@nestjs/common';
import { Client, AccountBalanceQuery } from '@hashgraph/sdk';
import { TransactionType } from '../enum/transaction-type.enum';
import axios from 'axios';
import { MirrorExchangeRateInterface } from '../interface/mirror-exchange-rate.interface';
import { ConfigService } from '@nestjs/config';
import { HederaNetworkTypeEnum } from '../enum/hedera-network-type.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';

@Injectable()
export class HbarManagementService {
    private readonly client: Client;

    constructor(private readonly configService: ConfigService, private readonly logger: InstantLogger) {}

    async getBalance(accountId: string): Promise<string> {
        try {
            const hederaNetworkType = this.configService.get(
                'guardian.hederaNetwork',
            );
            const client =
                hederaNetworkType == HederaNetworkTypeEnum.TEST_NET
                    ? Client.forTestnet()
                    : hederaNetworkType == HederaNetworkTypeEnum.MAIN_NET
                      ? Client.forMainnet()
                      : Client.forPreviewnet();
            const balanceQuery = new AccountBalanceQuery().setAccountId(
                accountId,
            );

            const balance = await balanceQuery.execute(client);
            return balance.hbars.toString().trim().replace('ℏ', '');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            this.logger.error(`Balance error: ${error}\nstacktrace: ${error.stack}`)
            return '0';
        }
    }

    async getCurrentExchangeRate(): Promise<MirrorExchangeRateInterface> {
        const url =
            this.configService.get('guardian.exchangeRateApi') ||
            'https://testnet.mirrornode.hedera.com/api/v1/network/exchangerate';
        const response = await axios.get(url);
        return response.data;
    }

    async getTransactionCosts(
        transactionType: TransactionType,
    ): Promise<number> {
        let costInUsd: number;
        switch (transactionType) {
            case TransactionType.TOKEN_CREATION:
                costInUsd = 2.0;
                break;
            case TransactionType.TOKEN_ASSOCIATION:
                costInUsd = 0.05;
                break;
            case TransactionType.TOKEN_MINT:
                costInUsd = 0.02;
                break;
            case TransactionType.TOKEN_TRANSFER:
                costInUsd = 0.1;
                break;
            case TransactionType.TOKEN_BURN:
                costInUsd = 0.001;
                break;
            default:
                costInUsd = 0.001;
                break;
        }

        const exchangeRateData = await this.getCurrentExchangeRate();
        const currentRate = exchangeRateData.current_rate;
        const costPerHbarCents =
            currentRate.cent_equivalent / currentRate.hbar_equivalent;
        const costInCents = costInUsd * 100;
        const costInHbar = costInCents / costPerHbarCents;

        return costInHbar ? Number(costInHbar) : 0;
    }

    onModuleDestroy() {
        if (this.client) {
            this.client.close();
        }
    }
}
