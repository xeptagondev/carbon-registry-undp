import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
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
