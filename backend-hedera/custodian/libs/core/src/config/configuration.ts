export default () => ({
    country: process.env.COUNTRY,
    url: process.env.URL,
    backendHost: process.env.BACKEND_HOST || 'http://localhost:3000',
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
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
        url: process.env.GUARDIAN_URL || 'http://3.93.78.104:3000',
        login: '/api/v1/accounts/login',
        register: '/api/v1/accounts/register',
        accessToken: '/api/v1/accounts/access-token',
        profileUpdate: '/api/v1/profiles/push',
        changePassword: '/api/v1/accounts/change-password',
        policyAsign1: '/api/v1/permissions/users',
        policyAsign2: '/policies/assign',
        policies: '/api/v1/policies/',
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
    blocks: {
        createGroupType: 'create_organizations',
        createSingleOrganization: 'single_organizations_creation_form',
        createMultipleOrganization: 'multiple_organizations_creation_form',
        createUser: 'user_creation_form',
        userCreateInvite: 'user_create_invite',
        appoveOrganization: 'multiple_organizations_approve_reject_buttons',
        createProject: 'project_creation_form',
        projectQuery: 'project_approve_grid',
        userQuery: 'user_grid',
        organizationQuery: 'multiple_organizations_approve_grid',
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
        },
    },
    security: {
        salt: process.env.PASSWORD_SALT,
    },
    token: {
        forgotPwdExpireTimeOut:
            Number(process.env.FORGOT_PWD_TOKEN_EXPIRE) || 3600, // In Seconds
        length: process.env.TOKEN_LENGTH || 8,
        verificationSecret: process.env.TOKEN_VERIFICATION_SECRET,
    },
});
