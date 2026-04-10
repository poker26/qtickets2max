import process from "node:process";
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { agentMcpConfiguration } from "./config.js";
import { registerQticketsAgentTools } from "./register-tools.js";

export function createQticketsAgentMcpServer() {
  const server = new McpServer(
    {
      name: "qtickets-agent",
      version: "0.1.0",
    },
    {
      instructions:
        "Автономный MCP для Qtickets: list_published_events, get_event_catalog (сеансы и тарифы), get_show_availability, get_purchase_link, get_order_summary; опционально create_order. Токен организатора только на сервере.",
    }
  );

  registerQticketsAgentTools(server);
  return server;
}

async function main() {
  if (!String(agentMcpConfiguration.qtickets.apiToken ?? "").trim()) {
    console.error(
      "qtickets-agent-mcp: задайте QTICKETS_API_TOKEN (Qtickets → Настройки → Основное, токен API)."
    );
    process.exitCode = 1;
    return;
  }

  const mcpServer = createQticketsAgentMcpServer();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

const isMainModule =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    console.error("qtickets-agent-mcp fatal error:", error);
    process.exitCode = 1;
  });
}
