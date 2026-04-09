import process from "node:process";
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { gigachatMcpConfiguration } from "./config.js";
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

export function createQticketsMcpServer() {
  const server = new McpServer(
    {
      name: "qtickets-gigachat",
      version: "0.1.0",
    },
    {
      instructions:
        "Инструменты для каталога мероприятий Qtickets, наличия мест и заказов. Токен API только на сервере.",
    }
  );

  server.registerTool(
    "qtickets_list_events",
    {
      title: "Список мероприятий Qtickets",
      description:
        "Возвращает страницу списка активных мероприятий (REST: GET /events с фильтром deleted_at IS NULL).",
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
      title: "Карточка мероприятия",
      description: "Детали мероприятия, сеансы (shows), цены — REST GET /events/{id}.",
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
      title: "Места и доступность сеанса",
      description:
        "REST GET /shows/{show_id}/seats. По умолчанию flat=true и только доступные места. Для сложных фильтров передайте seatQueryOverride.",
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
        where: onlyAvailable
          ? [{ column: "available", value: true }]
          : [],
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
      title: "Детали заказа",
      description:
        "REST GET /orders/{id}. Содержит payed, baskets, payment_url и др. Используйте после оплаты или для статуса.",
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
      title: "Подсказка по оплате (виджет vs payment_url)",
      description:
        "Сводка по мероприятию и режиму QTICKETS_CHECKOUT_MODE из окружения: ссылка на виджет или ожидание payment_url после создания заказа.",
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
        title: "Создать заказ (POST /orders)",
        description:
          "Включено только если QTICKETS_ENABLE_CREATE_ORDER=true. Тело должно соответствовать контракту Qtickets; подтвердите поля у поддержки.",
        inputSchema: z.object({
          orderPayload: z
            .record(z.string(), z.any())
            .describe('Обычно { "data": { ... } } — см. REST API и ответ поддержки Qtickets'),
        }),
      },
      async ({ orderPayload }) => {
        const responseBody = await qticketsCreateOrder(orderPayload);
        return createJsonTextResult(responseBody);
      }
    );
  }

  return server;
}

async function main() {
  if (!String(gigachatMcpConfiguration.qtickets.apiToken ?? "").trim()) {
    console.error(
      "gigachat-mcp: set QTICKETS_API_TOKEN in the environment (Qtickets: Настройки → Основное)."
    );
    process.exitCode = 1;
    return;
  }

  const mcpServer = createQticketsMcpServer();
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
