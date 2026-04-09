# MCP-сервер Qtickets для сценариев вроде GigaChat

Реализует [Model Context Protocol](https://modelcontextprotocol.io/) поверх **stdio** и вызывает [REST API Qtickets](https://qtickets.help/article/rest-api/) для каталога, наличия мест и заказов.

Связка с экосистемой Сбера (пилот, SberPay, Сбер ID) описана в [docs/sber-gigachat-partner-checklist.md](../docs/sber-gigachat-partner-checklist.md).

## Инструменты (tools)

| Имя | Назначение |
|-----|------------|
| `qtickets_list_events` | Список мероприятий (страница) |
| `qtickets_get_event` | Мероприятие по id, сеансы, цены |
| `qtickets_get_show_seats` | Места / доступность для `show_id` |
| `qtickets_get_order` | Заказ по id (`payment_url`, `baskets`, …) |
| `qtickets_checkout_hint` | Подсказка: режим оплаты из env и кратко по сеансам |
| `qtickets_create_order` | Только если `QTICKETS_ENABLE_CREATE_ORDER=true` — `POST /orders` |

## Установка

```bash
cd gigachat-mcp
npm install
```

Скопируйте `.env.example` в `.env` и задайте **`QTICKETS_API_TOKEN`**.

## Запуск (stdio)

```bash
npm start
```

Клиент MCP (в т.ч. GigaChat после согласования) подключается как подпроцесс: stdin/stdout.

## Health-check по HTTP (отдельный процесс)

Для мониторинга за **nginx** на прод-сервере можно запустить второй процесс:

```bash
npm run start:http
```

По умолчанию слушает порт **`8790`**: `GET /health`, `GET /`.

**Важно:** это не замена транспорта MCP; удалённый транспорт для GigaChat задаётся в пилоте Сбера (при необходимости добавьте адаптер позже).

## Развёртывание за HTTPS

1. На хосте с Node.js поднимите **stdio**-MCP через процесс-менеджер (например **systemd** `ExecStart=/usr/bin/node .../gigachat-mcp/src/index.js` с переменными из окружения) **или** тот способ, который задаст куратор пилота GigaChat.
2. **nginx** обычно проксирует **приложение с HTTP API**; для чистого stdio-MCP прокси не нужен, нужен лишь запуск процесса на стороне интегратора чата.
3. Храните **токен API** только в переменных окружения на сервере.

## Переменные окружения

См. [`.env.example`](./.env.example). Ключевые:

- **`QTICKETS_CHECKOUT_MODE`** — `redirect_widget` | `payment_url_after_create` (см. [docs/gigachat-payment-flow.md](../docs/gigachat-payment-flow.md)).
- **`QTICKETS_ENABLE_CREATE_ORDER`** — `true` только после ответа поддержки Qtickets по `POST /orders`.

## Вопросы в поддержку Qtickets

Шаблон: [docs/qtickets-api-support-questions.md](../docs/qtickets-api-support-questions.md).
