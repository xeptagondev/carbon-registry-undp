import { ApiProperty } from '@nestjs/swagger';
export class ProjectDto {
    @ApiProperty({
        type: Object,
    })
    data: any;
}
