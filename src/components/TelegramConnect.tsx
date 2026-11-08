import { ActionIcon, Alert, Anchor, Button, Group, Loader, Popover, Stack, Text, Tooltip } from '@mantine/core';
import { IconBrandTelegram, IconExternalLink } from '@tabler/icons-react';
import { useState } from 'react';
import { useCreateTelegramLink, useTelegramStatus, useUnlinkTelegram } from '../api/queries';
import type { TelegramLink, TelegramStatus } from '../api/types';
import { formatDateTime } from '../lib/format';

const LABEL = 'Уведомления в Telegram';

/**
 * Кнопка в шапке: подключение Telegram для уведомлений. Статус запрашивается только при открытии панели.
 */
export function TelegramConnect() {
  const [opened, setOpened] = useState(false);
  // ссылка привязки, пока пользователь не нажал /start в боте; панель в это время опрашивает статус
  const [link, setLink] = useState<TelegramLink | null>(null);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      onClose={() => setLink(null)}
      position="bottom-end"
      width={320}
      shadow="md"
      withArrow
      // кнопка в шапке всегда на экране; без этого панель прячется, когда у кнопки нулевой размер (jsdom)
      hideDetached={false}
    >
      <Popover.Target>
        <Tooltip label={LABEL} disabled={opened}>
          <ActionIcon variant="default" size="lg" aria-label={LABEL} onClick={() => setOpened((value) => !value)}>
            <IconBrandTelegram size={18} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>{opened && <TelegramPanel link={link} onLink={setLink} />}</Popover.Dropdown>
    </Popover>
  );
}

function TelegramPanel({ link, onLink }: { link: TelegramLink | null; onLink: (link: TelegramLink | null) => void }) {
  const status = useTelegramStatus(true, link != null);

  if (status.isPending) {
    return (
      <Group justify="center" py="sm">
        <Loader size="sm" />
      </Group>
    );
  }

  if (status.isError) {
    return (
      <Text size="sm" c="red">
        Не удалось загрузить статус: {status.error.message}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Text fw={600}>{LABEL}</Text>
      <StatusBody status={status.data} link={link} onLink={onLink} />
      {status.data.enabled && status.data.available === false && (
        <Alert color="yellow" p="xs">
          <Text size="xs">
            Сервер сейчас не может связаться с Telegram (проверка {formatDateTime(status.data.checkedAt)}). Проверьте VPN или
            прокси на сервере.
          </Text>
        </Alert>
      )}
    </Stack>
  );
}

function StatusBody({
  status,
  link,
  onLink,
}: {
  status: TelegramStatus;
  link: TelegramLink | null;
  onLink: (link: TelegramLink | null) => void;
}) {
  const createLink = useCreateTelegramLink();
  const unlink = useUnlinkTelegram();

  if (!status.enabled) {
    return (
      <Text size="sm" c="dimmed">
        Бот уведомлений выключен на сервере.
      </Text>
    );
  }

  if (status.linked) {
    return (
      <>
        <Text size="sm">
          Подключён{status.username ? ` @${status.username}` : ''}
          {status.linkedAt ? ` с ${formatDateTime(status.linkedAt)}` : ''}.
        </Text>
        <Button
          variant="default"
          size="xs"
          loading={unlink.isPending}
          onClick={() => unlink.mutate(undefined, { onSuccess: () => onLink(null) })}
        >
          Отключить
        </Button>
        {unlink.isError && (
          <Text size="xs" c="red">
            {unlink.error.message}
          </Text>
        )}
      </>
    );
  }

  if (link) {
    return (
      <>
        <Text size="sm">
          Откройте бота и нажмите «Старт» - подключение появится здесь само. Ссылка одноразовая, действует до{' '}
          {formatDateTime(link.expiresAt)}.
        </Text>
        <Button
          component="a"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          size="xs"
          leftSection={<IconExternalLink size={14} />}
        >
          Открыть Telegram
        </Button>
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="xs" c="dimmed">
            Ждём подтверждения от бота…
          </Text>
        </Group>
      </>
    );
  }

  return (
    <>
      <Text size="sm">
        Подключите Telegram, чтобы получать уведомления по облигациям
        {status.botUsername ? (
          <>
            {' '}
            от{' '}
            <Anchor href={`https://t.me/${status.botUsername}`} target="_blank" rel="noopener noreferrer">
              @{status.botUsername}
            </Anchor>
          </>
        ) : null}
        .
      </Text>
      <Button size="xs" loading={createLink.isPending} onClick={() => createLink.mutate(undefined, { onSuccess: onLink })}>
        Подключить Telegram
      </Button>
      {createLink.isError && (
        <Text size="xs" c="red">
          {createLink.error.message}
        </Text>
      )}
    </>
  );
}
