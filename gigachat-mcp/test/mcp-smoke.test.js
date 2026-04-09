import assert from "node:assert/strict";
import { test } from "node:test";

import { createQticketsMcpServer } from "../src/index.js";

test("createQticketsMcpServer builds McpServer with underlying Server", () => {
  const mcp = createQticketsMcpServer();
  assert.equal(typeof mcp.connect, "function");
  assert.ok(mcp.server);
});
