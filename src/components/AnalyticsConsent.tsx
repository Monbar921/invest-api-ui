import { Affix, Button, Group, Paper, Text } from '@mantine/core';
import { useState } from 'react';
import { type AnalyticsConsent as Consent, analyticsEnabled, readConsent, saveConsent } from '../lib/analytics';

/**
 * Баннер согласия на cookie Метрики. Показывается, только если счётчик задан в сборке и посетитель ещё не выбирал;
 * до согласия счётчик не загружается.
 */
export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent | null>(() => readConsent());

  if (!analyticsEnabled() || consent != null) {
    return null;
  }

  const choose = (value: Consent) => {
    saveConsent(value);
    setConsent(value);
  };

  return (
    <Affix position={{ bottom: 16, left: 16, right: 16 }} zIndex={300}>
      <Paper withBorder shadow="md" p="md" maw={720} mx="auto" role="region" aria-label="Согласие на cookie">
        <Group justify="space-between" gap="sm">
          <Text size="sm" style={{ flex: '1 1 320px' }}>
            Мы используем Яндекс Метрику, чтобы понимать, какими функциями пользуются. Она ставит cookie; имя, почту и введённые в
            формы данные мы в неё не передаём.
          </Text>
          <Group gap="xs" wrap="nowrap">
            <Button variant="default" size="xs" onClick={() => choose('declined')}>
              Отказаться
            </Button>
            <Button size="xs" onClick={() => choose('accepted')}>
              Принять
            </Button>
          </Group>
        </Group>
      </Paper>
    </Affix>
  );
}
