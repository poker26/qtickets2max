# MCP-сервер GigaChat × Sber Commerce (mcp-integration)

Реализация сценария **[Интеграция с MCP серверами партнёра](https://developers.sber.ru/docs/ru/gigachat/guides/mcp/sberpay/mcp-integration)** поверх [Model Context Protocol](https://modelcontextprotocol.io/) (stdio).

Каждый инструмент возвращает **JSON-RPC 2.0** в текстовом поле результата: `{ "jsonrpc": 2, "result": { "rqUid", "rsTm", ... } }` или `{ "error": { "code", "message" } }` с кодами **-32001…-32099** из спецификации.

## Инструменты (контракт Сбера)

| Имя MCP tool | Описание |
|--------------|----------|
| `get_merchant_info` | Карточка мерчанта, доставка, оплата, `sberIntegrations` |
| `get_skus` | `productSkus`; `productId` = `show:<id>` или числовой `show_id` Qtickets |
| `calculate_delivery` | Для цифровых билетов / `SBER_DIGITAL_DELIVERY_ONLY=true` — нулевая доставка |
| `create_cart_mandate` | Подпись мерчанта JWT HS256 (`SBER_MANDATE_SIGNING_SECRET`) |
| `share_fully_signed_mandate` | Сохранение мандата с `userAuthorization` |
| `share_fully_signed_cart_mandate` | То же (имя из диаграммы в доке Сбера) |
| `create_order` | Заказ в памяти + `paymentInfo.paymentUrl` |
| `get_order_status` | Статус по `orderId` |

Общие поля запроса (Zod): **`rqUid`** (строго **UUID v4**), **`rqTm`**, **`clientInfo`** (`clientInfoToken`, `sberId`, `accessToken`), опционально **`jsonRpcId`**.

## Обязательные переменные

- **`SBER_MANDATE_SIGNING_SECRET`** — минимум 16 символов (без него процесс не стартует).
- **`SBER_MERCHANT_NAME`** и остальной профиль — задайте реальные значения перед подачей на проверку.

## Диагностика Qtickets (не часть контракта Сбера)

При **`MCP_REGISTER_QTICKETS_TOOLS=true`** дополнительно регистрируются `qtickets_*` (каталог, места, заказы). Нужен **`QTICKETS_API_TOKEN`** для реальных вызовов API.

## Установка и запуск

```bash
cd gigachat-mcp
npm install
```

Скопируйте [`.env.example`](./.env.example) в `.env`, заполните секреты и профиль мерчанта.

```bash
npm start
```

Health (отдельный процесс): `npm run start:http` → `GET /health`.

## Ограничения и дальнейшая доработка

- Подпись мандата сейчас **HS256** с симметричным секретом. Если Сбер потребует **RS256** и выданный ключ — замените реализацию в [`src/sber/mandate-signing.js`](src/sber/mandate-signing.js).
- Заказы и мандаты хранятся **в памяти** процесса; для продакшена понадится БД.
- **`create_order`** не вызывает автоматически Qtickets `POST /orders` (контракт уточняйте у Qtickets); при необходимости добавьте слияние отдельно.

Чеклист партнёра: [docs/sber-gigachat-partner-checklist.md](../docs/sber-gigachat-partner-checklist.md).
