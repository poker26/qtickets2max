import express from "express";
import { configuration } from "./config.js";
import {
  formatNotificationMessage,
  normalizeQticketsOrderNotification,
} from "./qtickets-parser.js";
import { postOrderNotificationToMax } from "./max-client.js";
import { fetchQticketsEventDetails, fetchQticketsOrderDetails } from "./qtickets-client.js";

function logWithLevel(level, message, details = null) {
  const timestamp = new Date().toISOString();
  if (details == null) {
    console.log(`[${timestamp}] [${level}] ${message}`);
    return;
  }
  console.log(`[${timestamp}] [${level}] ${message}`, details);
}

function isAuthorizedRequest(request, expectedSecret) {
  if (!expectedSecret) {
    return true;
  }

  const headerSecret = request.get("x-qtickets-secret") || request.get("x-webhook-secret");
  if (headerSecret && headerSecret === expectedSecret) {
    return true;
  }

  const authorizationHeader = request.get("authorization");
  if (authorizationHeader?.startsWith("Bearer ")) {
    const bearerToken = authorizationHeader.slice("Bearer ".length).trim();
    if (bearerToken === expectedSecret) {
      return true;
    }
  }

  return false;
}

function hasUsableValue(value) {
  if (value == null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return true;
}

function mergePayloadWithFallback(primaryPayload, fallbackPayload) {
  if (Array.isArray(primaryPayload) || Array.isArray(fallbackPayload)) {
    if (Array.isArray(primaryPayload) && primaryPayload.length > 0) {
      return primaryPayload;
    }
    if (Array.isArray(fallbackPayload)) {
      return fallbackPayload;
    }
    return primaryPayload;
  }

  if (
    primaryPayload &&
    typeof primaryPayload === "object" &&
    fallbackPayload &&
    typeof fallbackPayload === "object"
  ) {
    const mergedObject = { ...fallbackPayload };
    for (const [key, primaryValue] of Object.entries(primaryPayload)) {
      const fallbackValue = fallbackPayload[key];
      if (primaryValue && typeof primaryValue === "object" && !Array.isArray(primaryValue)) {
        mergedObject[key] = mergePayloadWithFallback(primaryValue, fallbackValue);
        continue;
      }
      mergedObject[key] = hasUsableValue(primaryValue) ? primaryValue : fallbackValue;
    }
    return mergedObject;
  }

  return hasUsableValue(primaryPayload) ? primaryPayload : fallbackPayload;
}

function createApplication() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (request, response) => {
    response.status(200).json({ ok: true, service: "qtickets-max-notifier" });
  });

  app.post("/webhooks/qtickets", async (request, response) => {
    if (!isAuthorizedRequest(request, configuration.qtickets.webhookSecret)) {
      response.status(401).json({ ok: false, error: "Unauthorized webhook request" });
      return;
    }

    try {
      const webhookPayload = request.body ?? {};
      const webhookOrder = normalizeQticketsOrderNotification(webhookPayload);
      if (!webhookOrder.orderId || webhookOrder.orderId === "unknown") {
        response.status(400).json({
          ok: false,
          error: "Webhook payload does not contain order id",
        });
        return;
      }

      if (!String(configuration.qtickets.apiToken ?? "").trim()) {
        response.status(503).json({
          ok: false,
          error:
            "QTICKETS_API_TOKEN is not set. Add it to .env (Qtickets: Настройки → Основное, токен API).",
        });
        return;
      }

      const qticketsApiPayload = await fetchQticketsOrderDetails({
        orderDetailsUrlTemplate: configuration.qtickets.orderDetailsUrlTemplate,
        orderId: webhookOrder.orderId,
        apiToken: configuration.qtickets.apiToken,
        apiAuthHeaderName: configuration.qtickets.apiAuthHeaderName,
        apiAuthScheme: configuration.qtickets.apiAuthScheme,
        requestTimeoutMs: configuration.qtickets.requestTimeoutMs,
      });

      let mergedPayload = mergePayloadWithFallback(qticketsApiPayload, webhookPayload);
      const eventIdRaw = mergedPayload?.event_id ?? mergedPayload?.order?.event_id;
      const eventIdForFetch =
        eventIdRaw != null && String(eventIdRaw).trim() !== "" ? String(eventIdRaw).trim() : null;

      if (eventIdForFetch) {
        try {
          const eventApiPayload = await fetchQticketsEventDetails({
            eventDetailsUrlTemplate: configuration.qtickets.eventDetailsUrlTemplate,
            eventId: eventIdForFetch,
            apiToken: configuration.qtickets.apiToken,
            apiAuthHeaderName: configuration.qtickets.apiAuthHeaderName,
            apiAuthScheme: configuration.qtickets.apiAuthScheme,
            requestTimeoutMs: configuration.qtickets.requestTimeoutMs,
          });
          mergedPayload = mergePayloadWithFallback({ event: eventApiPayload }, mergedPayload);
        } catch (eventFetchError) {
          logWithLevel("WARN", "Qtickets event details fetch failed; message may lack session date", {
            eventId: eventIdForFetch,
            message: eventFetchError?.message ?? String(eventFetchError),
          });
        }
      }

      const normalizedOrder = normalizeQticketsOrderNotification(mergedPayload);

      const messageText = formatNotificationMessage(
        normalizedOrder,
        configuration.max.messagePrefix
      );

      await postOrderNotificationToMax({
        apiBaseUrl: configuration.max.apiBaseUrl,
        botToken: configuration.max.botToken,
        targetChatId: configuration.max.targetChatId,
        messageText,
        requestTimeoutMs: configuration.max.requestTimeoutMs,
      });

      logWithLevel("INFO", "Order notification delivered to Max", {
        orderId: normalizedOrder.orderId,
        eventName: normalizedOrder.eventName,
      });

      response.status(200).json({
        ok: true,
        orderId: normalizedOrder.orderId,
      });
    } catch (error) {
      logWithLevel("ERROR", "Failed to process Qtickets webhook", {
        message: error?.message ?? String(error),
      });
      response.status(502).json({
        ok: false,
        error: "Failed to fetch order details from Qtickets API",
      });
    }
  });

  return app;
}

const app = createApplication();
app.listen(configuration.server.port, () => {
  logWithLevel(
    "INFO",
    `Qtickets notifier listens on port ${configuration.server.port}`
  );
});
