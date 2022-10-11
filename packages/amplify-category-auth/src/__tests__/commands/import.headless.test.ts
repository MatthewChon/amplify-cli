import { ImportAuthRequest } from 'amplify-headless-interface';
import { printer } from 'amplify-prompts';
import * as cliCore from 'amplify-cli-core';
import { stateManager } from 'amplify-cli-core';
import { getEnvMeta, IEnvironmentMetadata } from '@aws-amplify/amplify-environment-parameters';
import { messages } from '../../provider-utils/awscloudformation/assets/string-maps';
import { executeAmplifyHeadlessCommand } from '../..';

jest.mock('amplify-prompts', () => ({
  printer: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('amplify-cli-core', () => ({
  ...(jest.requireActual('amplify-cli-core') as typeof cliCore),
  FeatureFlags: {
    getBoolean: () => false,
  },
  JSONUtilities: {
    parse: JSON.parse,
  },
}));

jest.mock('@aws-amplify/amplify-environment-parameters');
const getEnvMetaMock = getEnvMeta as jest.MockedFunction<typeof getEnvMeta>;
getEnvMetaMock.mockReturnValue({ Region: 'test-region-1' } as IEnvironmentMetadata);

const stateManagerMock = stateManager as jest.Mocked<typeof stateManager>;
stateManagerMock.getMeta = jest.fn().mockReturnValue({
  providers: {
    awscloudformation: {},
  },
});
stateManagerMock.setResourceParametersJson = jest.fn();

jest.mock('../../provider-utils/awscloudformation/auth-inputs-manager/auth-input-state');

describe('import auth headless', () => {
  let mockContext: any;
  const USER_POOL_ID = 'user-pool-123';
  const IDENTITY_POOL_ID = 'identity-pool-123';
  const NATIVE_CLIENT_ID = 'native-app-client-123';
  const WEB_CLIENT_ID = 'web-app-client-123';
  const defaultUserPoolClients = [
    {
      UserPoolId: USER_POOL_ID,
      ClientId: WEB_CLIENT_ID,
    },
    {
      UserPoolId: USER_POOL_ID,
      ClientId: NATIVE_CLIENT_ID,
      ClientSecret: 'secret-123',
    },
  ];
  const headlessPayload: ImportAuthRequest = {
    version: 1,
    userPoolId: USER_POOL_ID,
    identityPoolId: IDENTITY_POOL_ID,
    nativeClientId: NATIVE_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  };
  const headlessPayloadString: string = JSON.stringify(headlessPayload);
  const projectConfig = {
    projectName: 'amplify-import-headless-auth-test',
  };
  const projectDetails = {
    projectConfig,
    amplifyMeta: {},
  };
  const getUserPoolDetails = {
    Id: USER_POOL_ID,
    MfaConfiguration: 'ON',
  };
  const identityPoolDetails = [
    {
      IdentityPoolId: IDENTITY_POOL_ID,
      IdentityPoolName: 'identity-pool',
      AllowUnauthenticatedIdentities: true,
      CognitoIdentityProviders: [
        {
          ProviderName: `web-provider-${USER_POOL_ID}`,
          ClientId: WEB_CLIENT_ID,
        },
        {
          ProviderName: `native-provider-${USER_POOL_ID}`,
          ClientId: NATIVE_CLIENT_ID,
        },
      ],
    },
  ];
  const mfaResponse = {
    SoftwareTokenMfaConfiguration: {
      Enabled: true,
    },
    MfaConfiguration: 'ON',
  };
  const getIdentityPoolRolesResponse = {
    authRoleArn: 'arn:authRole:123',
    authRoleName: 'authRole',
    unauthRoleName: 'unAuthRole',
    unauthRoleArn: 'arn:unAuthRole:123',
  };
  // mock fns
  const cognitoUserPoolServiceMock = jest.fn();
  const cognitoIdentityPoolServiceMock = jest.fn();
  const pluginInstanceMock = jest.fn();
  const getUserPoolDetailsMock = jest.fn();
  const listUserPoolClientsMock = jest.fn();
  const getUserPoolMfaConfigMock = jest.fn();
  const listIdentityPoolDetailsMock = jest.fn();
  const getIdentityPoolRolesMock = jest.fn();
  const getProjectConfigMock = jest.fn().mockReturnValue(projectConfig);
  const getProjectDetailsMock = jest.fn().mockReturnValue(projectDetails);

  beforeAll(() => {
    const loadResourceParametersMock = jest.fn();
    const updateAmplifyMetaAfterResourceAddMock = jest.fn();
    const pluginInstance = {
      loadResourceParameters: loadResourceParametersMock,
      createCognitoUserPoolService: cognitoUserPoolServiceMock.mockReturnValue({
        getUserPoolDetails: getUserPoolDetailsMock.mockResolvedValueOnce(getUserPoolDetails),
        listUserPoolClients: listUserPoolClientsMock.mockResolvedValueOnce(defaultUserPoolClients),
        getUserPoolMfaConfig: getUserPoolMfaConfigMock.mockResolvedValue(mfaResponse),
      }),
      createIdentityPoolService: cognitoIdentityPoolServiceMock.mockReturnValue({
        listIdentityPoolDetails: listIdentityPoolDetailsMock.mockResolvedValue(identityPoolDetails),
        getIdentityPoolRoles: getIdentityPoolRolesMock.mockResolvedValue(getIdentityPoolRolesResponse),
      }),
    };
    mockContext = {
      amplify: {
        getProjectConfig: getProjectConfigMock,
        getProjectDetails: getProjectDetailsMock,
        updateamplifyMetaAfterResourceAdd: updateAmplifyMetaAfterResourceAddMock,
        getPluginInstance: pluginInstanceMock.mockReturnValue(pluginInstance),
        saveEnvResourceParameters: jest.fn(),
      },
      parameters: {
        first: 'mockFirst',
      },
      input: {
        command: 'import',
      },
      usageData: {
        pushHeadlessFlow: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process command successfully', async () => {
    await executeAmplifyHeadlessCommand(mockContext, headlessPayloadString);

    expect(getUserPoolDetailsMock).toBeCalledWith(USER_POOL_ID);
    expect(listUserPoolClientsMock).toBeCalledWith(USER_POOL_ID);
    expect(getUserPoolMfaConfigMock).toBeCalledWith(USER_POOL_ID);
    expect(listIdentityPoolDetailsMock).toBeCalledWith();
    expect(getIdentityPoolRolesMock).toBeCalledWith(IDENTITY_POOL_ID);
  });

  it('should warn if auth has already been added', async () => {
    getProjectDetailsMock.mockReturnValueOnce({
      projectConfig,
    });

    stateManagerMock.getMeta = jest.fn().mockReturnValueOnce({
      auth: {
        foo: {},
      },
    });

    await executeAmplifyHeadlessCommand(mockContext, headlessPayloadString);

    expect(printer.warn).toBeCalledWith(messages.authExists);
  });

  it('should warn if auth has already been imported', async () => {
    getProjectDetailsMock.mockReturnValueOnce({
      projectConfig,
    });

    stateManagerMock.getMeta = jest.fn().mockReturnValueOnce({
      auth: {
        foo: {
          serviceType: 'imported',
        },
      },
    });

    await executeAmplifyHeadlessCommand(mockContext, headlessPayloadString);

    expect(printer.warn).toBeCalledWith(
      'Auth has already been imported to this project and cannot be modified from the CLI. To modify, run "amplify remove auth" to unlink the imported auth resource. Then run "amplify import auth".',
    );
  });

  it('should throw user pool not found exception', async () => {
    stateManagerMock.getMeta = jest.fn().mockReturnValue({
      providers: {
        awscloudformation: {},
      },
    });
    getUserPoolDetailsMock.mockRejectedValueOnce({
      name: 'ResourceNotFoundException',
    });

    await expect(executeAmplifyHeadlessCommand(mockContext, headlessPayloadString)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The previously configured Cognito User Pool: '' (user-pool-123) cannot be found."`,
    );
  });

  it('should throw web clients not found exception', async () => {
    stateManagerMock.getMeta = jest.fn().mockReturnValue({
      providers: {
        awscloudformation: {},
      },
    });

    listUserPoolClientsMock.mockResolvedValue([]);

    await expect(() => executeAmplifyHeadlessCommand(mockContext, headlessPayloadString)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The selected Cognito User Pool does not have at least 1 Web app client configured. Web app clients are app clients without a client secret."`,
    );
  });

  it('should throw no matching identity pool found exception', async () => {
    stateManagerMock.getMeta = jest.fn().mockReturnValue({
      providers: {
        awscloudformation: {},
      },
    });
    const INVALID_USER_POOL_ID = `${USER_POOL_ID}-invalid`;
    const invalidHeadlessPayload = {
      ...headlessPayload,
      userPoolId: INVALID_USER_POOL_ID,
    };
    const invalidHeadlessPayloadString = JSON.stringify(invalidHeadlessPayload);
    getUserPoolDetailsMock.mockResolvedValueOnce({
      Id: INVALID_USER_POOL_ID,
      MfaConfiguration: 'ON',
    });
    listUserPoolClientsMock.mockResolvedValueOnce(defaultUserPoolClients);

    await expect(executeAmplifyHeadlessCommand(mockContext, invalidHeadlessPayloadString)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"There are no Identity Pools found which has the selected Cognito User Pool configured as identity provider."`,
    );
  });
});
