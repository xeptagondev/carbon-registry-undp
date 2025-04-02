import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { QueryDto } from '../dto/query.dto';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class HelperService {
    constructor(private i18n: I18nService) {}
    public mapNewWhereClausetoOldWhereClause(
        query: QueryDto,
        newToOldFieldMap: Record<string, string>,
    ) {
        if (query.filterAnd) {
            for (const filterEntry of query.filterAnd) {
                if (newToOldFieldMap[filterEntry.key]) {
                    filterEntry.key = newToOldFieldMap[filterEntry.key];
                }
            }
        }
        if (query.filterOr) {
            for (const filterEntry of query.filterOr) {
                if (newToOldFieldMap[filterEntry.key]) {
                    filterEntry.key = newToOldFieldMap[filterEntry.key];
                }
            }
        }
        if (query.sort) {
            if (newToOldFieldMap[query.sort.key]) {
                query.sort.key = newToOldFieldMap[query.sort.key];
            }
        }
        return query;
    }

    /**
     * Validates an object against the validation rules defined in the class.
     *
     * @param cls The class to validate against.
     * @param obj The plain object to validate.
     * @returns true if the object is valid, false otherwise.
     */
    public isValidInstance<T extends object>(
        cls: { new (...args: any[]): T },
        obj: any,
    ): obj is T {
        // Transform the plain object to an instance of the class.
        const instance = plainToInstance(cls, obj);
        // Synchronously validate the instance.
        const errors = validateSync(instance);
        return errors.length === 0;
    }

    public formatReqMessagesString(langTag: string, vargs: any[]) {
        const str: any = this.i18n.t(langTag);
        const parts: any = str.split('{}');
        let insertAt = 1;
        for (const arg of vargs) {
            parts.splice(insertAt, 0, arg);
            insertAt += 2;
        }
        return parts.join('');
    }

    public isBase64(text: string): boolean {
        return Buffer.from(text, 'base64').toString('base64') === text;
    }

    public validateRequestUser(requestUser: JWTPayload) {
        if (!requestUser) {
            throw new HttpException(
                'This action is unauthorised',
                HttpStatus.UNAUTHORIZED,
            );
        }
        if (requestUser.organizationState != OrganizationStateEnum.ACTIVE) {
            throw new HttpException(
                'No active organisation found',
                HttpStatus.UNAUTHORIZED,
            );
        }

        if (!requestUser.userState) {
            throw new HttpException(
                'This action is unauthorised',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    public enumToString(enumObj, value) {
        const keys = Object.keys(enumObj);
        for (const key of keys) {
            if (enumObj[key] === value) {
                return key;
            }
        }
        return null;
    }

    private prepareValue(value: any, table?: string, toLower?: boolean) {
        if (value instanceof Array) {
            return '(' + value.map((e) => `'${e}'`).join(',') + ')';
        } else if (this.isQueryDto(value)) {
            return this.generateWhereSQL(value, undefined, table);
        } else if (typeof value === 'string') {
            if (value === 'NULL') {
                return value;
            }
            if (toLower != true) {
                return "'" + value + "'";
            } else {
                return "LOWER('" + value + "')";
            }
        }
        return value;
    }

    private prepareKey(col: string, table?: string) {
        let key: string;
        if (col.includes('->>')) {
            const parts = col.split('->>');
            key = `"${parts[0]}"->>'${parts[1]}'`;
        } else {
            key = `"${col}"`;
        }
        return `${table ? table + '.' : ''}${key}`;
    }

    private isLower(key: string) {
        if (
            [
                // 'email',
                // 'name',
                // 'companyName',
                // 'taxId',
                // 'country',
                // 'title',
                // 'externalId',
                // 'serialNo',
                // 'programmeTitle',
                // 'programmeName',
                // 'id',
                'organization"."name',
                'user"."name',
                'user"."email',
                'receiver"."name',
                'creditBlock"."type',
                'project"."title',
            ].includes(key)
        )
            return true;
    }

    private isQueryDto(obj) {
        if (
            obj &&
            typeof obj === 'object' &&
            (obj['filterAnd'] || obj['filterOr'])
        ) {
            return true;
        }
        return false;
    }

    public generateWhereSQL(
        query: QueryDto,
        extraSQL?: string,
        table?: string,
        ignoreCol?: string[],
    ) {
        let sql = '';
        if (query.filterAnd) {
            if (ignoreCol) {
                query.filterAnd = query.filterAnd.filter(
                    (e) => ignoreCol.indexOf(e.key) >= 0,
                );
            }
            sql += query.filterAnd
                .map((e) => {
                    if (this.isQueryDto(e.value)) {
                        return `(${this.prepareValue(e.value, table)})`;
                    } else if (e.operation === 'ANY') {
                        return `${this.prepareValue(
                            e.value,
                            table,
                        )} = ANY(${this.prepareKey(e.key, table)})`;
                    } else if (e.keyOperation) {
                        return `${e.keyOperation}(${this.prepareKey(e.key, table)}) ${
                            e.operation
                        } ${this.prepareValue(e.value, table, true)}`;
                    } else if (
                        this.isLower(e.key) &&
                        typeof e.value === 'string'
                    ) {
                        return `LOWER(${this.prepareKey(e.key, table)}) ${
                            e.operation
                        } ${this.prepareValue(e.value, table, true)}`;
                    } else {
                        return `${this.prepareKey(e.key, table)} ${
                            e.operation
                        } ${this.prepareValue(e.value, table)}`;
                    }
                })
                .join(' and ');
        }
        if (query.filterOr) {
            if (ignoreCol) {
                query.filterOr = query.filterOr.filter(
                    (e) => ignoreCol.indexOf(e.key) >= 0,
                );
            }
            const orSQl = query.filterOr
                .map((e) => {
                    if (this.isQueryDto(e.value)) {
                        return `(${this.prepareValue(e.value, table)})`;
                    } else if (e.operation === 'ANY') {
                        return `${this.prepareValue(
                            e.value,
                            table,
                        )} = ANY(${this.prepareKey(e.key, table)})`;
                    } else if (e.keyOperation) {
                        return `${e.keyOperation}(${this.prepareKey(e.key, table)}) ${
                            e.operation
                        } ${this.prepareValue(e.value, table, true)}`;
                    } else if (
                        this.isLower(e.key) &&
                        typeof e.value === 'string'
                    ) {
                        return `LOWER(${this.prepareKey(e.key, table)}) ${
                            e.operation
                        } ${this.prepareValue(e.value, table, true)}`;
                    } else {
                        return `${this.prepareKey(e.key, table)} ${
                            e.operation
                        } ${this.prepareValue(e.value, table)}`;
                    }
                })
                .join(' or ');
            if (sql != '') {
                sql = `(${sql}) and (${orSQl})`;
            } else {
                sql = orSQl;
            }
        }

        if (sql != '') {
            if (extraSQL) {
                sql = `(${sql}) and (${extraSQL})`;
            }
        } else if (extraSQL) {
            sql = extraSQL;
        }

        return sql;
    }

    public formatTimestamp(timestamp: any) {
        if (timestamp) {
            const parsedTimestamp = Number(timestamp);

            if (!isNaN(parsedTimestamp)) {
                const date = new Date(parsedTimestamp);

                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const seconds = date.getSeconds().toString().padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            }
        }
    }
}
