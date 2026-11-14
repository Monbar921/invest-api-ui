import { Anchor, Button, Checkbox, Group, Menu, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconBell, IconBookmark, IconDeviceFloppy } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toFilterScope } from '../api/filters';
import { useSavedFilterMutations, useSavedFilters } from '../api/queries';
import { useSession } from '../api/session';
import type { BondParameters } from '../api/types';
import { sameSelection, type BondSearchState } from '../lib/bondSearchParams';
import { savedFilterState } from '../lib/savedFilters';
import { formatNumber } from '../lib/format';
import { ApiErrorText } from './ApiErrorText';

interface Props {
  state: BondSearchState;
  parameters: BondParameters;
  /** Открыть сохранённый фильтр: таблица переходит на его вид, фильтры и сортировку */
  onApply: (state: BondSearchState) => void;
}

/**
 * «Фильтры» у списка облигаций: сохранённые фильтры пользователя (открыть одним кликом) и «Сохранить текущий» -
 * с уведомлением о новых облигациях в выборке. Гостю не показывается: фильтры хранятся за пользователем.
 */
export function SavedFilters({ state, parameters, onApply }: Props) {
  const { authenticated } = useSession();
  const filters = useSavedFilters();
  const [saving, setSaving] = useState(false);

  if (!authenticated) {
    return null;
  }
  const active = filters.data?.find((filter) => sameSelection(savedFilterState(filter), state));

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button variant="default" size="xs" leftSection={<IconBookmark size={14} />}>
            {active ? active.name : 'Мои фильтры'}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {filters.data && filters.data.length > 0 && <Menu.Label>Сохранённые</Menu.Label>}
          {filters.data?.map((filter) => (
            <Menu.Item
              key={filter.id}
              onClick={() => onApply(savedFilterState(filter))}
              rightSection={
                <Group gap={4} wrap="nowrap">
                  {filter.matches != null && (
                    <Text size="xs" c="dimmed">
                      {formatNumber(filter.matches)}
                    </Text>
                  )}
                  {filter.notify && <IconBell size={14} aria-label="уведомления включены" />}
                </Group>
              }
            >
              {filter.name}
            </Menu.Item>
          ))}
          <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={() => setSaving(true)} disabled={!!active}>
            Сохранить текущий фильтр
          </Menu.Item>
          <Menu.Item component={Link} to="/alerts">
            Управление и уведомления
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={saving} onClose={() => setSaving(false)} title="Сохранить фильтр">
        {saving && <SaveFilterForm state={state} parameters={parameters} onDone={() => setSaving(false)} />}
      </Modal>
    </>
  );
}

function SaveFilterForm({
  state,
  parameters,
  onDone,
}: {
  state: BondSearchState;
  parameters: BondParameters;
  onDone: () => void;
}) {
  const { create } = useSavedFilterMutations();
  const [name, setName] = useState('');
  const [notify, setNotify] = useState(true);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ name: name.trim(), scope: toFilterScope(state.scope), parameters, notify }, { onSuccess: onDone });
      }}
    >
      <Stack gap="sm">
        <TextInput
          label="Название"
          placeholder="Например: надёжные от 18%"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          maxLength={100}
          required
          data-autofocus
        />
        <Checkbox
          checked={notify}
          onChange={(event) => setNotify(event.currentTarget.checked)}
          label="Сообщать о новых облигациях в выборке"
          description="После обновления цен - в Telegram, если он подключён на странице «Уведомления»"
        />
        {create.error && <ApiErrorText error={create.error} />}
        <Group justify="space-between">
          <Anchor component={Link} to="/alerts" size="sm">
            Все фильтры
          </Anchor>
          <Button type="submit" loading={create.isPending} disabled={name.trim() === ''}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
