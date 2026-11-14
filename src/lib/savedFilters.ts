import { fromFilterScope } from '../api/filters';
import type { SavedFilter } from '../api/types';
import { fromBondParameters, type BondSearchState } from './bondSearchParams';

/** Состояние таблицы облигаций, которое задаёт сохранённый фильтр: его вид, фильтры и сортировка, первая страница */
export function savedFilterState(filter: SavedFilter): BondSearchState {
  return fromBondParameters(fromFilterScope(filter.scope), filter.parameters);
}
