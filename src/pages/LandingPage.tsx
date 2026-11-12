import { Anchor, Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBell, IconBriefcase, IconCalculator, IconChartLine, IconFilter, IconLogin, IconNews } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { login } from '../api/client';
import { useCollection, useCollections } from '../api/queries';
import type { BondCollectionPage } from '../api/types';
import { trackGoal } from '../lib/analytics';
import { formatPercent } from '../lib/format';
import { usePageMeta } from '../lib/seo';

interface Feature {
  icon: ReactNode;
  title: string;
  text: string;
  /** Раздел открыт гостю - ссылка на него; личный раздел - пометка «после входа» */
  to?: string;
  /** Ссылка лучше на конкретную облигацию - первую из живого примера; пока её нет - на `to` */
  linkToSampleBond?: boolean;
}

const FEATURES: Feature[] = [
  {
    icon: <IconFilter size={20} />,
    title: 'Список и фильтры',
    text: 'Все облигации Мосбиржи: ОФЗ, корпоративные и валютные. Фильтры по цене, риску и типу купона, сортировка по доходности к погашению и к оферте.',
    to: '/bonds',
  },
  {
    icon: <IconChartLine size={20} />,
    title: 'Карточка облигации',
    text: 'График цены, купоны и график выплат, оферта и амортизация, эмитент и новости по выпуску.',
    to: '/bonds',
    linkToSampleBond: true,
  },
  {
    icon: <IconCalculator size={20} />,
    title: 'Калькулятор дохода',
    text: 'Доход за период в деньгах и % годовых, с НДФЛ 13 или 15% и сравнением со вкладом на ту же сумму.',
    to: '/calculator',
  },
  {
    icon: <IconNews size={20} />,
    title: 'Новости и ставка',
    text: 'Ключевая ставка и курсы ЦБ, новости Банка России, Мосбиржи и рейтинговых агентств с привязкой к выпускам.',
    to: '/bonds',
  },
  {
    icon: <IconBriefcase size={20} />,
    title: 'Портфель',
    text: 'Покупки по брокерам, текущая стоимость и доход по каждой облигации и по всему портфелю.',
  },
  {
    icon: <IconBell size={20} />,
    title: 'Уведомления в Telegram',
    text: 'Купоны, оферты и погашения заранее, пороги цены и доходности, новости и рейтинги эмитента.',
  },
];

/** Сколько облигаций показать из подборки - живой пример данных вместо скриншота */
const SAMPLE_SIZE = 5;

/** Посадочная страница для гостя на «/»: что умеет продукт и вход. Вошедший сюда не попадает - его ведёт на /bonds */
export function LandingPage() {
  usePageMeta({
    title: 'Облигации',
    description:
      'Облигации Мосбиржи в одном месте: цены и доходность, купоны и график выплат, калькулятор дохода с НДФЛ, ' +
      'портфель и уведомления в Telegram.',
    canonicalPath: '/',
  });

  // живой пример - первая подборка; из неё же облигация для ссылки «Карточка облигации»
  const firstCollection = useCollections().data?.[0];
  const sample = useCollection(firstCollection?.slug ?? '', 0, SAMPLE_SIZE, { enabled: firstCollection != null }).data;
  const sampleBond = sample?.bonds.content[0];
  const bondLink = (feature: Feature) =>
    feature.linkToSampleBond && sampleBond ? `/bonds/${encodeURIComponent(sampleBond.ticker)}` : feature.to;

  const signIn = () => {
    trackGoal('landing_login');
    login();
  };

  return (
    <Stack gap={48} py="xl">
      <Stack gap="md" maw={760}>
        <Title order={1}>Облигации Мосбиржи: доходность, выплаты и новости в одном месте</Title>
        <Text size="lg" c="dimmed">
          Подберите облигации по доходности и риску, посчитайте доход с учётом налога, ведите портфель и получайте напоминания о
          купонах и офертах в Telegram.
        </Text>
        <Group gap="sm">
          <Button size="md" leftSection={<IconLogin size={18} />} onClick={signIn}>
            Войти / Зарегистрироваться
          </Button>
          <Button size="md" variant="default" component={Link} to="/bonds">
            Смотреть облигации
          </Button>
        </Group>
        <Text size="sm" c="dimmed">
          Список облигаций, карточки, новости и калькулятор работают без входа.
        </Text>
      </Stack>

      <Stack gap="md">
        <Title order={2}>Что умеет</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} to={bondLink(feature)} />
          ))}
        </SimpleGrid>
      </Stack>

      {sample && <CollectionSample collection={sample} />}

      <Text size="xs" c="dimmed">
        Сервис только информирует и не даёт инвестиционных рекомендаций. Данные - T-Invest API, Московская биржа, Банк России.
      </Text>
    </Stack>
  );
}

function FeatureCard({ feature, to }: { feature: Feature; to: string | undefined }) {
  return (
    <Card withBorder padding="lg">
      <Stack gap="sm" h="100%">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" size="lg">
            {feature.icon}
          </ThemeIcon>
          <Text fw={600}>{feature.title}</Text>
        </Group>
        <Text size="sm" c="dimmed" style={{ flexGrow: 1 }}>
          {feature.text}
        </Text>
        {to ? (
          <Anchor component={Link} to={to} size="sm">
            Открыть
          </Anchor>
        ) : (
          <Badge variant="light" color="gray">
            после входа
          </Badge>
        )}
      </Stack>
    </Card>
  );
}

/**
 * Первые облигации первой подборки - что гость увидит внутри, на настоящих данных. Подборок нет или запрос не удался -
 * блока нет: лендинг работает и без бэка.
 */
function CollectionSample({ collection: data }: { collection: BondCollectionPage }) {
  if (!data.bonds.content.length) {
    return null;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Title order={2}>{data.title}</Title>
          <Text size="sm" c="dimmed">
            {data.description}
          </Text>
        </Stack>
        <Anchor component={Link} to={`/collections/${encodeURIComponent(data.slug)}`} size="sm">
          Вся подборка
        </Anchor>
      </Group>
      <Table.ScrollContainer minWidth={420}>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Облигация</Table.Th>
              <Table.Th ta="right">Цена, % номинала</Table.Th>
              <Table.Th ta="right">К погашению, % год.</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.bonds.content.map((bond) => (
              <Table.Tr key={bond.ticker}>
                <Table.Td>
                  <Anchor component={Link} to={`/bonds/${encodeURIComponent(bond.ticker)}`}>
                    {bond.name ?? bond.ticker}
                  </Anchor>
                </Table.Td>
                <Table.Td ta="right">{formatPercent(bond.price?.percentagePrice)}</Table.Td>
                <Table.Td ta="right">{formatPercent(bond.coupon?.yieldToMaturity)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
