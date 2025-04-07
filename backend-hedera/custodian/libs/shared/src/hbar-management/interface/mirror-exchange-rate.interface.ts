export interface MirrorExchangeRateInterface {
    current_rate: {
        cent_equivalent: number;
        hbar_equivalent: number;
        expiration_time: string;
        exchange_rate?: number;
    };
    next_rate: {
        cent_equivalent: number;
        hbar_equivalent: number;
        expiration_time: string;
        exchange_rate?: number;
    };
    timestamp: string;
}
