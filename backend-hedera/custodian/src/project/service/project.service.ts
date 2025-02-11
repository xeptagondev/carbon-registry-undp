import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { ProjectDto } from '@app/shared/project/dto/project.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProjectService {
    constructor(
        private readonly helperService: HelperService,
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
    ) {}

    create(projectDto: ProjectDto, user: any): any {
        throw new Error('Method not implemented.');
    }

    public async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.helperService.validateRequestUser(requestUser);
        if (!query.filterAnd) {
            const filterAnd: FilterEntry[] = [];
            query.filterAnd = filterAnd;
        }

        if (
            !(
                requestUser.organizationRole ==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            query.filterAnd.push({
                key: 'organization"."organizationId',
                operation: '=',
                value: requestUser.organizationId,
            });
        }

        //Formatting Query
        // const newToOldFieldMap: Record<string, string> = {
        //     id: 'user"."id',
        //     name: 'user"."name',
        //     email: 'user"."email',
        //     companyRole: 'organizationType"."name',
        //     role: 'role"."name',
        //     companyId: 'organization"."id',
        // };
        // query = this.helperService.mapNewWhereClausetoOldWhereClause(
        //     query,
        //     newToOldFieldMap,
        // );

        const [entities, total] = await this.projectRepository
            .createQueryBuilder('project')
            .leftJoin('project.organization', 'organization')
            // .leftJoin('user.guardianRole', 'guardianRole')
            // .leftJoin('organization.organizationType', 'organizationType')
            // .leftJoin('guardianRole.role', 'role')
            // .addSelect([
            //     'organization',
            //     'guardianRole',
            //     'role',
            //     'organizationType',
            // ])
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getManyAndCount();

        // const oldFormatData = entities.map((user) =>
        //     this.mapNewQueryToOldQuery(user),
        // );
        return new DataListResponseDto(
            entities ? entities : undefined,
            total ? total : undefined,
        );
    }
}
