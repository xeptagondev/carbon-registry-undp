import { ButtonActionEnum } from '../enum/button-type.enum';

export interface ButtonPayloadInterface {
    document: string;
    tag: ButtonActionEnum;
}
