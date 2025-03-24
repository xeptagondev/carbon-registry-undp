import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class TokenAssociateEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    tokenId: string;

    @Column()
    accountId: string;

    @Column({ nullable: true, type: 'bigint' })
    createdDate?: number;

    @Column({ nullable: true, type: 'bigint' })
    updatedDate?: number;

    @BeforeInsert()
    generateRefId() {
        if (!this.createdDate) {
            this.createdDate = Date.now();
        }
        if (!this.updatedDate) {
            this.updatedDate = Date.now();
        }
    }

    @BeforeUpdate()
    updateDate() {
        if (!this.updatedDate) {
            this.updatedDate = Date.now();
        }
    }
}
