import { registerDecorator, ValidationOptions } from "class-validator";

export function IsFutureTimeStamp( validationOptions?: ValidationOptions ) {
  return function (object: Object, propertyName: string) {
    return registerDecorator({
      name: "isFutureTimeStamp",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: number) {
          if (typeof value !== "number") {
            return false;
          }
          const currentTime = Date.now() / 1000;
          return value > currentTime;
        },
        defaultMessage() {
          return "$property must be a future date";
        },
      },
    });
  };
}