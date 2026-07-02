import {
  CONFIG_FILE,
  readConfigLayers,
  isPlainObject,
  getConfigForPath,
  writeConfig,
} from './shared.js';

function getProviderSources(providerId, workingDirectory) {
  const layers = readConfigLayers(workingDirectory);
  const { userConfig, projectConfig, customConfig, paths } = layers;

  const customProviders = isPlainObject(customConfig?.provider) ? customConfig.provider : {};
  const customProvidersAlias = isPlainObject(customConfig?.providers) ? customConfig.providers : {};
  const projectProviders = isPlainObject(projectConfig?.provider) ? projectConfig.provider : {};
  const projectProvidersAlias = isPlainObject(projectConfig?.providers) ? projectConfig.providers : {};
  const userProviders = isPlainObject(userConfig?.provider) ? userConfig.provider : {};
  const userProvidersAlias = isPlainObject(userConfig?.providers) ? userConfig.providers : {};

  const customExists =
    Object.prototype.hasOwnProperty.call(customProviders, providerId) ||
    Object.prototype.hasOwnProperty.call(customProvidersAlias, providerId);
  const projectExists =
    Object.prototype.hasOwnProperty.call(projectProviders, providerId) ||
    Object.prototype.hasOwnProperty.call(projectProvidersAlias, providerId);
  const userExists =
    Object.prototype.hasOwnProperty.call(userProviders, providerId) ||
    Object.prototype.hasOwnProperty.call(userProvidersAlias, providerId);

  return {
    sources: {
      auth: { exists: false },
      user: { exists: userExists, path: paths.userPath },
      project: { exists: projectExists, path: paths.projectPath || null },
      custom: { exists: customExists, path: paths.customPath }
    }
  };
}

function removeProviderConfig(providerId, workingDirectory, scope = 'user') {
  if (!providerId || typeof providerId !== 'string') {
    throw new Error('Provider ID is required');
  }

  const layers = readConfigLayers(workingDirectory);
  let targetPath = layers.paths.userPath;

  if (scope === 'project') {
    if (!workingDirectory) {
      throw new Error('Working directory is required for project scope');
    }
    targetPath = layers.paths.projectPath || targetPath;
  } else if (scope === 'custom') {
    if (!layers.paths.customPath) {
      return false;
    }
    targetPath = layers.paths.customPath;
  }

  const targetConfig = getConfigForPath(layers, targetPath);
  const providerConfig = isPlainObject(targetConfig.provider) ? targetConfig.provider : {};
  const providersConfig = isPlainObject(targetConfig.providers) ? targetConfig.providers : {};
  const removedProvider = Object.prototype.hasOwnProperty.call(providerConfig, providerId);
  const removedProviders = Object.prototype.hasOwnProperty.call(providersConfig, providerId);

  if (!removedProvider && !removedProviders) {
    return false;
  }

  if (removedProvider) {
    delete providerConfig[providerId];
    if (Object.keys(providerConfig).length === 0) {
      delete targetConfig.provider;
    } else {
      targetConfig.provider = providerConfig;
    }
  }

  if (removedProviders) {
    delete providersConfig[providerId];
    if (Object.keys(providersConfig).length === 0) {
      delete targetConfig.providers;
    } else {
      targetConfig.providers = providersConfig;
    }
  }

  writeConfig(targetConfig, targetPath || CONFIG_FILE);
  console.log(`Removed provider ${providerId} from config: ${targetPath}`);
  return true;
}

function updateProviderConfig(providerId, configUpdates, workingDirectory, scope = 'user') {
  if (!providerId || typeof providerId !== 'string') {
    throw new Error('Provider ID is required');
  }

  const layers = readConfigLayers(workingDirectory);
  let targetPath = layers.paths.userPath;

  if (scope === 'project') {
    if (!workingDirectory) {
      throw new Error('Working directory is required for project scope');
    }
    targetPath = layers.paths.projectPath || targetPath;
  } else if (scope === 'custom') {
    if (!layers.paths.customPath) {
      throw new Error('Custom config path not available');
    }
    targetPath = layers.paths.customPath;
  }

  const targetConfig = getConfigForPath(layers, targetPath);
  const providerConfig = isPlainObject(targetConfig.provider) ? targetConfig.provider : {};

  // Initialize provider if missing
  if (!isPlainObject(providerConfig[providerId])) {
    providerConfig[providerId] = {};
  }
  const provider = providerConfig[providerId];

  // Update options (e.g. baseURL)
  let baseURLChanged = false;
  if (configUpdates.baseURL) {
    provider.options = isPlainObject(provider.options) ? provider.options : {};
    if (provider.options.baseURL !== configUpdates.baseURL) {
      baseURLChanged = true;
    }
    provider.options.baseURL = configUpdates.baseURL;
  }

  // Clear existing models if the base URL changed
  if (baseURLChanged) {
    provider.models = {};
  }

  // Update models and apply to subagents
  if (isPlainObject(configUpdates.models)) {
    provider.models = isPlainObject(provider.models) ? provider.models : {};
    let firstModelId = null;
    
    for (const [modelId, modelDef] of Object.entries(configUpdates.models)) {
      if (!firstModelId) firstModelId = modelId;
      provider.models[modelId] = {
        ...provider.models[modelId],
        ...modelDef
      };
    }

    // Automatically update the global model and the subagent "table" 
    // so oh-my-openagent uses the newly configured model by default.
    if (firstModelId) {
      const fullModelString = `${providerId}/${firstModelId}`;
      targetConfig.model = fullModelString;
      
      if (!isPlainObject(targetConfig.agent)) {
        targetConfig.agent = {};
      }
      
      const subagents = [
        'sisyphus', 'sisyphus-junior', 'atlas', 'metis', 'momus', 
        'prometheus', 'oracle', 'librarian', 'explore', 'general', 
        'build', 'plan'
      ];
      
      for (const agentName of subagents) {
        if (!isPlainObject(targetConfig.agent[agentName])) {
          targetConfig.agent[agentName] = {};
        }
        targetConfig.agent[agentName].model = fullModelString;
      }
    }
  }

  targetConfig.provider = providerConfig;
  writeConfig(targetConfig, targetPath || CONFIG_FILE);
  return true;
}

export {
  getProviderSources,
  removeProviderConfig,
  updateProviderConfig,
};
