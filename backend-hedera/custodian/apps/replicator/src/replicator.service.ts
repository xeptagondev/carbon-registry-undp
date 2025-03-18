/* eslint-disable no-constant-condition */
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ReplicatorService implements OnModuleInit {
    onModuleInit() {
        while (true) {
            return;
        }
    }
}
