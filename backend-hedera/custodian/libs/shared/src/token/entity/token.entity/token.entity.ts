import { SuperEntity } from '@app/core/entity/super.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class TokenEntity extends SuperEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ unique: true })
    email: string;

    @Column()
    token: string;

    @Column({ type: 'bigint', nullable: false })
    createTime: number;

    @Column({ type: 'bigint', nullable: false })
    expireTime: number;
}
