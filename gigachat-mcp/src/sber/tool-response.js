/**
 * Тело ответа в стиле JSON-RPC 2.0, как в примерах mcp-integration.
 * Клиент GigaChat может оборачивать транспорт; здесь — каноничная структура для проверки.
 *
 * @param {string} rqUid
 * @param {Record<string, unknown>} resultFields поля result помимо rqUid и rsTm
 * @param {string | number | null} [jsonRpcId]
 */
export function buildSberJsonRpcSuccess(rqUid, resultFields, jsonRpcId = null) {
  return {
    jsonrpc: 2,
    id: jsonRpcId,
    result: {
      rqUid,
      rsTm: new Date().toISOString(),
      ...resultFields,
    },
  };
}

/**
 * @param {number} code
 * @param {string} message
 * @param {string | number | null} [jsonRpcId]
 */
export function buildSberJsonRpcError(code, message, jsonRpcId = null) {
  return {
    jsonrpc: 2,
    id: jsonRpcId,
    error: {
      code,
      message,
    },
  };
}

/**
 * @param {Record<string, unknown>} jsonRpcPayload
 */
export function mcpTextResultFromJsonRpc(jsonRpcPayload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(jsonRpcPayload, null, 2),
      },
    ],
  };
}
