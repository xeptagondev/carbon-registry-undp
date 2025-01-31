export default () => ({
    country: process.env.COUNTRY,
    url: process.env.URL,
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
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
            orgName: process.env.DNA_ORGANIZATION_NAME,
            email: process.env.DNA_ROOT_EMAIL,
            name: process.env.DNA_ROOT_NAME,
            hederaAccount: process.env.DNA_ROOT_HEDERA_ACCOUNT_ID,
            hederaKey: process.env.DNA_ROOT_HEDERA_ACCOUNT_KEY,
            password: process.env.DNA_ROOT_PASSWORD,
        },
    },
    security: {
        salt: process.env.PASSWORD_SALT,
    },
});
