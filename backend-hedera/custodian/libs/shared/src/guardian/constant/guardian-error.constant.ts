export const GUARDIAN_ERROR: Record<number, string> = {
    400: 'There seems to be an issue with the data you provided. Please check and try again.',
    401: 'You are not authorized to perform this action. Please log in and try again.',
    403: 'Access denied. You do not have permission to perform this action.',
    404: 'Account creation failed: The provided Hedera account ID or key is invalid. Please verify and try again.',
    422: 'The data provided is invalid. Please review and correct any errors.',
    500: 'An unexpected server error occurred. Please contact support if the issue persists.',
    502: 'Bad Gateway. The server received an invalid response from the upstream server.',
    503: 'Service Unavailable. The server is currently unable to handle the request due to maintenance or overload.',
};
