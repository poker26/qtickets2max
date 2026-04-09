import "dotenv/config";
import express from "express";

import { gigachatMcpConfiguration } from "./config.js";

/**
 * Лёгкий HTTP-процесс для прод-сервера: health-check и статическая подсказка по развёртыванию.
 * Сам протокол MCP в этом пакете по умолчанию — stdio (см. `npm start`).
 * Транспорт для удалённого GigaChat уточняйте у куратора пилота Сбера.
 */
const application = express();

application.get("/health", (_request, response) => {
  response.status(200).json({
    ok: true,
    service: "gigachat-mcp-qtickets",
    hasApiToken: Boolean(String(gigachatMcpConfiguration.qtickets.apiToken ?? "").trim()),
    checkoutMode: gigachatMcpConfiguration.qtickets.checkoutMode,
  });
});

application.get("/", (_request, response) => {
  response.type("text/plain; charset=utf-8").send(
    [
      "gigachat-mcp-qtickets: MCP-сервер для Qtickets.",
      "Основной режим: stdio (запуск через node src/index.js или npm start).",
      "Этот порт — только health и справка; за nginx используйте /health для мониторинга.",
      "Документация: gigachat-mcp/README.md",
    ].join("\n")
  );
});

const port = gigachatMcpConfiguration.httpHealth.port;
application.listen(port, () => {
  console.error(`gigachat-mcp health listen on port ${port}`);
});
