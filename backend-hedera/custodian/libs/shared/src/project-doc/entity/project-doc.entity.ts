import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ProjectDocEntity {
    @PrimaryGeneratedColumn()
    id: number;
}
