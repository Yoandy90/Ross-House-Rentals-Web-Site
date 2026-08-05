const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reset to minimal config to avoid file watcher issues
config.resetCache = true;
config.maxWorkers = 2;

// Add buffer polyfill for react-native-svg
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer/'),
};

module.exports = config;
