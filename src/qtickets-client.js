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

function addAuthorizationHeader(headers, apiToken, authHeaderName, authScheme) {
  const normalizedToken = String(apiToken ?? "").trim();
  if (!normalizedToken) {
    return;
  }

  const normalizedHeaderName = String(authHeaderName ?? "authorization").trim();
  const normalizedAuthScheme = String(authScheme ?? "").trim();
  const authorizationValue = normalizedAuthScheme
    ? `${normalizedAuthScheme} ${normalizedToken}`
    : normalizedToken;

  headers[normalizedHeaderName] = authorizationValue;
}

function normalizeQticketsApiPayload(responseBody) {
  if (responseBody && typeof responseBody === "object") {
    if (responseBody.data && typeof responseBody.data === "object") {
      return responseBody.data;
    }
    return responseBody;
  }
  return {};
}

export async function fetchQticketsOrderDetails({
  orderDetailsUrlTemplate,
  orderId,
  apiToken,
  apiAuthHeaderName,
  apiAuthScheme,
  requestTimeoutMs,
}) {
  const requestUrl = String(orderDetailsUrlTemplate ?? "").replaceAll(
    "{orderId}",
    encodeURIComponent(String(orderId))
  );

  if (!requestUrl || !requestUrl.startsWith("http")) {
    throw new Error("QTICKETS_ORDER_DETAILS_URL_TEMPLATE is not configured correctly");
  }

  const requestHeaders = {
    accept: "application/json",
  };
  addAuthorizationHeader(requestHeaders, apiToken, apiAuthHeaderName, apiAuthScheme);

  const { signal, cleanup } = createAbortSignal(requestTimeoutMs);

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: requestHeaders,
      signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Qtickets API order details failed (${response.status}): ${responseText || "<empty body>"}`
      );
    }

    const responseBody = await response.json();
    return normalizeQticketsApiPayload(responseBody);
  } finally {
    cleanup();
  }
}
