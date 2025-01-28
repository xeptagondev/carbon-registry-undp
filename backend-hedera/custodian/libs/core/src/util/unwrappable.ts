import 'reflect-metadata';

/* eslint-disable func-names */
const UNWRAP_METADATA_KEY = Symbol('unwrap');

interface UnwrapOptions {
    name?: string; // whether the field name needs to be mapped to another when unwrapping
    exclude?: boolean; // whether the field needs to be excluded when unwrapping
}

export function Unwrap(options: UnwrapOptions = {}) {
    return function (target: any, propertyKey: string) {
        const existingMetadata =
            Reflect.getMetadata(UNWRAP_METADATA_KEY, target) || {};
        Reflect.defineMetadata(
            UNWRAP_METADATA_KEY,
            {
                ...existingMetadata,
                [propertyKey]: {
                    mapTo: options.name || propertyKey,
                    exclude: options.exclude || false,
                },
            },
            target,
        );
    };
}

export abstract class Unwrappable<T extends object> {
    unwrap(): Partial<T> {
        const metadata =
            Reflect.getMetadata(
                UNWRAP_METADATA_KEY,
                this.constructor.prototype,
            ) || {};

        const result: Partial<T> = {};

        for (const [key, options] of Object.entries(metadata) as [
            string,
            any,
        ][]) {
            const value = this[key];

            // skip exluded properties
            if (options.exclude) {
                continue;
            }

            if (value && typeof value.unwrap === 'function') {
                // if nested
                result[options.mapTo] = value.unwrap();
            } else {
                result[options.mapTo] = value;
            }
        }

        return result;
    }
}
