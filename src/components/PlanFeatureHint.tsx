import { Anchor, Group, Text } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { Link } from 'react-router';

/** Вместо кнопки закрытой фичи: «доступно в платном тарифе» со ссылкой на тарифы */
export function PlanFeatureHint({ planTitle }: { planTitle?: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <IconLock size={16} color="var(--mantine-color-dimmed)" />
      <Text size="sm" c="dimmed">
        Доступно в платном тарифе{planTitle ? ` «${planTitle}»` : ''}.{' '}
        <Anchor component={Link} to="/plan" size="sm">
          Тарифы
        </Anchor>
      </Text>
    </Group>
  );
}
