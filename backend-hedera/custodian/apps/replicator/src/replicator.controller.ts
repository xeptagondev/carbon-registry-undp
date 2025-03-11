import { Controller, Get } from '@nestjs/common';
import { ReplicatorService } from './replicator.service';

@Controller()
export class ReplicatorController {
  constructor(private readonly replicatorService: ReplicatorService) {}

  @Get()
  getHello(): string {
    return this.replicatorService.getHello();
  }
}
