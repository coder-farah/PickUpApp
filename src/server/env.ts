export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  cronSecret: process.env.CRON_SECRET ?? "",
  isProd: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test" || !!process.env.VITEST,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID ?? "",
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  },
};

export const twilioConfigured = () => !!(env.twilio.accountSid && env.twilio.authToken);
export const smsConfigured = () => twilioConfigured() && !!env.twilio.fromNumber;
export const verifyConfigured = () => twilioConfigured() && !!env.twilio.verifyServiceSid;
