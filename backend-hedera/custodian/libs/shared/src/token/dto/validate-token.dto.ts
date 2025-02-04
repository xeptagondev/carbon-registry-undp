import { IsNotEmpty } from 'class-validator';

export class ValidateTokenDto {
    @IsNotEmpty()
    verificationToken: string;
}
