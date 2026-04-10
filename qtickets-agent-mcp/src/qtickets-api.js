import { agentMcpConfiguration } from "./config.js";

function createAbortSignal(timeoutMilliseconds) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Qtickets API request timeout exceeded"));
  }, timeoutMilliseconds);

  return {
    signal: abortController.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

function buildAuthorizationHeaders(apiToken, authHeaderName, authScheme) {
  const normalizedToken = String(apiToken ?? "").trim();
  if (!normalizedToken) {
    throw new Error("QTICKETS_API_TOKEN is not set");
  }

  const normalizedHeaderName = String(authHeaderName ?? "authorization").trim();
  const normalizedAuthScheme = String(authScheme ?? "").trim();
  const authorizationValue = normalizedAuthScheme
    ? `${normalizedAuthScheme} ${normalizedToken}`
    : normalizedToken;

  return {
    [normalizedHeaderName]: authorizationValue,
  };
}

export async function qticketsJsonRequest({ method, path, jsonBody }) {
  const { apiBaseUrl, apiToken, apiAuthHeaderName, apiAuthScheme, requestTimeoutMs } =
    agentMcpConfiguration.qtickets;

  const base = String(apiBaseUrl ?? "").replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const requestUrl = `${base}${normalizedPath}`;

  const requestHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    ...buildAuthorizationHeaders(apiToken, apiAuthHeaderName, apiAuthScheme),
  };

  const { signal, cleanup } = createAbortSignal(requestTimeoutMs);

  try {
    const fetchOptions = {
      method,
      headers: requestHeaders,
      signal,
    };
    if (jsonBody !== undefined && jsonBody !== null) {
      fetchOptions.body = JSON.stringify(jsonBody);
    }

    const response = await fetch(requestUrl, fetchOptions);
    const responseText = await response.text();
    let parsedBody;
    try {
      parsedBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      parsedBody = { _raw: responseText };
    }

    if (!response.ok) {
      throw new Error(
        `Qtickets API ${method} ${normalizedPath} failed (${response.status}): ${responseText || "<empty body>"}`
      );
    }

    return parsedBody;
  } finally {
    cleanup();
  }
}

export async function qticketsGetWithBody(path, jsonBody) {
  return qticketsJsonRequest({ method: "GET", path, jsonBody });
}

export async function qticketsPost(path, jsonBody) {
  return qticketsJsonRequest({ method: "POST", path, jsonBody });
}

export async function qticketsListEvents({ page = 1, orderDirection = "desc", onlyActive = true } = {}) {
  const whereClause = [{ column: "deleted_at", operator: "null" }];
  if (onlyActive) {
    whereClause.push({ column: "is_active", value: 1 });
  }
  return qticketsGetWithBody("/events", {
    where: whereClause,
    orderBy: { id: orderDirection },
    page,
  });
}

export async function qticketsGetEvent(eventId) {
  return qticketsJsonRequest({
    method: "GET",
    path: `/events/${encodeURIComponent(String(eventId))}`,
    jsonBody: undefined,
  });
}

export async function qticketsGetShowSeats(showId, seatQueryBody) {
  const path = `/shows/${encodeURIComponent(String(showId))}/seats`;
  return qticketsGetWithBody(path, seatQueryBody);
}

export async function qticketsGetOrder(orderId) {
  return qticketsJsonRequest({
    method: "GET",
    path: `/orders/${encodeURIComponent(String(orderId))}`,
    jsonBody: undefined,
  });
}

export async function qticketsCreateOrder(orderEnvelope) {
  return qticketsPost("/orders", orderEnvelope);
}
