import { SuperEntity } from '@app/core/entity/super.entity';
import { Column, PrimaryGeneratedColumn } from 'typeorm';

export class TokenEntity extends SuperEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    email: string;

    @Column()
    token: string;

    @Column({ type: 'bigint' })
    createTime: number;

    @Column({ type: 'bigint', nullable: true })
    expireTime: number;
}
