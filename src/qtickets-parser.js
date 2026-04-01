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

function collectTicketCount(payload) {
  const tickets = pickFirstDefined(payload?.tickets, payload?.order?.tickets);
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
  const eventDateIso = toIsoDate(
    pickFirstDefined(
      payload?.event_date,
      payload?.event?.date_start,
      payload?.event?.start_at,
      payload?.order?.event_date
    )
  );
  const buyerName = pickFirstDefined(
    payload?.customer_name,
    payload?.buyer_name,
    payload?.order?.customer_name,
    payload?.order?.buyer_name
  );
  const buyerPhone = pickFirstDefined(
    payload?.customer_phone,
    payload?.buyer_phone,
    payload?.order?.customer_phone
  );
  const buyerEmail = pickFirstDefined(
    payload?.customer_email,
    payload?.buyer_email,
    payload?.order?.customer_email
  );
  const totalAmount = toFiniteNumber(
    pickFirstDefined(
      payload?.total,
      payload?.amount,
      payload?.order?.total,
      payload?.order?.amount
    )
  );
  const currency = pickFirstDefined(payload?.currency, payload?.order?.currency, "RUB");
  const ticketCount = collectTicketCount(payload);
  const orderStatus = pickFirstDefined(payload?.status, payload?.order?.status, "new");

  return {
    orderId: orderId ? String(orderId) : "unknown",
    orderStatus: String(orderStatus),
    eventName: eventName ? String(eventName) : "Экскурсия на миниферму",
    eventDateIso,
    ticketCount,
    totalAmount,
    currency: currency ? String(currency) : "RUB",
    buyerName: buyerName ? String(buyerName) : null,
    buyerPhone: buyerPhone ? String(buyerPhone) : null,
    buyerEmail: buyerEmail ? String(buyerEmail) : null,
    rawPayload: payload,
  };
}

function formatMoney(amount, currency) {
  if (amount == null) {
    return "не указана";
  }
  const formatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export function formatNotificationMessage(normalizedOrder, messagePrefix) {
  const lines = [];
  lines.push(`${messagePrefix} Новый заказ билетов`);
  lines.push(`Заказ: #${normalizedOrder.orderId}`);
  lines.push(`Событие: ${normalizedOrder.eventName}`);
  if (normalizedOrder.eventDateIso) {
    lines.push(`Дата экскурсии: ${normalizedOrder.eventDateIso}`);
  }
  lines.push(`Количество билетов: ${normalizedOrder.ticketCount}`);
  lines.push(`Сумма: ${formatMoney(normalizedOrder.totalAmount, normalizedOrder.currency)}`);
  lines.push(`Статус: ${normalizedOrder.orderStatus}`);
  if (normalizedOrder.buyerName) {
    lines.push(`Покупатель: ${normalizedOrder.buyerName}`);
  }
  if (normalizedOrder.buyerPhone) {
    lines.push(`Телефон: ${normalizedOrder.buyerPhone}`);
  }
  if (normalizedOrder.buyerEmail) {
    lines.push(`Email: ${normalizedOrder.buyerEmail}`);
  }
  return lines.join("\n");
}
