/* eslint-disable no-magic-numbers */
import { pbkdf2Sync, randomBytes, randomInt } from 'crypto';
import {
    HASH_ALGO,
    HASH_ITR,
    PASSWORD_SPECIAL_CHARS,
    SALT_LEN,
} from './constants/util.constants';

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
export function verifyPassword(
    password: string,
    storedHash: string,
    keyLen: number = 32,
    hashAlgo: string = HASH_ALGO,
): boolean {
    const [salt, originalHash, itr] = storedHash.split(':');
    const hash = pbkdf2Sync(
        password,
        salt,
        parseInt(itr),
        keyLen,
        hashAlgo,
    ).toString('hex');

    return hash === originalHash;
}
