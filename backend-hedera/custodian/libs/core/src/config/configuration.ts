export default () => ({
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
        id: '679a183d71e846be0ff69a93',
        topicId: '0.0.5441710',
    },
    sru: {
        username: 'amilareg',
        password: '123456',
        did: 'did:hedera:testnet:Hd3Q9whzRsi8YbEuJDVt1pnixzLJ888HhCBoa2Ba8TCi_0.0.5433423',
    },
    blocks: {
        createGroupType: 'create_orgnization',
        createSingleOrganization: 'single_organizations_creation_form',
        createMultipleOrganization: 'multiple_organizations_form',
        createUser: 'user_create_form',
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
        initPolicy: false,
        initOrgs: false,
    },
    organizations: {
        DNA: {
            orgName: 'DNA Organization',
            email: 'dnaorg1@testgov.com',
            name: 'dnaorg1',
            hederaAccount: '0.0.5445196',
            hederaKey:
                '302e020100300506032b6570042204202d7b51cd9236e92bf589d44700c81103a72d88e1503a5183b443ab8153cff883',
            password: '123',
        },
    },
});
