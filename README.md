# Qtickets -> Max Notifier

Простой сервис, который принимает webhook о заказе билетов из Qtickets и отправляет уведомление в Max-канал через ваш существующий механизм доставки.

## Что делает сервис

- Принимает POST на `/webhooks/qtickets`.
- Нормализует payload заказа (order id, событие, билеты, сумма, покупатель).
- Формирует короткое уведомление.
- Отправляет уведомление в Max через Bot API `platform-api.max.ru` (как в `tg2max`).

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Скопируйте `.env.example` в `.env` и заполните:

- `MAX_BOT_TOKEN` — токен бота Max (из вашего `tg2max` окружения).
- `MAX_TARGET_CHAT_ID` — канал Max. Для вашего канала: `-72889036398770`.
- `MAX_API_BASE_URL` — обычно `https://platform-api.max.ru`.
- `QTICKETS_WEBHOOK_SECRET` — общий секрет для защиты webhook.

3. Запустите сервис:

```bash
npm start
```

По умолчанию сервис слушает порт `8787`.

## Настройка webhook в Qtickets

В кабинете Qtickets укажите URL:

```text
https://<your-domain>/webhooks/qtickets
```

И добавьте в отправку заголовок с секретом (на вашей стороне):

- `x-qtickets-secret: <QTICKETS_WEBHOOK_SECRET>`

Также поддерживается:

- `x-webhook-secret: <QTICKETS_WEBHOOK_SECRET>`
- `authorization: Bearer <QTICKETS_WEBHOOK_SECRET>`

## Обогащение заказа через Qtickets API (обязательно)

Сервис всегда делает запрос в API Qtickets для чтения деталей заказа. Это нужно, чтобы гарантированно получать email, состав билетов и итоговую сумму даже при урезанном webhook payload.

- `QTICKETS_ORDER_DETAILS_URL_TEMPLATE` — опционально. По умолчанию: `https://qtickets.ru/api/rest/v1/orders/{orderId}` (см. [REST API Qtickets](https://qtickets.help/article/rest-api/)). Переопределяйте только если нужен другой endpoint.
- `QTICKETS_API_TOKEN` — токен доступа к API Qtickets.
- `QTICKETS_API_AUTH_HEADER_NAME` — имя заголовка авторизации (по умолчанию `authorization`).
- `QTICKETS_API_AUTH_SCHEME` — схема авторизации перед токеном (по умолчанию `Bearer`).
- `QTICKETS_API_REQUEST_TIMEOUT_MS` — таймаут запроса в миллисекундах.

Пример:

```text
QTICKETS_ORDER_DETAILS_URL_TEMPLATE=https://qtickets.app/api/.../orders/{orderId}
QTICKETS_API_TOKEN=your_qtickets_api_token
QTICKETS_API_AUTH_HEADER_NAME=authorization
QTICKETS_API_AUTH_SCHEME=Bearer
```

Сервис сначала принимает webhook, затем по `orderId` запрашивает детали заказа из API. Если API недоступен или не вернул данные, webhook завершается ошибкой и уведомление в Max не отправляется.

## Тестовый запрос

```bash
curl -X POST "http://localhost:8787/webhooks/qtickets" \
  -H "content-type: application/json" \
  -H "x-qtickets-secret: test-secret" \
  -d "{\"order\":{\"id\":123,\"status\":\"paid\",\"amount\":2500,\"currency\":\"RUB\",\"tickets\":[{\"quantity\":2}]},\"event\":{\"title\":\"Экскурсия на миниферму\",\"start_at\":\"2026-04-12T12:00:00+03:00\"}}"
```

## Адаптация под ваш Max API

Файл `src/max-client.js` уже использует тот же базовый подход, что и `tg2max`:
- запрос `POST /messages?chat_id=...`
- заголовок `Authorization: <MAX_BOT_TOKEN>`
- JSON body с текстом уведомления

Если потребуется, можно менять только `buildMaxMessageBody()`.

## Проверка

```bash
npm test
```

---

Справка Qtickets API: [qtickets.help / API](https://qtickets.help/article-categories/api/)
