module.exports = ({ config }) => {
  const isAndroidBeta = process.env.KHE_ANDROID_CHANNEL === 'beta';

  return {
    ...config,
    name: isAndroidBeta ? 'KHE Booth Beta' : config.name,
    android: {
      ...(config.android ?? {}),
      package: isAndroidBeta
        ? 'com.kurtishypnotic.khebooth.beta'
        : config.android?.package,
    },
    extra: {
      ...(config.extra ?? {}),
      distributionChannel: isAndroidBeta ? 'android-beta' : 'production',
    },
  };
};
