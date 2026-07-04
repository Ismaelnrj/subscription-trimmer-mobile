const { withAppBuildGradle } = require("@expo/config-plugins");

// Forces a minimum Google Play Billing Library version across all transitive
// dependencies so no package can silently downgrade below the Play Store requirement.
module.exports = function withBillingLibraryOverride(config, { version = "8.3.0" } = {}) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes("billingclient-force-pin")) {
      return config;
    }
    config.modResults.contents += `

// billingclient-force-pin: Google Play requires Billing Library 7.0.0+; we pin to ${version}.
configurations.all {
  resolutionStrategy {
    force "com.android.billingclient:billing:${version}"
    force "com.android.billingclient:billing-ktx:${version}"
  }
}
`;
    return config;
  });
};
