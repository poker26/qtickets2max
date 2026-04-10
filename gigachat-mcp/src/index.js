import process from "node:process";
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { gigachatMcpConfiguration } from "./config.js";
import { registerSberCommerceTools } from "./sber/register-sber-tools.js";
import { createCommerceStateStore } from "./sber/state-store.js";
import {
  qticketsCreateOrder,
  qticketsGetEvent,
  qticketsGetOrder,
  qticketsGetShowSeats,
  qticketsListEvents,
} from "./qtickets-rest.js";

function createJsonTextResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function normalizeEventPayload(apiResponse) {
  if (apiResponse && typeof apiResponse === "object" && "data" in apiResponse) {
    return apiResponse.data;
  }
  return apiResponse;
}

function buildCheckoutHintPayload(eventPayload, checkoutMode) {
  const data = eventPayload?.data ?? eventPayload;
  const shows = Array.isArray(data?.shows) ? data.shows : [];
  return {
    checkoutMode,
    eventId: data?.id ?? null,
    eventName: data?.name ?? null,
    siteUrl: data?.site_url ?? null,
    currencyId: data?.currency_id ?? null,
    upcomingShows: shows.map((show) => ({
      showId: show?.id ?? null,
      startDate: show?.start_date ?? null,
      saleFinishDate: show?.sale_finish_date ?? null,
      isActive: show?.is_active ?? null,
    })),
    notes:
      checkoutMode === "redirect_widget"
        ? "Передайте пользователю siteUrl для покупки в виджете Qtickets (без серверного создания заказа)."
        : "После успешного qtickets_create_order используйте payment_url из ответа API (подтвердите контракт у Qtickets).",
  };
}

/**
 * Диагностические инструменты Qtickets (не входят в контракт Сбера). Включить: MCP_REGISTER_QTICKETS_TOOLS=true.
 */
