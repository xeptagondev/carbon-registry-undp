import {ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, ValidationOptions, registerDecorator } from "class-validator";

@ValidatorConstraint({ name: 'isValidGSPCoordinate', async: false })
export class isValidGSPCoordinateConstraint implements ValidatorConstraintInterface {
    validate(value: any, validationArguments?: ValidationArguments): Promise<boolean> | boolean {
        // Check if the value is an array with exactly two elements
        if (!Array.isArray(value) || value.length === 0) {
            return false;
        }
       for (const pair of value) {
            if (!Array.isArray(pair) || pair.length !== 2) {
                return false;
            }
            const [latitude, longitude] = pair;
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                return false;
            }
            const isValidLatitude = latitude >= -90 && latitude <= 90;
            const isValidLongitude = longitude >= -180 && longitude <= 180;
            if (!isValidLatitude || !isValidLongitude) {
                return false;
            }
        }
        return true;  
    }
    defaultMessage(args: ValidationArguments) {
        return `${args.property} must be a valid GSP coordinate` ;
    }
}

export function isValidGSPCoordinate(validationOptions?: ValidationOptions) {
    return function (object: any, propertyName: string) {
        registerDecorator({
            name: 'isValidGSPCoordinate',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: isValidGSPCoordinateConstraint,
        });
    };
}