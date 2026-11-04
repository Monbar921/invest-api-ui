# Документация invest-api-ui

| Файл                               | Что                                                                 |
| ---------------------------------- | ------------------------------------------------------------------- |
| [architecture.md](architecture.md) | стек, структура, экраны, работа с API, авторизация, состояние в URL |
| [testing.md](testing.md)           | Vitest + Testing Library, что покрыто, проверки CI                  |
| [deployment.md](deployment.md)     | dev-сервер, сборка, стенд в k3d                                     |

Правила расчёта цен, доходностей, фильтров и сортировки - на стороне бэка:
[invest-api/docs/business-rules.md](../../invest-api/docs/business-rules.md).

## Фичи

Описаны в invest-api, UI - их часть:

- [INVEST-001-bond-yield](../../invest-api/docs/features/INVEST-001-bond-yield/) - доходности, тип купона, фильтр по купону
- [INVEST-001-revenue-calculator](../../invest-api/docs/features/INVEST-001-revenue-calculator/) - калькулятор дохода
- [INVEST-001-price-chart](../../invest-api/docs/features/INVEST-001-price-chart/) - график цены
