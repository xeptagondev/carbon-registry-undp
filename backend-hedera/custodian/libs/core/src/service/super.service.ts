import { DeleteResult, Repository } from 'typeorm';
import { SuperDTO } from '../dto/super.dto';
import { SuperEntity } from '../entity/super.entity';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';

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

    async validateAccess(
        requiredList: { role: RoleEnum; orgType: OrganizationTypeEnum }[],
        requestData: { role: string; orgType: string },
    ): Promise<boolean> {
        return requiredList.some((required) => {
            return (
                required.role === requestData.role &&
                required.orgType === requestData.orgType
            );
        });
    }
}
