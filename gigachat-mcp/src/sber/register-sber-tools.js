import { randomBytes } from "node:crypto";

import { z } from "zod";

import { gigachatMcpConfiguration } from "../config.js";
import { SberCommerceError, SberCommerceErrorCodes, SberCommerceErrorMessages } from "./error-codes.js";
import { signMerchantMandateJwt, verifyMerchantMandateJwt } from "./mandate-signing.js";
import { buildMatchReasons, buildMerchantInfoPayload } from "./merchant-profile.js";
import { resolveProductsToSkus } from "./sku-resolver.js";
import {
  buildSberJsonRpcError,
  buildSberJsonRpcSuccess,
  mcpTextResultFromJsonRpc,
} from "./tool-response.js";
import {
  assertClientInfoTokenPlausible,
  parseAndAssertClientInfo,
  UUID_V4_REGEX,
} from "./validate.js";

/**
 * @param {unknown} error
 * @param {string | number | null | undefined} jsonRpcId
 */
function toMcpToolResultFromError(error, jsonRpcId) {
  if (error instanceof SberCommerceError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            buildSberJsonRpcError(error.code, error.message, jsonRpcId ?? null),
            null,
            2
          ),
        },
      ],
    };
  }

  const message =
    error instanceof Error ? error.message : SberCommerceErrorMessages[SberCommerceErrorCodes.INTERNAL_SERVER_ERROR];
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          buildSberJsonRpcError(SberCommerceErrorCodes.INTERNAL_SERVER_ERROR, message, jsonRpcId ?? null),
          null,
          2
        ),
      },
    ],
  };
}

const rqUidV4Schema = z
  .string()
  .min(1)
  .refine((value) => UUID_V4_REGEX.test(value), {
    message: "rqUid must be UUID version 4 (RFC 4122)",
  });

const baseEnvelopeSchema = z.object({
  rqUid: rqUidV4Schema,
  rqTm: z.string(),
  clientInfo: z.record(z.string(), z.any()),
  jsonRpcId: z.union([z.string(), z.number(), z.null()]).optional(),
});

const shareMandateInputSchema = baseEnvelopeSchema.extend({
  merchantSignedMandate: z.record(z.string(), z.any()),
  mandateId: z.string(),
  userAuthorization: z.string().optional().describe("Подпись пользователя; можно передать здесь или в merchantSignedMandate"),
});

/**
 * @param {import('./state-store.js').ReturnType<typeof import('./state-store.js').createCommerceStateStore>} store
 * @param {object} args
 */
async function handleShareFullySignedMandate(store, args) {
  parseAndAssertClientInfo(args.clientInfo);
  assertClientInfoTokenPlausible(args.clientInfo.clientInfoToken);

  const storedRecord = store.getMerchantSignedMandate(args.mandateId);
  if (!storedRecord?.merchantSignedMandate) {
    throw new SberCommerceError(SberCommerceErrorCodes.INVALID_MANDATE_SIGNATURE);
  }

  const previouslySigned = storedRecord.merchantSignedMandate;
  const incomingAuth = args.merchantSignedMandate.merchantAuthorization;
  const storedAuth = previouslySigned.merchantAuthorization;
  if (incomingAuth !== storedAuth) {
    throw new SberCommerceError(SberCommerceErrorCodes.INVALID_MANDATE_SIGNATURE);
  }

  await verifyMerchantMandateJwt(String(incomingAuth), {
    mandateId: args.mandateId,
  });

  const userAuthorization =
    String(args.userAuthorization ?? args.merchantSignedMandate.userAuthorization ?? "").trim();
  if (!userAuthorization) {
    throw new SberCommerceError(SberCommerceErrorCodes.INVALID_MANDATE_SIGNATURE);
  }

  const fullySignedMandate = {
    contents: args.merchantSignedMandate.contents ?? previouslySigned.contents,
    merchantAuthorization: incomingAuth,
    userAuthorization,
    mandateId: args.mandateId,
  };

  store.saveFullySignedMandate(args.mandateId, fullySignedMandate);

  return mcpTextResultFromJsonRpc(
    buildSberJsonRpcSuccess(
      args.rqUid,
      {
        fullySignedMandate,
        storageConfirmation: {
          clientStored: true,
          storageLocation: "merchant_mcp_server",
          storedAt: new Date().toISOString(),
        },
      },
      args.jsonRpcId ?? null
    )
  );
}

