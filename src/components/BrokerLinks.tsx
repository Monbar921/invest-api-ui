import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { useBrokerClick, useBrokerLinks } from '../api/queries';
import type { BrokerLink } from '../api/types';

/**
 * Блок «Купить у брокера»: реферальные ссылки партнёров. Это реклама - с пометкой, рекламодателем и erid у каждой
 * ссылки. Партнёров нет или запрос не удался - блока нет: карточка и калькулятор работают без него.
 */
export function BrokerLinks({ ticker }: { ticker: string }) {
  const query = useBrokerLinks(ticker);
  const click = useBrokerClick(ticker);

  if (!query.data || query.data.length === 0) {
    return null;
  }

  return (
    <Card withBorder padding="md" component="section" aria-label="Купить у брокера">
      <Stack gap="sm">
        <Group gap="xs" justify="space-between">
          <Text fw={600}>Купить у брокера</Text>
          <Badge variant="light" color="gray" size="sm">
            Реклама
          </Badge>
        </Group>
        <Group gap="sm" align="flex-start">
          {query.data.map((link) => (
            <PartnerLink key={link.partnerId} link={link} onClick={() => click.mutate(link.partnerId)} />
          ))}
        </Group>
        <Text size="xs" c="dimmed">
          Ссылки партнёров: переход к брокеру. Это не инвестиционная рекомендация.
        </Text>
      </Stack>
    </Card>
  );
}

function PartnerLink({ link, onClick }: { link: BrokerLink; onClick: () => void }) {
  return (
    <Stack gap={2}>
      <Button
        component="a"
        href={link.url}
        target="_blank"
        // sponsored - поисковикам: ссылка рекламная
        rel="sponsored noopener noreferrer"
        variant="light"
        rightSection={<IconExternalLink size={14} aria-hidden />}
        onClick={onClick}
        w="fit-content"
      >
        {link.name}
      </Button>
      <Text size="xs" c="dimmed">
        Реклама. {link.advertiser}
        {link.erid ? `. erid: ${link.erid}` : ''}
      </Text>
    </Stack>
  );
}
