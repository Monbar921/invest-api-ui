import { Badge, Button, Card, Group, Loader, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconCheck, IconMinus } from '@tabler/icons-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAccountPlan } from '../api/queries';
import { useSession } from '../api/session';
import type { AccountPlan, Plan, PlanFeature, PlanLimit, PlanLimitUsage } from '../api/types';
import { ErrorState } from '../components/ErrorState';
import { LoginRequired } from '../components/LoginRequired';
import { AutoRenewalInfo, PaymentResult, PaymentsHistory, PurchaseModal } from '../components/PlanPayments';
import { formatDate } from '../lib/format';
import { PLAN_FEATURE_LABELS, PLAN_LIMIT_LABELS, planPrice } from '../lib/plans';
import { usePageMeta } from '../lib/seo';

/** «Тариф»: что входит в действующий, сколько использовано, сравнение и покупка тарифов, платежи */
export function PlanPage() {
  const { authenticated } = useSession();
  usePageMeta({ title: 'Тариф', noindex: true });
  if (!authenticated) {
    return <LoginRequired title="Тариф" text="Войдите, чтобы увидеть свой тариф и сколько из его лимитов уже использовано." />;
  }
  return <PlanContent />;
}

function PlanContent() {
  const plan = useAccountPlan();
  const [buying, setBuying] = useState<Plan | null>(null);
  // Т-Касса возвращает сюда после оплаты: /plan?payment=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentId = Number(searchParams.get('payment')) || null;
  const closeResult = () =>
    setSearchParams(
      (params) => {
        params.delete('payment');
        return params;
      },
      { replace: true },
    );

  return (
    <Stack gap="lg">
      <Title order={2}>Тариф</Title>
      {paymentId != null && <PaymentResult id={paymentId} onClose={closeResult} />}
      {plan.isPending && <Loader size="sm" />}
      {plan.isError && <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />}
      {plan.data && (
        <>
          <CurrentPlan account={plan.data} />
          <PlansComparison account={plan.data} onBuy={setBuying} />
          <PurchaseModal plan={buying} account={plan.data} onClose={() => setBuying(null)} />
        </>
      )}
      <PaymentsHistory />
    </Stack>
  );
}

function CurrentPlan({ account }: { account: AccountPlan }) {
  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Group gap="sm">
          <Title order={4}>{account.plan.title}</Title>
          <Badge variant="light" color={account.plan.paid ? 'teal' : 'gray'}>
            {account.plan.paid ? 'платный' : 'бесплатный'}
          </Badge>
        </Group>
        {account.plan.description && <Text size="sm">{account.plan.description}</Text>}
        <Text size="sm" c="dimmed">
          {validity(account)}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {account.limits.map((usage) => (
            <LimitUsage key={usage.limit} usage={usage} />
          ))}
        </SimpleGrid>
        <AutoRenewalInfo account={account} />
      </Stack>
    </Card>
  );
}

function validity(account: AccountPlan): string {
  if (account.defaultPlan) {
    return 'Тариф по умолчанию - действует всегда.';
  }
  return account.validUntil ? `Действует по ${formatDate(account.validUntil)} включительно.` : 'Действует бессрочно.';
}

function LimitUsage({ usage }: { usage: PlanLimitUsage }) {
  const over = usage.used >= usage.max;
  const percent = usage.max > 0 ? Math.min(100, (usage.used / usage.max) * 100) : 100;
  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="xs">
        <Text size="sm">{PLAN_LIMIT_LABELS[usage.limit]}</Text>
        <Text size="sm" fw={500} c={over ? 'red' : undefined}>
          {usage.used} из {usage.max}
        </Text>
      </Group>
      <Progress value={percent} color={over ? 'red' : undefined} aria-label={PLAN_LIMIT_LABELS[usage.limit]} />
      {usage.used > usage.max && (
        <Text size="xs" c="dimmed">
          Созданное раньше сохранено, новые добавить нельзя.
        </Text>
      )}
      {usage.used === usage.max && (
        <Text size="xs" c="dimmed">
          Лимит исчерпан.
        </Text>
      )}
    </Stack>
  );
}

function PlansComparison({ account, onBuy }: { account: AccountPlan; onBuy: (plan: Plan) => void }) {
  const limits = Object.keys(PLAN_LIMIT_LABELS) as PlanLimit[];
  const features = Object.keys(PLAN_FEATURE_LABELS) as PlanFeature[];
  const paidOffered = account.plans.some((plan) => plan.paid);
  const paymentsEnabled = account.payments.enabled;
  const sold = paymentsEnabled && account.plans.some((plan) => plan.purchasable);

  return (
    <Stack gap="sm">
      <Title order={4}>Тарифы</Title>
      <Table.ScrollContainer minWidth={480}>
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              {account.plans.map((plan) => (
                <PlanHeader key={plan.id} plan={plan} current={plan.id === account.plan.id} />
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Цена</Table.Td>
              {account.plans.map((plan) => (
                <Table.Td key={plan.id}>{plan.paid ? (planPrice(plan) ?? 'по запросу') : 'бесплатно'}</Table.Td>
              ))}
            </Table.Tr>
            {limits.map((limit) => (
              <Table.Tr key={limit}>
                <Table.Td>{PLAN_LIMIT_LABELS[limit]}</Table.Td>
                {account.plans.map((plan) => (
                  <Table.Td key={plan.id}>{plan.limits[limit] ?? '-'}</Table.Td>
                ))}
              </Table.Tr>
            ))}
            {features.map((feature) => (
              <Table.Tr key={feature}>
                <Table.Td>{PLAN_FEATURE_LABELS[feature]}</Table.Td>
                {account.plans.map((plan) => (
                  <Table.Td key={plan.id}>
                    {plan.features.includes(feature) ? (
                      <IconCheck size={18} color="var(--mantine-color-teal-6)" aria-label="входит" />
                    ) : (
                      <IconMinus size={18} color="var(--mantine-color-dimmed)" aria-label="не входит" />
                    )}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
            {sold && (
              <Table.Tr>
                <Table.Td />
                {account.plans.map((plan) => (
                  <Table.Td key={plan.id}>
                    {plan.purchasable && (
                      <Button size="xs" onClick={() => onBuy(plan)}>
                        {!account.defaultPlan && plan.id === account.plan.id ? 'Продлить' : 'Купить'}
                      </Button>
                    )}
                  </Table.Td>
                ))}
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {paidOffered && !paymentsEnabled && (
        <Text size="sm" c="dimmed">
          Оплата пока недоступна. Платный тариф подключается по запросу.
        </Text>
      )}
    </Stack>
  );
}

function PlanHeader({ plan, current }: { plan: Plan; current: boolean }) {
  return (
    <Table.Th>
      <Group gap={6} wrap="nowrap">
        <span>{plan.title}</span>
        {current && (
          <Badge size="xs" variant="light">
            ваш
          </Badge>
        )}
      </Group>
    </Table.Th>
  );
}
