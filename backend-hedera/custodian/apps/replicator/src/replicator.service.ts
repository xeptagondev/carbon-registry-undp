import { Injectable } from '@nestjs/common';

@Injectable()
export class ReplicatorService {
  getHello(): string {
    return 'Hello World!';
  }
}
