import { Button, Card, Stack, Text, Title } from '@mantine/core';
import { IconLogin } from '@tabler/icons-react';
import { login } from '../api/client';

/**
 * Вместо личного раздела у гостя: что здесь будет и кнопка входа. После входа gateway вернёт на эту же страницу.
 * С title - страницей (портфель, уведомления), без него - компактно (окно колокольчика).
 */
export function LoginRequired({ title, text }: { title?: string; text: string }) {
  const body = (
    <Stack gap="sm" align="flex-start">
      <Text size="sm">{text}</Text>
      <Button leftSection={<IconLogin size={16} />} onClick={login}>
        Войти
      </Button>
    </Stack>
  );

  if (!title) {
    return body;
  }

  return (
    <Stack gap="lg">
      <Title order={2}>{title}</Title>
      <Card withBorder padding="lg" maw={560}>
        {body}
      </Card>
    </Stack>
  );
}
