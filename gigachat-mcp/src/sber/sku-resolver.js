import { gigachatMcpConfiguration } from "../config.js";
import { qticketsGetShowSeats } from "../qtickets-rest.js";
import { SberCommerceError, SberCommerceErrorCodes } from "./error-codes.js";

function hasQticketsApiToken() {
  return Boolean(String(gigachatMcpConfiguration.qtickets.apiToken ?? "").trim());
}

/**
 * productId: `show:12345` или строка из цифр (show_id Qtickets).
 *
 * @param {string} productId
 * @returns {number | null}
 */
export function parseQticketsShowIdFromProductId(productId) {
  if (typeof productId !== "string") {
    return null;
  }
  const prefixedMatch = /^show:(\d+)$/i.exec(productId.trim());
  if (prefixedMatch) {
    return Number.parseInt(prefixedMatch[1], 10);
  }
  if (/^\d+$/.test(productId.trim())) {
    return Number.parseInt(productId.trim(), 10);
  }
  return null;
}

/**
 * Суммирует free_quantity по ответу seats (flat).
 *
 * @param {unknown} seatsResponse
 */
function sumFreeQuantityFromSeatsResponse(seatsResponse) {
  const data = seatsResponse?.data;
  if (!data || typeof data !== "object") {
    return 0;
  }
  let totalFree = 0;
  for (const seat of Object.values(data)) {
    if (seat && typeof seat === "object" && "free_quantity" in seat) {
      const quantityValue = Number(seat.free_quantity);
      if (Number.isFinite(quantityValue)) {
        totalFree += quantityValue;
      }
    }
  }
  return totalFree;
}

/**
 * @param {number} showId
 */
async function fetchStockQuantityForShow(showId) {
  const seatQueryBody = {
    flat: true,
    select: ["id", "free_quantity", "available"],
    where: [{ column: "available", value: true }],
  };
  const responseBody = await qticketsGetShowSeats(showId, seatQueryBody);
  return sumFreeQuantityFromSeatsResponse(responseBody);
}

/**
 * @param {Array<{ productId: string, name?: string, category?: string, limit?: number, quantity?: unknown, attributes?: Record<string, unknown> }>} products
 */
export async function resolveProductsToSkus(products) {
  const { sber } = gigachatMcpConfiguration;
  /** @type {Record<string, Array<{ skuId: string, productId: string, stockQuantity: number }>>} */
  const productSkus = {};

  for (const product of products) {
    const showId = parseQticketsShowIdFromProductId(product.productId);
    if (showId == null || !Number.isFinite(showId)) {
      throw new SberCommerceError(SberCommerceErrorCodes.PRODUCT_NOT_AVAILABLE);
    }

    let stockQuantity = sber.fallbackStockQuantity;
    if (hasQticketsApiToken()) {
      try {
        stockQuantity = await fetchStockQuantityForShow(showId);
      } catch {
        throw new SberCommerceError(SberCommerceErrorCodes.PRODUCT_NOT_AVAILABLE);
      }
    }

    if (stockQuantity <= 0) {
      throw new SberCommerceError(SberCommerceErrorCodes.INSUFFICIENT_STOCK);
    }

    const skuId = `${sber.skuIdPrefix}${showId}`;
    productSkus[product.productId] = [
      {
        skuId,
        productId: product.productId,
        stockQuantity,
      },
    ];
  }

  return productSkus;
}
