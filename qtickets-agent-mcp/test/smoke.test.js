import assert from "node:assert/strict";
import { test } from "node:test";

process.env.QTICKETS_API_TOKEN = "smoke_test_token_placeholder";

const { createQticketsAgentMcpServer } = await import("../src/index.js");

test("createQticketsAgentMcpServer builds server", () => {
  const mcp = createQticketsAgentMcpServer();
  assert.equal(typeof mcp.connect, "function");
  assert.ok(mcp.server);
});
