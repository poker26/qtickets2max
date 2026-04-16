function pickFirstDefined(...candidates) {
  for (const candidateValue of candidates) {
    if (candidateValue !== undefined && candidateValue !== null && candidateValue !== "") {
      return candidateValue;
    }
  }
  return null;
}

function toFiniteNumber(rawValue) {
  if (rawValue == null || rawValue === "") {
    return null;
  }
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return numericValue;
}

function toPositiveInteger(rawValue, fallbackValue = null) {
  const parsedValue = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }
  return parsedValue;
}

function collectTicketCount(payload) {
  const tickets = pickFirstDefined(
    payload?.tickets,
    payload?.order?.tickets,
    payload?.baskets,
    payload?.order?.baskets
  );
  if (Array.isArray(tickets) && tickets.length > 0) {
    let ticketCount = 0;
    for (const ticket of tickets) {
      const quantity = toFiniteNumber(
        pickFirstDefined(ticket?.quantity, ticket?.count, ticket?.qty, 1)
      );
      ticketCount += quantity ?? 0;
    }
    if (ticketCount > 0) {
      return ticketCount;
    }
  }

  return (
    toFiniteNumber(
      pickFirstDefined(
        payload?.tickets_count,
        payload?.ticket_count,
        payload?.order?.tickets_count,
        payload?.order?.ticket_count,
        payload?.quantity
      )
    ) ?? 0
  );
}

function collectTicketLineItems(payload, currency) {
  const tickets = pickFirstDefined(
    payload?.tickets,
    payload?.order?.tickets,
    payload?.baskets,
    payload?.order?.baskets
  );
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return [];
  }

  const ticketLineItems = [];
  for (const ticket of tickets) {
    const ticketTitle =
      pickFirstDefined(
        ticket?.title,
        ticket?.name,
        ticket?.ticket_name,
        ticket?.ticket_type_name,
        ticket?.tariff_name,
        ticket?.seat_name
      ) ?? "Билет";

    const ticketUnitPrice = toFiniteNumber(
      pickFirstDefined(ticket?.price, ticket?.amount, ticket?.cost, ticket?.tariff_price)
    );

    const ticketQuantity = toPositiveInteger(
      pickFirstDefined(ticket?.quantity, ticket?.count, ticket?.qty, 1),
      1
    );

    for (let ticketIndex = 0; ticketIndex < ticketQuantity; ticketIndex += 1) {
      ticketLineItems.push({
        title: String(ticketTitle),
        unitPrice: ticketUnitPrice,
        currency,
      });
    }
  }

  return ticketLineItems;
}

function toIsoDate(rawValue) {
  if (!rawValue) {
    return null;
  }
  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(rawValue);
  }
  return parsedDate.toISOString();
}

function pickFirstClientPhoneFromBaskets(baskets) {
  if (!Array.isArray(baskets)) {
    return null;
  }
  for (const basket of baskets) {
    const phone = basket?.client_phone;
    if (phone != null && String(phone).trim() !== "") {
      return phone;
    }
  }
  return null;
}

function extractEventSessionDateIso(payload) {
  const directSessionDate = pickFirstDefined(
    payload?.event_date,
    payload?.event?.date_start,
    payload?.event?.start_at,
    payload?.order?.event_date
  );
  if (directSessionDate) {
    return toIsoDate(directSessionDate);
  }

  const event = payload?.event;
  const shows = event?.shows;
  if (!Array.isArray(shows) || shows.length === 0) {
    return null;
  }

  const basketShowId = pickFirstDefined(
    payload?.baskets?.[0]?.show_id,
    payload?.order?.baskets?.[0]?.show_id
  );

  if (basketShowId != null && String(basketShowId).trim() !== "") {
    const matchedShow = shows.find((show) => String(show?.id) === String(basketShowId));
    if (matchedShow) {
      const sessionStart = pickFirstDefined(
        matchedShow.start_date,
        matchedShow.open_date,
        matchedShow.start_at,
        matchedShow.finish_date
      );
      if (sessionStart) {
        return toIsoDate(sessionStart);
      }
    }
  }

  if (shows.length === 1) {
    const onlyShow = shows[0];
    const sessionStart = pickFirstDefined(
      onlyShow?.start_date,
      onlyShow?.open_date,
      onlyShow?.start_at
    );
    if (sessionStart) {
      return toIsoDate(sessionStart);
    }
  }

  const firstShow = shows[0];
  const sessionStart = pickFirstDefined(
    firstShow?.start_date,
    firstShow?.open_date,
    firstShow?.start_at
  );
  return sessionStart ? toIsoDate(sessionStart) : null;
}

