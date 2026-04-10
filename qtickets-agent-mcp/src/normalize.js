/**
 * Упрощённые структуры для агентов (Manus, Cursor, и т.д.).
 */

function unwrapData(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

/**
 * @param {unknown} listResponse ответ GET /events
 */
export function normalizeEventList(listResponse) {
  const root = unwrapData(listResponse);
  const rows = Array.isArray(root) ? root : root?.data;
  if (!Array.isArray(rows)) {
    return { events: [], paging: listResponse?.paging ?? null, note: "unexpected_list_shape" };
  }

  const events = rows.map((row) => ({
    id: row?.id ?? null,
    name: row?.name ?? null,
    isActive: row?.is_active ?? null,
    siteUrl: row?.site_url ?? null,
    currencyId: row?.currency_id ?? null,
    placeName: row?.place_name ?? null,
    placeAddress: row?.place_address ?? null,
  }));

  return {
    events,
    paging: listResponse?.paging ?? root?.paging ?? null,
  };
}

/**
 * @param {unknown} eventResponse ответ GET /events/:id
 */
export function normalizeEventCatalog(eventResponse) {
  const eventData = unwrapData(eventResponse);
  if (!eventData || typeof eventData !== "object") {
    return { error: "empty_event", raw: eventResponse };
  }

  const showsRaw = Array.isArray(eventData.shows) ? eventData.shows : [];

  const shows = showsRaw.map((show) => {
    const pricesRaw = Array.isArray(show.prices) ? show.prices : [];
    const priceTiers = pricesRaw.map((priceRow, index) => ({
      tierIndex: index,
      priceId: priceRow?.id ?? null,
      amount: priceRow?.default_price ?? null,
      currencyId: eventData.currency_id ?? null,
      colorTheme: priceRow?.color_theme ?? null,
    }));

    return {
      showId: show?.id ?? null,
      startDate: show?.start_date ?? null,
      finishDate: show?.finish_date ?? null,
      saleStartDate: show?.sale_start_date ?? null,
      saleFinishDate: show?.sale_finish_date ?? null,
      isActive: show?.is_active ?? null,
      priceTiers,
      /** Для агента: один show = один «сеанс» покупки; тарифы — priceTiers */
      agentHint:
        priceTiers.length > 0
          ? "Каждый priceTier — возможный «вид билета» по цене; уточните места через get_show_availability."
          : "Тарифы не перечислены в ответе; используйте get_show_availability для цен по местам.",
    };
  });

  return {
    eventId: eventData.id ?? null,
    name: eventData.name ?? null,
    description: eventData.description ?? null,
    siteUrl: eventData.site_url ?? null,
    currencyId: eventData.currency_id ?? null,
    placeName: eventData.place_name ?? null,
    placeAddress: eventData.place_address ?? null,
    isActive: eventData.is_active ?? null,
    shows,
    purchase: {
      primaryWidgetUrl: eventData.site_url ?? null,
      note: "Оплата обычно через виджет Qtickets по siteUrl; create_order только если включён QTICKETS_AGENT_ENABLE_CREATE_ORDER и подтверждён контракт API.",
    },
  };
}

/**
 * @param {unknown} seatsResponse ответ GET /shows/:id/seats (flat)
 */
export function normalizeShowAvailability(seatsResponse, showId) {
  const data = unwrapData(seatsResponse);
  if (!data || typeof data !== "object") {
    return { showId, totalFreeQuantity: 0, byPrice: {}, seatsInspected: 0 };
  }

  const entries = Object.values(data);
  let totalFree = 0;
  /** @type {Record<string, { freeQuantity: number, sampleSeatIds: string[] }>} */
  const byPrice = {};

  for (const seat of entries) {
    if (!seat || typeof seat !== "object") {
      continue;
    }
    const freeQuantity = Number(seat.free_quantity);
    const addFree = Number.isFinite(freeQuantity) ? freeQuantity : 0;
    const available = seat.available === true || seat.available === 1 || seat.available === "1";
    if (!available && addFree <= 0) {
      continue;
    }
    totalFree += addFree;
    const priceKey = String(seat.price ?? "unknown");
    if (!byPrice[priceKey]) {
      byPrice[priceKey] = { freeQuantity: 0, sampleSeatIds: [] };
    }
    byPrice[priceKey].freeQuantity += addFree;
    if (seat.id && byPrice[priceKey].sampleSeatIds.length < 5) {
      byPrice[priceKey].sampleSeatIds.push(String(seat.id));
    }
  }

  return {
    showId,
    totalFreeQuantity: totalFree,
    byPrice,
    seatsInspected: entries.length,
  };
}
