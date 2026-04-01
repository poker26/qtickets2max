import express from "express";
import { configuration } from "./config.js";
import {
  formatNotificationMessage,
  normalizeQticketsOrderNotification,
} from "./qtickets-parser.js";
import { postOrderNotificationToMax } from "./max-client.js";

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
      const normalizedOrder = normalizeQticketsOrderNotification(request.body ?? {});
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
      response.status(500).json({
        ok: false,
        error: "Failed to process webhook",
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
