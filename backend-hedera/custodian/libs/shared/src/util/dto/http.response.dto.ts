import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class HTTPResponseDto {
    @IsNotEmpty()
    @IsNumber()
    statusCode: number;

    @IsOptional()
    message: string;

    @IsOptional()
    data: any;
}