function extractOrderDetailsUrl(payload, orderId) {
  const explicitOrderUrl = pickFirstDefined(
    payload?.order_url,
    payload?.order?.url,
    payload?.order?.update_url,
    payload?.links?.order,
    payload?.data?.order_url
  );

  if (explicitOrderUrl) {
    return String(explicitOrderUrl);
  }

  if (orderId && orderId !== "unknown") {
    return `https://qtickets.app/orders/update/${orderId}`;
  }

  return null;
}

function extractClientDetailsUrl(payload) {
  const explicitClientUrl = pickFirstDefined(
    payload?.client_url,
    payload?.client?.url,
    payload?.order?.client_url,
    payload?.order?.customer_url,
    payload?.customer_url,
    payload?.links?.client,
    payload?.data?.client_url
  );

  if (explicitClientUrl) {
    return String(explicitClientUrl);
  }

  const clientId = pickFirstDefined(
    payload?.client_id,
    payload?.client?.id,
    payload?.order?.client_id,
    payload?.order?.customer_id,
    payload?.customer?.id
  );

  if (clientId) {
    return `https://qtickets.app/clients/update/${clientId}`;
  }

  return null;
}

function extractUtmTags(payload) {
  const nestedUtmTags = pickFirstDefined(
    payload?.utm,
    payload?.utm_tags,
    payload?.order?.utm,
    payload?.order?.utm_tags
  );

  if (nestedUtmTags && typeof nestedUtmTags === "object") {
    return Object.entries(nestedUtmTags).filter(([, utmValue]) => {
      return utmValue != null && String(utmValue).trim() !== "";
    });
  }

  const flatUtmEntries = [
    ["utm_source", payload?.utm_source ?? payload?.order?.utm_source],
    ["utm_medium", payload?.utm_medium ?? payload?.order?.utm_medium],
    ["utm_campaign", payload?.utm_campaign ?? payload?.order?.utm_campaign],
    ["utm_content", payload?.utm_content ?? payload?.order?.utm_content],
    ["utm_term", payload?.utm_term ?? payload?.order?.utm_term],
  ].filter(([, utmValue]) => utmValue != null && String(utmValue).trim() !== "");

  return flatUtmEntries;
}

export function normalizeQticketsOrderNotification(payload) {
  const orderId = pickFirstDefined(
    payload?.order_id,
    payload?.order?.id,
    payload?.id,
    payload?.data?.order_id
  );
  const eventName = pickFirstDefined(
    payload?.event_name,
    payload?.event?.name,
    payload?.event?.title,
    payload?.order?.event_name
  );
  const eventDateIso = extractEventSessionDateIso(payload);
  const buyerName = pickFirstDefined(
    payload?.customer_name,
    payload?.buyer_name,
    payload?.order?.customer_name,
    payload?.order?.buyer_name,
    payload?.client?.details?.name
  );
  const buyerPhone = pickFirstDefined(
    payload?.customer_phone,
    payload?.buyer_phone,
    payload?.order?.customer_phone,
    payload?.client?.details?.phone,
    pickFirstClientPhoneFromBaskets(payload?.baskets),
    pickFirstClientPhoneFromBaskets(payload?.order?.baskets)
  );
  const buyerEmail = pickFirstDefined(
    payload?.customer_email,
    payload?.buyer_email,
    payload?.order?.customer_email,
    payload?.client?.email,
    payload?.baskets?.[0]?.client_email
  );
  const totalAmount = toFiniteNumber(
    pickFirstDefined(
      payload?.total,
      payload?.amount,
      payload?.price,
      payload?.order?.total,
      payload?.order?.amount,
      payload?.order?.price
    )
  );
  const currency = pickFirstDefined(
    payload?.currency,
    payload?.currency_id,
    payload?.order?.currency,
    payload?.order?.currency_id,
    "RUB"
  );
  const ticketCount = collectTicketCount(payload);
  const ticketLineItems = collectTicketLineItems(payload, String(currency ?? "RUB"));
  const orderStatus = pickFirstDefined(
    payload?.status,
    payload?.order?.status,
    payload?.payed === true ? "paid" : null,
    payload?.payed === false ? "not_paid" : null,
    "new"
  );
  const orderDetailsUrl = extractOrderDetailsUrl(payload, orderId ? String(orderId) : "unknown");
  const clientDetailsUrl = extractClientDetailsUrl(payload);
  const utmTags = extractUtmTags(payload);

  return {
    orderId: orderId ? String(orderId) : "unknown",
    orderStatus: String(orderStatus),
    eventName: eventName ? String(eventName) : "Экскурсия на миниферму",
    eventDateIso,
    ticketCount,
    ticketLineItems,
    totalAmount,
    currency: currency ? String(currency) : "RUB",
    buyerName: buyerName ? String(buyerName) : null,
    buyerPhone: buyerPhone ? String(buyerPhone) : null,
    buyerEmail: buyerEmail ? String(buyerEmail) : null,
    orderDetailsUrl,
    clientDetailsUrl,
    utmTags,
    rawPayload: payload,
  };
}

