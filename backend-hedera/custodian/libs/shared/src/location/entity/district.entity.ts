import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class District {
    @PrimaryColumn()
    key: string;

    @Column()
    countryAlpha2: string;

    @Column()
    provinceName: string;

    @Column()
    districtName: string;

    @Column()
    lang: string;

    @Column({
        type: 'jsonb',
        array: false,
        nullable: true,
    })
    geoCoordinates: any;
}
