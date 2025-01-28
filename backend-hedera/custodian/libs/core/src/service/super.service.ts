import { DeleteResult, Repository } from 'typeorm';
import { SuperDTO } from '../dto/super.dto';
import { SuperEntity } from '../entity/super.entity';

export abstract class SuperService<
    K extends SuperEntity,
    V extends SuperDTO<K>,
> {
    constructor(protected readonly selfRepository: Repository<K>) {}

    unwrap(dto: V): any {
        return dto.unwrap();
    }

    async delete(criteria: any): Promise<DeleteResult> {
        return await this.selfRepository.delete(criteria);
    }

    async unwrapAndSave(dto: V): Promise<any> {
        const unwrappedEnt: any = dto.unwrap();
        return await this.selfRepository.save(unwrappedEnt);
    }
}
