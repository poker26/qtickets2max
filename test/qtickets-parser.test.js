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
      tickets: [{ quantity: 2 }, { quantity: 1 }],
      customer_name: "Иван Петров",
      customer_phone: "+79991234567",
      customer_email: "ivan@example.com",
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
});

test("formatNotificationMessage produces human readable text", () => {
  const normalizedOrder = {
    orderId: "1234",
    orderStatus: "paid",
    eventName: "Экскурсия выходного дня",
    eventDateIso: "2026-04-05T09:00:00.000Z",
    ticketCount: 2,
    totalAmount: 3000,
    currency: "RUB",
    buyerName: "Мария",
    buyerPhone: null,
    buyerEmail: null,
  };

  const message = formatNotificationMessage(normalizedOrder, "[MiniFarm]");
  assert.match(message, /Новый заказ билетов/);
  assert.match(message, /Заказ: #1234/);
  assert.match(message, /Количество билетов: 2/);
  assert.match(message, /Статус: paid/);
});
