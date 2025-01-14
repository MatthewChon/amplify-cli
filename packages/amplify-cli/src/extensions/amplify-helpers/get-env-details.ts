import { $TSAny, stateManager } from 'amplify-cli-core';

/**
 * Gets the TPI file
 */
export const getEnvDetails = (): $TSAny => {
  const teamProviderInfo = stateManager.getTeamProviderInfo(undefined, {
    throwIfNotExist: false,
    default: {},
  });

  return teamProviderInfo;
};
