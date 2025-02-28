import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TaskMonitorService implements OnModuleInit {
    constructor() {}

    async onModuleInit() {
        while (true) {
            console.log('abc');
        }
    }
}
