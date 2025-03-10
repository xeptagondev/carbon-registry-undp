/* eslint-disable no-magic-numbers */
import { pbkdf2Sync, randomBytes, randomInt } from 'crypto';
import {
    HASH_ALGO,
    HASH_ITR,
    PASSWORD_SPECIAL_CHARS,
    SALT_LEN,
} from './constants/util.constants';
import * as crypto from 'crypto';

/*
Generate a password of given length including at least:
    - one uppercase letter
    - one lower case letter
    - one number
    - one special character from the special characters list
*/
export function generatePassword(length: number): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialChars = PASSWORD_SPECIAL_CHARS;
    const allChars = uppercase + lowercase + numbers + specialChars;

    const pickRandom = (charsSet: string) =>
        charsSet[randomInt(0, charsSet.length)];

    const requiredChars = [
        pickRandom(uppercase),
        pickRandom(lowercase),
        pickRandom(numbers),
        pickRandom(specialChars),
    ];

    // Fill the length
    while (requiredChars.length < length) {
        requiredChars.push(pickRandom(allChars));
    }

    // Shuffle array (Fisher Yates algo)
    for (let i = requiredChars.length - 1; i > 0; i--) {
        const j = randomInt(0, i + 1);
        [requiredChars[i], requiredChars[j]] = [
            requiredChars[j],
            requiredChars[i],
        ];
    }

    return requiredChars.join('');
}

export function hashPassword(
    password: string,
    saltLen: number = SALT_LEN,
    keyLen: number = 32,
    hashAlgo: string = HASH_ALGO,
): string {
    const salt = randomBytes(saltLen).toString('hex');
    const hash = pbkdf2Sync(
        password,
        salt,
        HASH_ITR,
        keyLen,
        hashAlgo,
    ).toString('hex');

    return `${salt}:${hash}:${HASH_ITR}`;
}

// Verify the given password
// password should be in 'salt:hash:iterations' format
// export function verifyPassword(
//     password: string,
//     storedHash: string,
//     keyLen: number = 32,
//     hashAlgo: string = HASH_ALGO,
// ): boolean {
//     const [salt, originalHash, itr] = storedHash.split(':');
//     const hash = pbkdf2Sync(
//         password,
//         salt,
//         parseInt(itr),
//         keyLen,
//         hashAlgo,
//     ).toString('hex');

//     return hash === originalHash;
// }

// Decrypt the password and verify it
export function verifyPassword(
    storedEncryptPassword: string,
    providedPassword: string,
    pwdSecret: string,
): string {
    const { password } = decryptPayload(storedEncryptPassword, pwdSecret);
    return providedPassword === password ? providedPassword : undefined;
}

export function formatRemainingTime(ms: number): string {
    // Input should be in milisecond
    const seconds = Math.ceil(ms / 1000);

    if (seconds < 60) {
        return `${seconds} second${seconds === 1 ? '' : 's'}`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export function getEnumKeyByValue<T>(
    enumObj: T,
    value: T[keyof T],
): keyof T | undefined {
    return Object.keys(enumObj).find(
        (key) => enumObj[key as keyof T] === value,
    ) as keyof T | undefined;
}

export function encryptPayload(payload: any, secretKey: string): string {
    const key = crypto.createHash('sha256').update(secretKey, 'utf8').digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const data = JSON.stringify(payload);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
}

export function decryptPayload(encryptedData: string, secretKey: string): any {
    const key = crypto.createHash('sha256').update(secretKey, 'utf8').digest();
    const [ivHex, encryptedText] = encryptedData.split(':');
    if (!ivHex || !encryptedText) {
        throw new Error('Invalid encrypted data');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}