/**
 * @param {import('./state-store.js').ReturnType<typeof import('./state-store.js').createCommerceStateStore>} store
 */
export function registerSberCommerceTools(server, store) {
  server.registerTool(
    "get_merchant_info",
    {
      title: "Информация о мерчанте (Sber Commerce MCP)",
      description:
        "Спецификация GigaChat mcp-integration: карточка мерчанта, доставка, оплата, интеграции Сбера.",
      inputSchema: baseEnvelopeSchema,
    },
    async (args) => {
      try {
        parseAndAssertClientInfo(args.clientInfo);
        assertClientInfoTokenPlausible(args.clientInfo.clientInfoToken);

        const merchantInfo = buildMerchantInfoPayload();
        const matchReasons = buildMatchReasons();

        return mcpTextResultFromJsonRpc(
          buildSberJsonRpcSuccess(
            args.rqUid,
            {
              merchantInfo,
              matchReasons,
            },
            args.jsonRpcId ?? null
          )
        );
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );

  server.registerTool(
    "get_skus",
    {
      title: "Подбор SKU (Sber Commerce MCP)",
      description:
        "Сопоставление productId с SKU; для Qtickets productId = show:<show_id> или числовой show_id. Нужен QTICKETS_API_TOKEN для реального остатка или fallback из SBER_FALLBACK_STOCK_QUANTITY.",
      inputSchema: baseEnvelopeSchema.extend({
        products: z.array(
          z.object({
            productId: z.string(),
            name: z.string().optional(),
            category: z.string().optional(),
            limit: z.number().optional(),
            quantity: z.any().optional(),
            attributes: z.record(z.string(), z.any()).optional(),
          })
        ),
        context: z
          .object({
            sessionId: z.string().optional(),
          })
          .optional(),
      }),
    },
    async (args) => {
      try {
        parseAndAssertClientInfo(args.clientInfo);
        assertClientInfoTokenPlausible(args.clientInfo.clientInfoToken);

        const productSkus = await resolveProductsToSkus(args.products);

        return mcpTextResultFromJsonRpc(
          buildSberJsonRpcSuccess(
            args.rqUid,
            {
              productSkus,
              personalizationFactors: {
                priceSensitivity: "medium",
                preferredBrands: [],
              },
            },
            args.jsonRpcId ?? null
          )
        );
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );

  server.registerTool(
    "calculate_delivery",
    {
      title: "Расчёт доставки (Sber Commerce MCP)",
      description:
        "Для цифровых билетов: нулевая стоимость и немедленная «доставка». Иначе — по тарифам из профиля мерчанта.",
      inputSchema: baseEnvelopeSchema.extend({
        deliveryInfo: z.record(z.string(), z.any()),
        context: z
          .object({
            sessionId: z.string().optional(),
          })
          .optional(),
      }),
    },
    async (args) => {
      try {
        parseAndAssertClientInfo(args.clientInfo);
        assertClientInfoTokenPlausible(args.clientInfo.clientInfoToken);

        const method = String(args.deliveryInfo.deliveryMethod ?? "");
        const region = String(args.deliveryInfo.region ?? "");

        const allowedRegions = gigachatMcpConfiguration.sber.deliveryRegionsList;
        if (allowedRegions.length > 0 && region && !allowedRegions.includes(region)) {
          throw new SberCommerceError(SberCommerceErrorCodes.DELIVERY_NOT_AVAILABLE);
        }

        const merchantDigitalOnly = gigachatMcpConfiguration.sber.digitalDeliveryOnly;
        const isExplicitDigital =
          method === "electronic_ticket" || method === "digital" || method === "";
        const isElectronic = merchantDigitalOnly || isExplicitDigital;

        const now = new Date();
        const estimatedDate = now.toISOString().slice(0, 10);

        if (isElectronic) {
          return mcpTextResultFromJsonRpc(
            buildSberJsonRpcSuccess(
              args.rqUid,
              {
                deliveryCost: 0,
                deliveryTime: {
                  minDays: 0,
                  maxDays: 0,
                  estimatedDate,
                  estimatedDeliveryStart: now.toISOString(),
                  estimatedDeliveryEnd: now.toISOString(),
                },
                costBreakdown: {
                  baseCost: 0,
                  distanceSurcharge: 0,
                  weightSurcharge: 0,
                  urgencySurcharge: 0,
                  freeThresholdApplied: true,
                },
                availableTimeSlots: [],
                restrictions: [],
                dynamicPricingInfo: {
                  isPeakHours: false,
                  demandMultiplier: 1,
                  priceValidUntil: new Date(now.getTime() + 86400000).toISOString(),
                },
              },
              args.jsonRpcId ?? null
            )
          );
        }

        throw new SberCommerceError(SberCommerceErrorCodes.DELIVERY_NOT_AVAILABLE);
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );

  server.registerTool(
    "create_cart_mandate",
    {
      title: "Создание CartMandate (Sber Commerce MCP)",
      description:
        "Формирует merchantSignedMandate с JWT HS256 (SBER_MANDATE_SIGNING_SECRET). Проверяет cartExpiry и merchantName.",
      inputSchema: baseEnvelopeSchema.extend({
        cartContents: z.record(z.string(), z.any()),
      }),
    },
    async (args) => {
      try {
        parseAndAssertClientInfo(args.clientInfo);
        assertClientInfoTokenPlausible(args.clientInfo.clientInfoToken);

        const cartContents = args.cartContents;
        const cartId = cartContents?.id;
        if (!cartId || typeof cartId !== "string") {
          throw new SberCommerceError(SberCommerceErrorCodes.INTERNAL_SERVER_ERROR, "cartContents.id is required");
        }

        const expectedMerchantName = gigachatMcpConfiguration.sber.merchantName;
        if (
          cartContents.merchantName &&
          typeof cartContents.merchantName === "string" &&
          cartContents.merchantName !== expectedMerchantName
        ) {
          throw new SberCommerceError(SberCommerceErrorCodes.MERCHANT_NOT_FOUND);
        }

        const cartExpiryRaw = cartContents.cartExpiry;
        if (cartExpiryRaw) {
          const cartExpiryMs = Date.parse(String(cartExpiryRaw));
          if (Number.isFinite(cartExpiryMs) && cartExpiryMs < Date.now()) {
            throw new SberCommerceError(SberCommerceErrorCodes.CART_MANDATE_EXPIRED);
          }
        }

        const mandateId = `mandate_${cartId}_${randomBytes(4).toString("hex")}`;

        const merchantAuthorization = await signMerchantMandateJwt({
          mandateId,
          cartId,
          mandateKind: "sber_cart_mandate",
        });

        const merchantSignedMandate = {
          contents: cartContents,
          merchantAuthorization,
        };

        store.saveMerchantSignedMandate(mandateId, merchantSignedMandate);

        return mcpTextResultFromJsonRpc(
          buildSberJsonRpcSuccess(
            args.rqUid,
            {
              merchantSignedMandate,
              mandateId,
            },
            args.jsonRpcId ?? null
          )
        );
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );

  server.registerTool(
    "share_fully_signed_mandate",
    {
      title: "Сохранение полностью подписанного мандата (Sber Commerce MCP)",
      description:
        "Сценарий из mcp-integration. Параметр userAuthorization можно передать отдельно или внутри merchantSignedMandate.",
      inputSchema: shareMandateInputSchema,
    },
    async (args) => {
      try {
        return await handleShareFullySignedMandate(store, args);
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );

  server.registerTool(
    "share_fully_signed_cart_mandate",
    {
      title: "Сохранение полностью подписанного мандата (синоним диаграммы Сбера)",
      description: "Идентично share_fully_signed_mandate (имя из sequenceDiagram в документации).",
      inputSchema: shareMandateInputSchema,
    },
    async (args) => {
      try {
        return await handleShareFullySignedMandate(store, args);
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );

  server.registerTool(
    "create_order",
    {
      title: "Создание заказа и платежа (Sber Commerce MCP)",
      description:
        "По fullySignedMandate создаёт заказ в памяти, возвращает order и paymentInfo (paymentUrl). Интеграция с Qtickets POST /orders — опционально (SBER_QTICKETS_CREATE_ORDER).",
      inputSchema: baseEnvelopeSchema.extend({
        fullySignedMandate: z.record(z.string(), z.any()),
        deliveryOption: z.record(z.string(), z.any()),
        contactInfo: z.record(z.string(), z.any()),
        paymentMethod: z.record(z.string(), z.any()),
      }),
    },
    async (args) => {
      try {
        parseAndAssertClientInfo(args.clientInfo);
        assertClientInfoTokenPlausible(args.clientInfo.clientInfoToken);

        const mandateId = String(args.fullySignedMandate.mandateId ?? "");
        if (!mandateId) {
          throw new SberCommerceError(SberCommerceErrorCodes.INVALID_MANDATE_SIGNATURE);
        }

        const storedMandate = store.getFullySignedMandate(mandateId);
        if (!storedMandate?.fullySignedMandate) {
          throw new SberCommerceError(SberCommerceErrorCodes.PAYMENT_FAILED);
        }

        const effectiveContents =
          args.fullySignedMandate.contents ?? storedMandate.fullySignedMandate.contents;
        const paymentRequest = effectiveContents?.paymentRequest;
        const totalAmount = paymentRequest?.details?.total?.amount;
        const currency = totalAmount?.currency ?? "RUB";
        const value = Number(totalAmount?.value ?? 0);

        const orderId = `order_${Date.now()}_${randomBytes(3).toString("hex")}`;
        const paymentId = `pay_${randomBytes(6).toString("hex")}`;

        const displayItems = paymentRequest?.details?.displayItems;
        const items = Array.isArray(displayItems)
          ? displayItems.map((line, index) => ({
              skuId: `line_${index}`,
              productId: `product_${index}`,
              name: String(line?.label ?? `item_${index}`),
              quantity: 1,
              price: {
                currency: line?.amount?.currency ?? currency,
                value: Number(line?.amount?.value ?? 0),
              },
              attributes: {},
            }))
          : [];

        const orderRecord = {
          orderId,
          mandateId,
          status: "confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          totalAmount: { currency, value },
          items,
          deliveryInfo: {
            method: args.deliveryOption.method ?? "electronic_ticket",
            shippingOptionId: args.deliveryOption.shippingOptionId ?? null,
            cost: { currency, value: 0 },
            address: args.contactInfo.shippingAddress ?? null,
            estimatedDelivery: new Date().toISOString(),
            pickupPointId: null,
          },
          contactInfo: {
            recipientName: args.contactInfo.recipientName ?? "",
            phone: args.contactInfo.phone ?? "",
            email: args.contactInfo.email ?? "",
          },
          merchantNotes: null,
        };

        const paymentBaseUrl = gigachatMcpConfiguration.sber.paymentUrlBase.replace(/\/$/, "");
        const paymentUrl = `${paymentBaseUrl}/${encodeURIComponent(paymentId)}`;

        const resultPayload = {
          order: orderRecord,
          paymentInfo: {
            paymentId,
            paymentUrl,
            paymentStatus: "pending",
            amount: { currency, value },
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
          nextActions: ["redirect_to_payment"],
        };

        store.saveOrder(orderId, { ...orderRecord, paymentId, paymentUrl });

        return mcpTextResultFromJsonRpc(
          buildSberJsonRpcSuccess(args.rqUid, resultPayload, args.jsonRpcId ?? null)
        );
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );

  server.registerTool(
    "get_order_status",
    {
      title: "Статус заказа / доставки (Sber Commerce MCP)",
      description: "Возвращает статус по orderId из внутреннего хранилища MCP.",
      inputSchema: baseEnvelopeSchema.extend({
        orderId: z.string(),
      }),
    },
    async (args) => {
      try {
        parseAndAssertClientInfo(args.clientInfo);
        assertClientInfoTokenPlausible(args.clientInfo.clientInfoToken);

        const storedOrder = store.getOrder(args.orderId);
        if (!storedOrder) {
          throw new SberCommerceError(SberCommerceErrorCodes.ORDER_NOT_FOUND);
        }

        const estimatedFromOrder =
          storedOrder.deliveryInfo?.estimatedDelivery ?? new Date().toISOString();

        return mcpTextResultFromJsonRpc(
          buildSberJsonRpcSuccess(
            args.rqUid,
            {
              orderId: args.orderId,
              deliveryStatus: gigachatMcpConfiguration.sber.defaultOrderDeliveryStatus,
              deliveryStatusDescription:
                gigachatMcpConfiguration.sber.defaultOrderDeliveryDescription,
              estimatedDelivery: estimatedFromOrder,
              lastUpdated: storedOrder.updatedAt ?? new Date().toISOString(),
              trackingInfo: {
                trackingNumber: "",
                trackingUrl: "",
                carrier: "electronic",
              },
              pickupPoint: null,
            },
            args.jsonRpcId ?? null
          )
        );
      } catch (error) {
        return toMcpToolResultFromError(error, args.jsonRpcId);
      }
    }
  );
}
