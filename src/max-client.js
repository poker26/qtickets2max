function createAbortSignal(timeoutMilliseconds) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Max API request timeout exceeded"));
  }, timeoutMilliseconds);

  return {
    signal: abortController.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

function buildMaxMessageBody({ messageText, normalizedOrder }) {
  return {
    text: messageText,
    notify: {
      source: "qtickets",
      order: {
        id: normalizedOrder.orderId,
        status: normalizedOrder.orderStatus,
        eventName: normalizedOrder.eventName,
        eventDateIso: normalizedOrder.eventDateIso,
        ticketCount: normalizedOrder.ticketCount,
        totalAmount: normalizedOrder.totalAmount,
        currency: normalizedOrder.currency,
        buyerName: normalizedOrder.buyerName,
        buyerPhone: normalizedOrder.buyerPhone,
        buyerEmail: normalizedOrder.buyerEmail,
      },
    },
  };
}

export async function postOrderNotificationToMax({
  apiBaseUrl,
  botToken,
  targetChatId,
  messageText,
  normalizedOrder,
  requestTimeoutMs,
}) {
  const requestBody = buildMaxMessageBody({
    messageText,
    normalizedOrder,
  });
  const { signal, cleanup } = createAbortSignal(requestTimeoutMs);
  const requestUrl = new URL("/messages", apiBaseUrl);
  requestUrl.searchParams.set("chat_id", String(targetChatId).trim());

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: String(botToken).trim(),
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `Max API /messages failed (${response.status}): ${responseBody || "<empty body>"}`
      );
    }
  } finally {
    cleanup();
  }
}
