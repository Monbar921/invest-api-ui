import {
  ActionIcon,
  Anchor,
  AppShell,
  Container,
  Group,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconChartLine, IconMoon, IconSun } from '@tabler/icons-react';
import { Link, Outlet } from 'react-router';

export function AppLayout() {
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between">
            <Anchor component={Link} to="/bonds" underline="never" c="inherit">
              <Group gap="xs">
                <IconChartLine size={24} color="var(--mantine-primary-color-filled)" />
                <Text fw={600} size="lg">
                  Облигации
                </Text>
              </Group>
            </Anchor>
            <ColorSchemeToggle />
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" px={0}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const label = computed === 'dark' ? 'Светлая тема' : 'Тёмная тема';

  return (
    <Tooltip label={label}>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label={label}
        onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
      >
        {computed === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
