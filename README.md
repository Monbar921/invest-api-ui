# invest-api-ui

UI для [invest-api](https://github.com/Monbar921/invest-api): таблица облигаций с фильтрами и карточка облигации с графиком купонных выплат.

Стек: React 19 + TypeScript, Vite, Mantine 9 (`mantine-datatable` для таблицы, `@mantine/charts` для графика), TanStack Query, React Router.

## Запуск

Нужен Node 24 и запущенный invest-api (по умолчанию `http://localhost:8080`).

```bash
npm install
npm run dev
```

UI откроется на http://localhost:5173. Адрес бэка задаётся в `.env` (см. `.env.example`):

```
VITE_API_URL=http://localhost:8080
```

Бэк пускает браузерные запросы только с адресов из `ru.invest.api.cors.allowed-origins`
(по умолчанию `http://localhost:5173` и `http://127.0.0.1:5173`). Dev-сервер слушает IPv4 `127.0.0.1`:
на некоторых машинах подключения к IPv6-loopback `[::1]` закрыты, и страница бы не открылась.
Если UI запущен на другом адресе или порту, его нужно добавить туда.

## Команды

| Команда           | Что делает                        |
| ----------------- | --------------------------------- |
| `npm run dev`     | dev-сервер с hot reload           |
| `npm run build`   | проверка типов и сборка в `dist/` |
| `npm run preview` | раздача собранного `dist/`        |
| `npm test`        | тесты (Vitest + Testing Library)  |
| `npm run lint`    | ESLint                            |
| `npm run format`  | Prettier                          |

## Экраны

- `/bonds` - облигации: вкладки «Все / Рублёвые / Валютные», фильтры по цене в рублях и в % от номинала, риску и ОФЗ,
  сортировка по колонкам, серверная пагинация. Всё состояние таблицы хранится в URL - выборку можно сохранить ссылкой.
- `/bonds/:ticker` - карточка: цена, номинал, купон, погашение, ближайшая выплата и график выплат.

## API

Используются эндпоинты invest-api:

- `POST /internal/rest/bonds/{all|local|foreign}/page?page=&size=` - страница облигаций, в теле фильтры и сортировка
- `GET /internal/rest/bonds/{ticker}` - облигация с графиком выплат

Типы ответов описаны вручную в `src/api/types.ts` и повторяют DTO из модуля `invest-api-dto`.
