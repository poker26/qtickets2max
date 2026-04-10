/** Соответствие таблице в https://developers.sber.ru/docs/ru/gigachat/guides/mcp/sberpay/mcp-integration */

export const SberCommerceErrorCodes = {
  INVALID_CLIENT_INFO_TOKEN: -32001,
  MERCHANT_NOT_FOUND: -32002,
  PRODUCT_NOT_AVAILABLE: -32003,
  DELIVERY_NOT_AVAILABLE: -32004,
  CART_MANDATE_EXPIRED: -32005,
  PAYMENT_FAILED: -32006,
  INSUFFICIENT_STOCK: -32007,
  INVALID_MANDATE_SIGNATURE: -32008,
  ORDER_NOT_FOUND: -32009,
  INTERNAL_SERVER_ERROR: -32099,
};

export const SberCommerceErrorMessages = {
  [-32001]: "Invalid client info token",
  [-32002]: "Merchant not found",
  [-32003]: "Product not available",
  [-32004]: "Delivery not available",
  [-32005]: "Cart mandate expired",
  [-32006]: "Payment failed",
  [-32007]: "Insufficient stock",
  [-32008]: "Invalid mandate signature",
  [-32009]: "Order not found",
  [-32099]: "Internal server error",
};

export class SberCommerceError extends Error {
  /**
   * @param {number} code
   * @param {string} [messageOverride]
   */
  constructor(code, messageOverride) {
    const defaultMessage =
      SberCommerceErrorMessages[code] ?? SberCommerceErrorMessages[SberCommerceErrorCodes.INTERNAL_SERVER_ERROR];
    super(messageOverride ?? defaultMessage);
    this.name = "SberCommerceError";
    this.code = code;
  }
}
