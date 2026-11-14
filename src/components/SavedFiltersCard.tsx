import { ActionIcon, Anchor, Card, Group, Loader, Popover, Stack, Switch, Text, Button, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useSavedFilterMutations, useSavedFilters } from '../api/queries';
import type { SavedFilter } from '../api/types';
import { toSearchParams } from '../lib/bondSearchParams';
import { formatNumber } from '../lib/format';
import { savedFilterState } from '../lib/savedFilters';
import { ApiErrorText } from './ApiErrorText';
import { ErrorState } from './ErrorState';

/**
 * Сохранённые фильтры на странице «Уведомления»: открыть в списке облигаций, включить уведомления о новых облигациях
 * в выборке, удалить. Сохраняются фильтры кнопкой «Мои фильтры» над таблицей облигаций.
 */
export function SavedFiltersCard() {
  const filters = useSavedFilters();
  const { update } = useSavedFilterMutations();

  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Text fw={500}>Фильтры облигаций</Text>
        <Text size="xs" c="dimmed">
          После обновления цен - сообщение о каждой облигации, которая впервые попала в выборку фильтра. Сохранить фильтр -
          кнопкой «Мои фильтры» над{' '}
          <Anchor component={Link} to="/bonds" size="xs">
            таблицей облигаций
          </Anchor>
          .
        </Text>
        {filters.isPending && <Loader size="sm" />}
        {filters.isError && <ErrorState error={filters.error} onRetry={() => void filters.refetch()} />}
        {filters.data?.length === 0 && (
          <Text size="sm" c="dimmed">
            Сохранённых фильтров нет.
          </Text>
        )}
        {filters.data?.map((filter) => (
          <FilterRow key={filter.id} filter={filter} />
        ))}
        {update.error && <ApiErrorText error={update.error} />}
      </Stack>
    </Card>
  );
}

function FilterRow({ filter }: { filter: SavedFilter }) {
  const { update, remove } = useSavedFilterMutations();
  const [confirming, setConfirming] = useState(false);
  const link = `/bonds?${toSearchParams(savedFilterState(filter)).toString()}`;

  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <div style={{ minWidth: 0 }}>
        <Anchor component={Link} to={link} fw={500}>
          {filter.name}
        </Anchor>
        {filter.matches != null && (
          <Text size="xs" c="dimmed">
            в выборке {formatNumber(filter.matches)}
          </Text>
        )}
      </div>
      <Group gap="xs" wrap="nowrap">
        <Switch
          checked={filter.notify}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ id: filter.id, notify: event.currentTarget.checked })}
          label="Уведомлять"
          aria-label={`Уведомлять о новых облигациях: ${filter.name}`}
        />
        <Popover opened={confirming} onChange={setConfirming} position="bottom-end" withArrow shadow="md">
          <Popover.Target>
            <Tooltip label="Удалить фильтр" disabled={confirming}>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Удалить фильтр: ${filter.name}`}
                onClick={() => setConfirming((value) => !value)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              <Text size="sm">Удалить фильтр «{filter.name}» и уведомления по нему?</Text>
              <Group gap="xs" justify="flex-end">
                <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
                  Отмена
                </Button>
                <Button
                  size="xs"
                  color="red"
                  loading={remove.isPending}
                  onClick={() => remove.mutate(filter.id, { onSuccess: () => setConfirming(false) })}
                >
                  Удалить
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    </Group>
  );
}
