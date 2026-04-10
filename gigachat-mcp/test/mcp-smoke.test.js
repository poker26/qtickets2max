import assert from "node:assert/strict";
import { test } from "node:test";

process.env.SBER_MANDATE_SIGNING_SECRET = "unit_test_secret_minimum_16";

const { createGigaChatCommerceMcpServer } = await import("../src/index.js");

test("createGigaChatCommerceMcpServer builds McpServer with underlying Server", () => {
  const mcp = createGigaChatCommerceMcpServer();
  assert.equal(typeof mcp.connect, "function");
  assert.ok(mcp.server);
});
