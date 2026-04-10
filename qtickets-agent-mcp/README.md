# Qtickets Agent MCP

**Отдельный** MCP-сервер (stdio) для агентных систем (Manus, Claude, Cursor и т.д.): выбор мероприятия, сеанса, проверка доступности, ссылка на виджет оплаты Qtickets.

Не зависит от пакета `gigachat-mcp` и интеграции со Сбером.

## Инструменты

| Tool | Назначение |
|------|------------|
| `list_published_events` | Страница мероприятий (активные, не удалённые) |
| `get_event_catalog` | Сеансы + `priceTiers` (тарифы из ответа API) |
| `get_show_availability` | Остатки по сеансу, разбивка `byPrice` |
| `get_purchase_link` | `widgetUrl` (`site_url`) для покупки в браузере |
| `get_order_summary` | Статус заказа и `payment_url` по `orderId` |
| `create_order` | Только если `QTICKETS_AGENT_ENABLE_CREATE_ORDER=true` |

Ответы — JSON в текстовом `content` tool result.

## Запуск

```bash
cd qtickets-agent-mcp
npm install
cp .env.example .env
# заполните QTICKETS_API_TOKEN
npm start
```

Подключение в клиенте MCP: команда `node` + абсолютный путь к `.../qtickets-agent-mcp/src/index.js`, рабочая директория — `qtickets-agent-mcp`, переменные окружения из `.env` (или задайте `env` в конфиге клиента).

## Документация API

[REST API Qtickets](https://qtickets.help/article/rest-api/)
