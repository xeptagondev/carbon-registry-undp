import { HederaNetworkType } from '@app/shared/hbar-management/types/hedera-networks.type';

export default () => ({
    APP_ENV: process.env.APP_ENV || 'dev',
    qaToken: process.env.qaToken || 'qaToken',
    country: process.env.COUNTRY,
    countryCode: process.env.COUNTRY_CODE || 'LK',
    url: process.env.URL,
    backendHost: process.env.BACKEND_HOST || 'http://localhost:3000',
    serialNumber: {
        maxProjectId: parseInt(process.env.MAXIMUM_PROJECT_ID) || 999999,
        creditIdentifier: process.env.CREDIT_IDENTIFIER || 'CA0NNN',
        firstTransferringPartyId:
            process.env.FIRST_TRANSFERRING_PARTY_ID || 'XX',
        seperator: process.env.SERIAL_NUMBER_SEPERATOR || '-',
    },
    carbonCredit: {
        tokenName: 'CRU',
        tokenSymbol: 'CRU',
    },
    docGenerate: {
        ministerName: process.env.MINISTER_NAME || 'Minister X',
        ministerNameAndDesignation:
            process.env.MINISTER_NAME_AND_DESIGNATION ||
            '\nHonorable Minister X\nMinister\nMinistry of Environment, Forestry & Tourism',
        ministryName: 'Ministry of Environment, Forestry & Tourism',
        countryCapital: process.env.COUNTRY_CAPITAL || 'Capital X',
        contactEmailForQuestions:
            process.env.CONTACT_EMAIL || 'contactus@email.com',
    },
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        logging: process.env.DB_LOG_ENABLE || false,
    },
    apiJwt: {
        secret: process.env.API_JWT_SECRET || 'api_jwt_secret',
        expireTimeout: process.env.API_JWT_EXPIRE || '7200s',
        refreshTokenSecret:
            process.env.API_REFRESH_TOKEN_SECRET || 'api_refresh_token_secret',
        refreshTokenExpireTimeout:
            process.env.API_REFRESH_TOKEN_EXPIRE || '7200s',
    },
    mail: {
        isEnable: process.env.IS_EMAIL_ENABLE || false,
        isLowPriorityEnable: process.env.IS_LOW_PRIORITY_EMAIL_ENABLE || false,
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        auth: {
            user: process.env.EMAIL_ID,
            pass: process.env.EMAIL_PASS,
        },
        defaults: {
            fromEmail: `"No Reply" <${process.env.EMAIL_SEND_ADDRESS}>`,
        },
        templateDir: process.env.EMAIL_TEMPLATE_LOCATION,
    },
    guardian: {
        hederaNetwork:
            (process.env.HEDERA_NETWORK_TYPE as HederaNetworkType) || 'Testnet',
        treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY || '',
        treasuryAccount: process.env.STANDARD_REGISTRY_HEDERA_ACCOUNT || '',
        url: process.env.GUARDIAN_URL || 'http://3.93.78.104:3000',
        task: {
            retrycount: parseInt(
                process.env.GUARDIAN_TASK_RETRY_COUNT || '3',
                10,
            ),
        },
        exchangeRateApi:
            process.env.HBAR_EXCHANGE_RATE_API ||
            'https://testnet.mirrornode.hedera.com/api/v1/network/exchangerate',
        hbarThresholds: {
            general: process.env.GENERAL_HBAR_THRESHOLD || 10,
        },
    },
    policy: {
        id: process.env.POLICY_ID,
        topicId: process.env.POLICY_TOPIC_ID,
    },
    sru: {
        username: process.env.STANDARD_REGISTRY_USERNAME,
        password: process.env.STANDARD_REGISTRY_PASSWORD,
        did: process.env.STANDARD_REGISTRY_DID,
    },
    metadata: {
        approve: {
            tag: {
                Developer: 'save_pending_dev_org',
            },
            type: {
                Developer: 'developer',
            },
            sourceTag: {
                Developer: 'pending_developer_orgs',
            },
        },
    },
    system: {
        initPolicy: process.env.INIT_POLICY_ENABLE || false,
        initOrgs: process.env.INIT_ORGS_ENABLE || false,
        initApiAdmin: process.env.INIT_API_ADMIN || false,
    },
    organizations: {
        DNA: {
            email: process.env.DNA_ROOT_EMAIL,
            name: process.env.DNA_ROOT_NAME,
            phoneNo: process.env.DNA_ROOT_PHONE_NO,
            hederaAccount: process.env.DNA_ROOT_HEDERA_ACCOUNT_ID,
            hederaKey: process.env.DNA_ROOT_HEDERA_ACCOUNT_KEY,
            password: process.env.DNA_ROOT_PASSWORD,
            orgName: process.env.DNA_ORGANIZATION_NAME,
            orgEmail: process.env.DNA_ROOT_ORGANIZATION_EMAIL,
            orgPaymentId: process.env.DNA_ROOT_ORGANIZATION_PAYMENT_ID,
            orgPhoneNo: process.env.DNA_ROOT_ORGANIZATION_PHONE_NO,
            orgAddress: process.env.DNA_ROOT_ORGANIZATION_ADDRESS,
            orgLogo: process.env.DNA_ROOT_ORGANIZATION_LOGO,
            orgHederaAccount: process.env.DNA_ORGANIZATION_HEDERA_ACCOUNT_ID,
            orgHederaKey: process.env.DNA_ORGANIZATION_HEDERA_ACCOUNT_KEY,
            apiAdminEmail: process.env.API_USER_EMAIL,
            apiAdminPwd: process.env.API_USER_PASSWORD,
        },
    },
    security: {
        pwdSecret: process.env.PASSWORD_SECRET,
        salt: process.env.PASSWORD_SALT,
    },
    token: {
        forgotPwdExpireTimeOut:
            Number(process.env.FORGOT_PWD_TOKEN_EXPIRE) || 3600, // In Seconds
        length: process.env.TOKEN_LENGTH || 8,
        verificationSecret: process.env.TOKEN_VERIFICATION_SECRET,
    },
    AEF: {
        artical6RecordId: process.env.NOT_APPLICABLE_LABEL || 'NA',
        cooperativeApproach: process.env.COOPERATIVE_APPROACH || 'Article 6.2',
        firstUniqueIdentifier: process.env.NOT_APPLICABLE_LABEL || 'NA',
        lastUniqueIdentifier: process.env.NOT_APPLICABLE_LABEL || 'NA',
        metric: process.env.EMISSION_METRIC || 'tCO2',
        quantityInMetric: process.env.NOT_APPLICABLE_LABEL || 'NA',
        conversionFactor: process.env.NOT_APPLICABLE_LABEL || 'NA',
        firstTransferingParty: process.env.systemCountryCode || 'SL',
        purposeForAuthorization: process.env.ACTION_TYPE_LABEL_LABEL || 'NDC',
        OIMP: process.env.NOT_APPLICABLE_LABEL || 'NA',
        firstTransferDefinition:
            process.env.FIRST_TRANSFER_DEFINITION || 'Authorization',
        transferingParty: process.env.systemCountryCode || 'SL',
        defaultAquiringParty: process.env.systemCountryCode || 'SL',
        purposeForCancellation: process.env.ACTION_TYPE_LABEL_LABEL || 'NDC',
        actionBy: process.env.NOT_APPLICABLE_LABEL || 'NA',
        party: process.env.PARTY || 'Sri Lanka',
    },
});
