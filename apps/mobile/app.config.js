// Extends app.json. google-services.json (Firebase, for push) is kept out of git:
// locally it's read from this folder, and EAS builds get it from the
// GOOGLE_SERVICES_JSON secret file environment variable.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
