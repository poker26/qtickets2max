import { z } from "zod";

import { agentMcpConfiguration } from "./config.js";
import {
  normalizeEventCatalog,
  normalizeEventList,
  normalizeShowAvailability,
} from "./normalize.js";
import {
  qticketsCreateOrder,
  qticketsGetEvent,
  qticketsGetOrder,
  qticketsGetShowSeats,
  qticketsListEvents,
} from "./qtickets-api.js";

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

/** @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server */
export function registerQticketsAgentTools(server) {
  server.registerTool(
    "list_published_events",
    {
      title: "Список опубликованных мероприятий",
      description:
        "Возвращает страницу мероприятий из Qtickets REST (не удалённые; по умолчанию только is_active).",
      inputSchema: z.object({
        page: z.number().int().min(1).optional().default(1),
        orderDirection: z.enum(["asc", "desc"]).optional().default("desc"),
        onlyActive: z
          .boolean()
          .optional()
          .default(true)
          .describe("Если API отдаёт пусто — попробуйте onlyActive=false"),
      }),
    },
    async ({ page = 1, orderDirection = "desc", onlyActive = true }) => {
      const raw = await qticketsListEvents({ page, orderDirection, onlyActive });
      const normalized = normalizeEventList(raw);
      return createJsonTextResult(normalized);
    }
  );

  server.registerTool(
    "get_event_catalog",
    {
      title: "Каталог мероприятия: сеансы и тарифы",
      description:
        "GET /events/:id — нормализованные сеансы (shows) и priceTiers (виды билетов по ценам из ответа Qtickets).",
      inputSchema: z.object({
        eventId: z.number().int().positive(),
      }),
    },
    async ({ eventId }) => {
      const raw = await qticketsGetEvent(eventId);
      const normalized = normalizeEventCatalog(raw);
      return createJsonTextResult(normalized);
    }
  );

  server.registerTool(
    "get_show_availability",
    {
      title: "Доступность билетов на сеанс",
      description:
        "GET /shows/:id/seats (flat) — суммарный остаток и разбивка по цене (byPrice).",
      inputSchema: z.object({
        showId: z.number().int().positive(),
        flat: z.boolean().optional().default(true),
      }),
    },
    async ({ showId, flat = true }) => {
      const seatQueryBody = {
        flat,
        select: [
          "id",
          "name",
          "free_quantity",
          "available",
          "disabled",
          "price",
          "currency_id",
        ],
        where: [{ column: "available", value: true }],
      };
      const raw = await qticketsGetShowSeats(showId, seatQueryBody);
      const normalized = normalizeShowAvailability(raw, showId);
      return createJsonTextResult(normalized);
    }
  );

  server.registerTool(
    "get_purchase_link",
    {
      title: "Ссылка на покупку (виджет)",
      description: "Берёт site_url мероприятия из GET /events/:id для перехода пользователя к оплате в Qtickets.",
      inputSchema: z.object({
        eventId: z.number().int().positive(),
      }),
    },
    async ({ eventId }) => {
      const raw = await qticketsGetEvent(eventId);
      const catalog = normalizeEventCatalog(raw);
      const base = agentMcpConfiguration.qtickets.publicWidgetBaseUrl.replace(/\/$/, "");
      return createJsonTextResult({
        eventId: catalog.eventId,
        name: catalog.name,
        widgetUrl: catalog.siteUrl,
        publicWidgetBaseUrl: base,
        note: "Откройте widgetUrl в браузере пользователя для стандартной покупки в Qtickets.",
      });
    }
  );

  server.registerTool(
    "get_order_summary",
    {
      title: "Сводка по заказу",
      description:
        "GET /orders/:id — статус оплаты, payment_url, состав (для опроса после выдачи ссылки на оплату).",
      inputSchema: z.object({
        orderId: z.number().int().positive(),
      }),
    },
    async ({ orderId }) => {
      const raw = await qticketsGetOrder(orderId);
      const data = raw?.data ?? raw;
      const baskets = Array.isArray(data?.baskets) ? data.baskets : [];
      return createJsonTextResult({
        orderId: data?.id ?? orderId,
        uniqid: data?.uniqid ?? null,
        payed: data?.payed ?? null,
        payedAt: data?.payed_at ?? null,
        price: data?.price ?? null,
        currencyId: data?.currency_id ?? null,
        paymentUrl: data?.payment_url ?? null,
        ticketLines: baskets.map((basket) => ({
          showId: basket?.show_id ?? null,
          quantity: basket?.quantity ?? null,
          price: basket?.price ?? null,
        })),
      });
    }
  );

  if (agentMcpConfiguration.qtickets.enableCreateOrderTool) {
    server.registerTool(
      "create_order",
      {
        title: "Создать заказ (POST /orders)",
        description:
          "Опасно: только после подтверждения тела запроса у поддержки Qtickets. Включение: QTICKETS_AGENT_ENABLE_CREATE_ORDER=true.",
        inputSchema: z.object({
          orderPayload: z
            .record(z.string(), z.any())
            .describe('Тело запроса, обычно { "data": { ... } }'),
        }),
      },
      async ({ orderPayload }) => {
        const raw = await qticketsCreateOrder(orderPayload);
        return createJsonTextResult(raw);
      }
    );
  }
}
