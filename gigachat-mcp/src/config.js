import "dotenv/config";

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

function readBooleanEnv(variableName, defaultValue = false) {
  const raw = readOptionalEnv(variableName);
  if (raw === "") {
    return defaultValue;
  }
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

/** @typedef {"redirect_widget" | "payment_url_after_create"} CheckoutMode */

/**
 * @returns {CheckoutMode}
 */
function readCheckoutMode() {
  const raw = readOptionalEnv("QTICKETS_CHECKOUT_MODE", "redirect_widget");
  if (raw === "payment_url_after_create") {
    return "payment_url_after_create";
  }
  return "redirect_widget";
}

export const gigachatMcpConfiguration = {
  qtickets: {
    apiBaseUrl: readOptionalEnv("QTICKETS_API_BASE_URL", "https://qtickets.ru/api/rest/v1"),
    apiToken: readOptionalEnv("QTICKETS_API_TOKEN"),
    apiAuthHeaderName: readOptionalEnv("QTICKETS_API_AUTH_HEADER_NAME", "authorization"),
    apiAuthScheme: readOptionalEnv("QTICKETS_API_AUTH_SCHEME", "Bearer"),
    requestTimeoutMs: toPositiveInteger(
      readOptionalEnv("QTICKETS_API_REQUEST_TIMEOUT_MS", "20000"),
      20000
    ),
    enableCreateOrderTool: readBooleanEnv("QTICKETS_ENABLE_CREATE_ORDER", false),
    /** Public site URL for widget/deep links when API returns relative paths */
    publicWidgetBaseUrl: readOptionalEnv("QTICKETS_PUBLIC_WIDGET_BASE_URL", "https://qtickets.ru"),
    checkoutMode: readCheckoutMode(),
  },
  httpHealth: {
    port: toPositiveInteger(readOptionalEnv("MCP_HEALTH_PORT", "8790"), 8790),
  },
};
