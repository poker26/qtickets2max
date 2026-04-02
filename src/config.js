import "dotenv/config";

function readRequiredEnv(variableName) {
  const variableValue = process.env[variableName];
  if (!variableValue || variableValue.trim() === "") {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
  return variableValue.trim();
}

function readOptionalEnv(variableName, defaultValue = "") {
  const variableValue = process.env[variableName];
  if (variableValue == null) {
    return defaultValue;
  }
  return String(variableValue).trim();
}

function toPositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }
  return parsedValue;
}

export const configuration = {
  server: {
    port: toPositiveInteger(readOptionalEnv("PORT", "8787"), 8787),
    logLevel: readOptionalEnv("LOG_LEVEL", "info"),
  },
  qtickets: {
    webhookSecret: readOptionalEnv("QTICKETS_WEBHOOK_SECRET"),
    orderDetailsUrlTemplate: readRequiredEnv("QTICKETS_ORDER_DETAILS_URL_TEMPLATE"),
    apiToken: readRequiredEnv("QTICKETS_API_TOKEN"),
    apiAuthHeaderName: readOptionalEnv("QTICKETS_API_AUTH_HEADER_NAME", "authorization"),
    apiAuthScheme: readOptionalEnv("QTICKETS_API_AUTH_SCHEME", "Bearer"),
    requestTimeoutMs: toPositiveInteger(
      readOptionalEnv("QTICKETS_API_REQUEST_TIMEOUT_MS", "10000"),
      10000
    ),
  },
  max: {
    botToken: readRequiredEnv("MAX_BOT_TOKEN"),
    targetChatId: readRequiredEnv("MAX_TARGET_CHAT_ID"),
    apiBaseUrl: readOptionalEnv("MAX_API_BASE_URL", "https://platform-api.max.ru"),
    messagePrefix: readOptionalEnv("MAX_MESSAGE_PREFIX", "[MiniFarm]"),
    requestTimeoutMs: toPositiveInteger(
      readOptionalEnv("MAX_REQUEST_TIMEOUT_MS", "10000"),
      10000
    ),
  },
};
