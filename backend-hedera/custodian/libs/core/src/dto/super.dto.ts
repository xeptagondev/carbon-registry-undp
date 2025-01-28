import { SuperEntity } from '../entity/super.entity';
import { Unwrappable } from '../util/unwrappable';

export abstract class SuperDTO<T extends SuperEntity> extends Unwrappable<T> {}
