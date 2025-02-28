import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['policyId', 'blockName'])
export class PolicyBlocksEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: false })
    blockName: string;

    @Column({ unique: true })
    blockId: string;

    @Column()
    policyId: string;
}
