import { $TSAny, $TSContext, AmplifyError } from 'amplify-cli-core';
import { printer } from 'amplify-prompts';
import inquirer from 'inquirer';
import ora from 'ora';
import { ChannelAction, ChannelConfigDeploymentType, IChannelAPIResponse } from './channel-types';
import { buildPinpointChannelResponseError, buildPinpointChannelResponseSuccess } from './pinpoint-helper';

const channelName = 'FCM';
const spinner = ora('');
const deploymentType = ChannelConfigDeploymentType.INLINE;

/**
 * Configure the Pinpoint resource to enable the FireBase Cloud Messaging channel
 * @param context amplify cli context
 */
export const configure = async (context: $TSContext): Promise<void> => {
  const isChannelEnabled = context.exeInfo.serviceMeta.output[channelName]?.Enabled;

  if (isChannelEnabled) {
    printer.info(`The ${channelName} channel is currently enabled`);
    const answer = await inquirer.prompt({
      name: 'disableChannel',
      type: 'confirm',
      message: `Do you want to disable the ${channelName} channel`,
      default: false,
    });
    if (answer.disableChannel) {
      await disable(context);
    } else {
      const successMessage = `The ${channelName} channel has been successfully updated.`;
      await enable(context, successMessage);
    }
  } else {
    const answer = await inquirer.prompt({
      name: 'enableChannel',
      type: 'confirm',
      message: `Do you want to enable the ${channelName} channel`,
      default: true,
    });
    if (answer.enableChannel) {
      await enable(context, undefined);
    }
  }
};

/**
 * Enable Walkthrough for the FireBase Cloud Messaging channel for notifications
 * @param context amplify cli context
 * @param successMessage optional message to be displayed on successfully enabling channel for notifications
 */
export const enable = async (context: $TSContext, successMessage: string | undefined) : Promise<IChannelAPIResponse> => {
  let answers;
  if (context.exeInfo.pinpointInputParams?.[channelName]) {
    answers = validateInputParams(context.exeInfo.pinpointInputParams[channelName]);
  } else {
    let channelOutput : $TSAny = {};
    if (context.exeInfo.serviceMeta.output[channelName]) {
      channelOutput = context.exeInfo.serviceMeta.output[channelName];
    }
    const questions = [
      {
        name: 'ApiKey',
        type: 'input',
        message: 'ApiKey',
        default: channelOutput.ApiKey,
      },
    ];
    answers = trimAnswers(await inquirer.prompt(questions));
  }

  const params = {
    ApplicationId: context.exeInfo.serviceMeta.output.Id,
    GCMChannelRequest: {
      ...answers,
      Enabled: true,
    },
  };

  spinner.start('Enabling FCM channel.');
  return new Promise((resolve, reject) => {
    context.exeInfo.pinpointClient.updateGcmChannel(params, (err: $TSAny, data: $TSAny) => {
      if (err) {
        spinner.fail('Enable channel error');
        const errResponse = buildPinpointChannelResponseError(ChannelAction.ENABLE, deploymentType, channelName, err);
        reject(errResponse);
        return;
      }

      spinner.succeed(successMessage ?? `The ${channelName} channel has been successfully enabled.`);
      context.exeInfo.serviceMeta.output[channelName] = data.GCMChannelResponse;
      const successResponse = buildPinpointChannelResponseSuccess(
        ChannelAction.ENABLE,
        deploymentType,
        channelName,
        data.GCMChannelResponse,
      );
      resolve(successResponse);
    });
  });
};

const validateInputParams = (channelInput: $TSAny):$TSAny => {
  if (!channelInput.ApiKey) {
    throw new AmplifyError('UserInputError', {
      message: 'ApiKey is missing for the FCM channel',
      resolution: 'Provide the ApiKey for the FCM channel',
    });
  }
  return channelInput;
};

/**
 * Disable walkthrough for FCM type notifications channel information from the cloud and update the Pinpoint resource metadata
 * @param context amplify cli notifications
 * @returns GCMChannel response
 */
export const disable = async (context: $TSContext): Promise<$TSAny> => {
  let answers;
  if (context.exeInfo.pinpointInputParams?.[channelName]) {
    answers = validateInputParams(context.exeInfo.pinpointInputParams[channelName]);
  } else {
    let channelOutput: $TSAny = {};
    if (context.exeInfo.serviceMeta.output[channelName]) {
      channelOutput = context.exeInfo.serviceMeta.output[channelName];
    }
    const questions = [
      {
        name: 'ApiKey',
        type: 'input',
        message: 'ApiKey',
        default: channelOutput.ApiKey,
      },
    ];
    answers = trimAnswers(await inquirer.prompt(questions));
  }

  const params = {
    ApplicationId: context.exeInfo.serviceMeta.output.Id,
    GCMChannelRequest: {
      ...answers,
      Enabled: false,
    },
  };

  spinner.start('Disabling FCM channel.');
  return new Promise((resolve, reject) => {
    context.exeInfo.pinpointClient.updateGcmChannel(params, (err: $TSAny, data:$TSAny) => {
      if (err) {
        spinner.fail('disable channel error');
        const errResponse = buildPinpointChannelResponseError(ChannelAction.DISABLE, deploymentType,
          channelName, err);
        reject(errResponse);
        return;
      }
      spinner.succeed(`The ${channelName} channel has been disabled.`);
      context.exeInfo.serviceMeta.output[channelName] = data.GCMChannelResponse;
      const successResponse = buildPinpointChannelResponseSuccess(ChannelAction.DISABLE, deploymentType,
        channelName, data.GCMChannelResponse);
      resolve(successResponse);
    });
  });
};

/**
 * Pull Walkthrough for FCM type notifications channel information from the cloud and update the Pinpoint resource metadata
 * @param context amplify cli context
 * @param pinpointApp Pinpoint resource metadata
 * @returns GCMChannel response
 */
export const pull = async (context: $TSContext, pinpointApp: $TSAny):Promise<$TSAny> => {
  const params = {
    ApplicationId: pinpointApp.Id,
  };

  spinner.start(`Retrieving channel information for ${channelName}.`);
  return context.exeInfo.pinpointClient
    .getGcmChannel(params)
    .promise()
    .then((data:$TSAny) => {
      spinner.succeed(`Channel information retrieved for ${channelName}`);
      // eslint-disable-next-line no-param-reassign
      pinpointApp[channelName] = data.GCMChannelResponse;
      return buildPinpointChannelResponseSuccess(ChannelAction.PULL, deploymentType,
        channelName, data.GCMChannelResponse);
    })
    .catch((err:$TSAny) => {
      if (err.code === 'NotFoundException') {
        spinner.succeed(`Channel is not setup for ${channelName} `);
        return buildPinpointChannelResponseError(ChannelAction.PULL, deploymentType,
          channelName, err);
      }
      spinner.stop();
      throw err;
    });
};

const trimAnswers = (answers: Record<string, $TSAny>): Record<string, $TSAny> => {
  for (const [key, value] of Object.entries(answers)) {
    if (typeof answers[key] === 'string') {
      // eslint-disable-next-line no-param-reassign
      answers[key] = value.trim();
    }
  }
  return answers;
};