function formatMoney(amount, currency) {
  if (amount == null) {
    return "не указана";
  }
  const normalizedCurrency = String(currency ?? "").toUpperCase();
  if (normalizedCurrency === "RUB") {
    const numberFormatter = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${numberFormatter.format(amount)} руб.`;
  }

  const currencyFormatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: normalizedCurrency || "RUB",
    maximumFractionDigits: 2,
  });
  return currencyFormatter.format(amount);
}

function formatEventDateForMessage(eventDateIso) {
  if (!eventDateIso) {
    return null;
  }

  const eventDate = new Date(eventDateIso);
  if (Number.isNaN(eventDate.getTime())) {
    return String(eventDateIso);
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return formatter.format(eventDate);
}

function formatBuyerEmailLine(normalizedOrder) {
  const buyerEmailText = normalizedOrder.buyerEmail ?? "не указан";
  if (!normalizedOrder.clientDetailsUrl) {
    return buyerEmailText;
  }
  return `${buyerEmailText} (${normalizedOrder.clientDetailsUrl})`;
}

function formatTicketCompositionLines(normalizedOrder) {
  const lineItems = Array.isArray(normalizedOrder.ticketLineItems)
    ? normalizedOrder.ticketLineItems
    : [];

  if (lineItems.length === 0) {
    if (normalizedOrder.ticketCount > 0) {
      const fallbackLines = [];
      for (let ticketIndex = 0; ticketIndex < normalizedOrder.ticketCount; ticketIndex += 1) {
        fallbackLines.push(`${ticketIndex + 1}) Билет (цена не указана)`);
      }
      return fallbackLines;
    }
    return ["1) Билет (цена не указана)"];
  }

  return lineItems.map((lineItem, lineIndex) => {
    return `${lineIndex + 1}) ${lineItem.title} (${formatMoney(lineItem.unitPrice, lineItem.currency)})`;
  });
}

function formatUtmTags(utmTags) {
  if (!Array.isArray(utmTags) || utmTags.length === 0) {
    return "отсутствуют";
  }

  return utmTags
    .map(([utmName, utmValue]) => `${String(utmName)}: ${String(utmValue)}`)
    .join("\n");
}

export function formatNotificationMessage(normalizedOrder, messagePrefix) {
  const _ignoredMessagePrefix = messagePrefix;
  void _ignoredMessagePrefix;

  const lines = [];
  lines.push("Мероприятие");
  lines.push(normalizedOrder.eventName);

  const formattedEventDate = formatEventDateForMessage(normalizedOrder.eventDateIso);
  if (formattedEventDate) {
    lines.push(formattedEventDate);
  }

  lines.push("");
  lines.push("Email");
  lines.push(formatBuyerEmailLine(normalizedOrder));

  lines.push("");
  lines.push("Телефон");
  lines.push(normalizedOrder.buyerPhone ? String(normalizedOrder.buyerPhone) : "не указан");

  lines.push("");
  lines.push("Состав заказа");
  lines.push(...formatTicketCompositionLines(normalizedOrder));
  lines.push(`Итого: ${formatMoney(normalizedOrder.totalAmount, normalizedOrder.currency)}`);

  lines.push("");
  lines.push("UTM-метки");
  lines.push(formatUtmTags(normalizedOrder.utmTags));

  lines.push("");
  lines.push("Подробнее");
  lines.push(normalizedOrder.orderDetailsUrl ?? "ссылка недоступна");

  return lines.join("\n");
}
