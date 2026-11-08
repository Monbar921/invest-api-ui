import { ActionIcon, Modal, Stack, Tooltip } from '@mantine/core';
import { IconBell, IconBellFilled } from '@tabler/icons-react';
import { useState } from 'react';
import { useAlerts } from '../api/queries';
import { BondAlertsPanel, TelegramRequiredHint } from './BondAlertsPanel';

/**
 * Колокольчик облигации: залит, если есть включённые уведомления; по нажатию - их настройка.
 * Нажатие не всплывает: строка таблицы и сама открывает карточку.
 */
export function BondAlertsButton({ ticker, name }: { ticker: string; name: string | null }) {
  const [opened, setOpened] = useState(false);
  const alerts = useAlerts();
  const active = alerts.data?.some((alert) => alert.ticker === ticker && alert.enabled) ?? false;
  const label = active ? 'Уведомления включены' : 'Уведомления';

  return (
    <>
      <Tooltip label={label}>
        <ActionIcon
          variant={active ? 'light' : 'subtle'}
          color={active ? undefined : 'gray'}
          size="sm"
          aria-label={`${label}: ${ticker}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpened(true);
          }}
        >
          {active ? <IconBellFilled size={16} /> : <IconBell size={16} />}
        </ActionIcon>
      </Tooltip>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={`Уведомления: ${name ?? ticker}`}
        // клик внутри окна не должен открывать карточку из строки таблицы под ним
        onClick={(event) => event.stopPropagation()}
      >
        {opened && (
          <Stack gap="md">
            <TelegramRequiredHint />
            <BondAlertsPanel ticker={ticker} />
          </Stack>
        )}
      </Modal>
    </>
  );
}
