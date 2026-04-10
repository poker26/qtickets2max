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

function readCommaSeparatedList(rawValue) {
  if (!rawValue || !String(rawValue).trim()) {
    return [];
  }
  return String(rawValue)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const gigachatMcpConfiguration = {
  sber: {
    merchantName: readOptionalEnv("SBER_MERCHANT_NAME", "Тестовый мерчант (замените SBER_MERCHANT_NAME)"),
    merchantWebsite: readOptionalEnv("SBER_MERCHANT_WEBSITE", "https://example.com"),
    merchantDescription: readOptionalEnv(
      "SBER_MERCHANT_DESCRIPTION",
      "Укажите описание мерчанта в SBER_MERCHANT_DESCRIPTION"
    ),
    mainCategories: readOptionalEnv("SBER_MAIN_CATEGORIES_JSON", ""),
    allCategories: readOptionalEnv("SBER_ALL_CATEGORIES_JSON", ""),
    supportedBrands: readOptionalEnv("SBER_SUPPORTED_BRANDS_JSON", ""),
    deliveryRegions: readOptionalEnv("SBER_DELIVERY_REGIONS", "Россия"),
    deliveryRegionsList: readCommaSeparatedList(readOptionalEnv("SBER_DELIVERY_REGIONS", "Россия")),
    deliveryMethodsJson: readOptionalEnv("SBER_DELIVERY_METHODS_JSON", ""),
    paymentOptionsJson: readOptionalEnv("SBER_PAYMENT_OPTIONS_JSON", ""),
    additionalInfoJson: readOptionalEnv("SBER_ADDITIONAL_INFO_JSON", ""),
    matchReasons: readOptionalEnv("SBER_MATCH_REASONS", ""),
    contactPhone: readOptionalEnv("SBER_CONTACT_PHONE", ""),
    contactEmail: readOptionalEnv("SBER_CONTACT_EMAIL", ""),
    sberIdSupported: readBooleanEnv("SBER_SBERID_SUPPORTED", true),
    sberpaySupported: readBooleanEnv("SBER_SBERPAY_SUPPORTED", true),
    sberPrimeSupported: readBooleanEnv("SBER_PRIME_SUPPORTED", false),
    sberLoyaltySupported: readBooleanEnv("SBER_LOYALTY_SUPPORTED", false),
    digitalDeliveryOnly: readBooleanEnv("SBER_DIGITAL_DELIVERY_ONLY", true),
    mandateSigningSecret: readOptionalEnv("SBER_MANDATE_SIGNING_SECRET", ""),
    mandateJwtExpiresIn: readOptionalEnv("SBER_MANDATE_JWT_EXPIRES_IN", "2h"),
    paymentUrlBase: readOptionalEnv(
      "SBER_PAYMENT_URL_BASE",
      "https://example.com/pay"
    ),
    skuIdPrefix: readOptionalEnv("SBER_SKU_ID_PREFIX", "sber_sku_show_"),
    fallbackStockQuantity: toPositiveInteger(
      readOptionalEnv("SBER_FALLBACK_STOCK_QUANTITY", "100"),
      100
    ),
    relaxClientInfoValidation: readBooleanEnv("SBER_RELAX_CLIENT_INFO", false),
    verifyClientInfoJwt: readBooleanEnv("SBER_VERIFY_CLIENT_INFO_JWT_SHAPE", false),
    defaultOrderDeliveryStatus: readOptionalEnv("SBER_ORDER_DELIVERY_STATUS", "delivered"),
    defaultOrderDeliveryDescription: readOptionalEnv(
      "SBER_ORDER_DELIVERY_DESCRIPTION",
      "Электронный билет / услуга"
    ),
    registerQticketsDiagnosticTools: readBooleanEnv("MCP_REGISTER_QTICKETS_TOOLS", false),
  },
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
