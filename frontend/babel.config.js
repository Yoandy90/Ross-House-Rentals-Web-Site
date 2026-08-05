module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // CRITICAL: Reanimated plugin MUST be listed last
      // This enables proper worklet transformation and prevents UIManager crashes
      'react-native-reanimated/plugin',
    ],
  };
};
