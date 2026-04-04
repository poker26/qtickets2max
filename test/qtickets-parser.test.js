import test from "node:test";
import assert from "node:assert/strict";
import {
  formatNotificationMessage,
  normalizeQticketsOrderNotification,
} from "../src/qtickets-parser.js";

test("normalizeQticketsOrderNotification extracts core fields", () => {
  const inputPayload = {
    order: {
      id: 789,
      status: "paid",
      amount: 4500,
      currency: "RUB",
      tickets: [{ quantity: 2 }, { quantity: 1, name: "Детский билет", price: 500 }],
      customer_name: "Иван Петров",
      customer_phone: "+79991234567",
      customer_email: "ivan@example.com",
      client_id: 9433743,
    },
    event: {
      title: "Экскурсия на миниферму",
      start_at: "2026-04-01T09:00:00+03:00",
    },
  };

  const normalizedOrder = normalizeQticketsOrderNotification(inputPayload);
  assert.equal(normalizedOrder.orderId, "789");
  assert.equal(normalizedOrder.orderStatus, "paid");
  assert.equal(normalizedOrder.eventName, "Экскурсия на миниферму");
  assert.equal(normalizedOrder.ticketCount, 3);
  assert.equal(normalizedOrder.totalAmount, 4500);
  assert.equal(normalizedOrder.buyerName, "Иван Петров");
  assert.equal(normalizedOrder.clientDetailsUrl, "https://qtickets.app/clients/update/9433743");
  assert.equal(normalizedOrder.orderDetailsUrl, "https://qtickets.app/orders/update/789");
  assert.equal(normalizedOrder.ticketLineItems.length, 3);
});

test("formatNotificationMessage produces requested layout", () => {
  const normalizedOrder = {
    orderId: "18365923",
    orderStatus: "paid",
    eventName: "В гости к альпакам",
    eventDateIso: "2026-04-04T12:00:00+03:00",
    ticketCount: 2,
    ticketLineItems: [
      { title: "Взрослый билет", unitPrice: 2000, currency: "RUB" },
      { title: "Взрослый билет", unitPrice: 2000, currency: "RUB" },
    ],
    totalAmount: 4000,
    currency: "RUB",
    buyerName: null,
    buyerPhone: null,
    buyerEmail: "snaii@mail.ru",
    clientDetailsUrl: "https://qtickets.app/clients/update/9433743",
    orderDetailsUrl: "https://qtickets.app/orders/update/18365923",
    utmTags: [],
  };

  const message = formatNotificationMessage(normalizedOrder, "[MiniFarm]");
  assert.match(message, /^Мероприятие/m);
  assert.match(message, /В гости к альпакам/);
  assert.match(message, /Email/);
  assert.match(message, /snaii@mail\.ru \(https:\/\/qtickets\.app\/clients\/update\/9433743\)/);
  assert.match(message, /1\) Взрослый билет \(2[\s\u00A0]000 руб\.\)/u);
  assert.match(message, /2\) Взрослый билет \(2[\s\u00A0]000 руб\.\)/u);
  assert.match(message, /Итого: 4[\s\u00A0]000 руб\./u);
  assert.match(message, /UTM-метки\nотсутствуют/);
  assert.match(message, /Подробнее\nhttps:\/\/qtickets\.app\/orders\/update\/18365923/);
});

test("normalizeQticketsOrderNotification supports Qtickets REST order payload", () => {
  const qticketsApiPayload = {
    id: 18393844,
    payed: true,
    price: 6000,
    currency_id: "RUB",
    client_id: 9442900,
    client: {
      id: 9442900,
      email: "asavostyan@gmail.com",
      details: {
        phone: "+79169651309",
      },
    },
    baskets: [
      { seat_name: "Детский билет", price: 1000, quantity: 1 },
      { seat_name: "Детский билет", price: 1000, quantity: 1 },
      { seat_name: "Взрослый билет", price: 2000, quantity: 1 },
      { seat_name: "Взрослый билет", price: 2000, quantity: 1 },
    ],
  };

  const normalizedOrder = normalizeQticketsOrderNotification(qticketsApiPayload);

  assert.equal(normalizedOrder.orderId, "18393844");
  assert.equal(normalizedOrder.orderStatus, "paid");
  assert.equal(normalizedOrder.totalAmount, 6000);
  assert.equal(normalizedOrder.currency, "RUB");
  assert.equal(normalizedOrder.ticketCount, 4);
  assert.equal(normalizedOrder.buyerEmail, "asavostyan@gmail.com");
  assert.equal(normalizedOrder.buyerPhone, "+79169651309");
  assert.equal(normalizedOrder.clientDetailsUrl, "https://qtickets.app/clients/update/9442900");
  assert.equal(normalizedOrder.ticketLineItems.length, 4);
  assert.equal(normalizedOrder.ticketLineItems[0].title, "Детский билет");
  assert.equal(normalizedOrder.ticketLineItems[2].title, "Взрослый билет");
});
