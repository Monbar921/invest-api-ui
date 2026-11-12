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
- [INVEST-001-news](../../invest-api/docs/features/INVEST-001-news/) - лента новостей, события и новости облигации
- [INVEST-001-public-mode](../../invest-api/docs/features/INVEST-001-public-mode/) - гость: облигации без входа, «Войти», возврат на ту же страницу
- [INVEST-001-broker-referral](../../invest-api/docs/features/INVEST-001-broker-referral/) - блок «Купить у брокера» в карточке и калькуляторе, учёт переходов
- [INVEST-001-seo-pages](../../invest-api/docs/features/INVEST-001-seo-pages/) - метаданные страниц, страницы эмитента и подборок
- [INVEST-001-plans](../../invest-api/docs/features/INVEST-001-plans/) - страница «Тариф», ссылка «Тарифы» у ответа `402`, подсказка у закрытой фичи
- [INVEST-001-analytics-landing](../../invest-api/docs/features/INVEST-001-analytics-landing/) - продуктовая аналитика с баннером согласия, лендинг для гостя на `/`