function registerQticketsDiagnosticTools(server) {
  server.registerTool(
    "qtickets_list_events",
    {
      title: "Список мероприятий Qtickets (диагностика)",
      description:
        "REST GET /events. Не является частью спецификации Sber mcp-integration; для отладки каталога.",
      inputSchema: z.object({
        page: z.number().int().min(1).optional().describe("Номер страницы (по умолчанию 1)"),
        orderDirection: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Сортировка по id (по умолчанию desc)"),
      }),
    },
    async ({ page = 1, orderDirection = "desc" }) => {
      const responseBody = await qticketsListEvents({ page, orderDirection });
      return createJsonTextResult(responseBody);
    }
  );

  server.registerTool(
    "qtickets_get_event",
    {
      title: "Карточка мероприятия Qtickets (диагностика)",
      description: "REST GET /events/{id}.",
      inputSchema: z.object({
        eventId: z.number().int().positive().describe("Идентификатор мероприятия в Qtickets"),
      }),
    },
    async ({ eventId }) => {
      const responseBody = await qticketsGetEvent(eventId);
      return createJsonTextResult(responseBody);
    }
  );

  server.registerTool(
    "qtickets_get_show_seats",
    {
      title: "Места и доступность сеанса Qtickets (диагностика)",
      description: "REST GET /shows/{show_id}/seats.",
      inputSchema: z.object({
        showId: z.number().int().positive(),
        flat: z.boolean().optional().describe("Плоский ответ (рекомендуется true)"),
        onlyAvailable: z.boolean().optional().describe("Фильтр available=true (по умолчанию true)"),
        seatQueryOverride: z
          .record(z.string(), z.any())
          .optional()
          .describe("Полное тело запроса вместо значений по умолчанию"),
      }),
    },
    async ({ showId, flat = true, onlyAvailable = true, seatQueryOverride }) => {
      const defaultBody = {
        flat,
        select: [
          "id",
          "name",
          "free_quantity",
          "available",
          "disabled",
          "price",
          "currency_id",
          "max_quantity",
          "ordered_quantity",
          "in_basket_quantity",
        ],
        where: onlyAvailable ? [{ column: "available", value: true }] : [],
      };

      const body =
        seatQueryOverride && typeof seatQueryOverride === "object"
          ? seatQueryOverride
          : defaultBody;

      const responseBody = await qticketsGetShowSeats(showId, body);
      return createJsonTextResult(responseBody);
    }
  );

  server.registerTool(
    "qtickets_get_order",
    {
      title: "Детали заказа Qtickets (диагностика)",
      description: "REST GET /orders/{id}.",
      inputSchema: z.object({
        orderId: z.number().int().positive(),
      }),
    },
    async ({ orderId }) => {
      const responseBody = await qticketsGetOrder(orderId);
      return createJsonTextResult(responseBody);
    }
  );

  server.registerTool(
    "qtickets_checkout_hint",
    {
      title: "Подсказка по оплате Qtickets (диагностика)",
      description: "Сводка по мероприятию и QTICKETS_CHECKOUT_MODE.",
      inputSchema: z.object({
        eventId: z.number().int().positive(),
      }),
    },
    async ({ eventId }) => {
      const raw = await qticketsGetEvent(eventId);
      const normalized = normalizeEventPayload(raw);
      const hint = buildCheckoutHintPayload(
        { data: normalized },
        gigachatMcpConfiguration.qtickets.checkoutMode
      );
      hint.publicWidgetBaseUrl = gigachatMcpConfiguration.qtickets.publicWidgetBaseUrl;
      return createJsonTextResult(hint);
    }
  );

  if (gigachatMcpConfiguration.qtickets.enableCreateOrderTool) {
    server.registerTool(
      "qtickets_create_order",
      {
        title: "Создать заказ Qtickets POST /orders (диагностика)",
        description: "Только при QTICKETS_ENABLE_CREATE_ORDER=true.",
        inputSchema: z.object({
          orderPayload: z
            .record(z.string(), z.any())
            .describe('Обычно { "data": { ... } }'),
        }),
      },
      async ({ orderPayload }) => {
        const responseBody = await qticketsCreateOrder(orderPayload);
        return createJsonTextResult(responseBody);
      }
    );
  }
}

/**
 * MCP-сервер для приёмки GigaChat по спецификации mcp-integration (Sber Commerce).
 * Плюс опциональные диагностические tools Qtickets.
 */
export function createGigaChatCommerceMcpServer() {
  const server = new McpServer(
    {
      name: "sber-gigachat-commerce",
      version: "0.2.0",
    },
    {
      instructions:
        "Соответствие GigaChat SberPay mcp-integration: get_merchant_info, get_skus, calculate_delivery, create_cart_mandate, share_fully_signed_mandate, share_fully_signed_cart_mandate, create_order, get_order_status. Ответы — JSON-RPC 2.0 в текстовом теле tool result. rqUid — UUID v4.",
    }
  );

  const commerceStateStore = createCommerceStateStore();
  registerSberCommerceTools(server, commerceStateStore);

  if (gigachatMcpConfiguration.sber.registerQticketsDiagnosticTools) {
    registerQticketsDiagnosticTools(server);
  }

  return server;
}

/** @deprecated используйте createGigaChatCommerceMcpServer */
export function createQticketsMcpServer() {
  return createGigaChatCommerceMcpServer();
}

function assertSberMandateSecretConfigured() {
  const secret = String(gigachatMcpConfiguration.sber.mandateSigningSecret ?? "").trim();
  if (secret.length < 16) {
    console.error(
      "gigachat-mcp: задайте SBER_MANDATE_SIGNING_SECRET (минимум 16 символов) для подписи CartMandate (HS256 JWT)."
    );
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function main() {
  if (!assertSberMandateSecretConfigured()) {
    return;
  }

  const mcpServer = createGigaChatCommerceMcpServer();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

const isMainModule =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    console.error("gigachat-mcp fatal error:", error);
    process.exitCode = 1;
  });
}
