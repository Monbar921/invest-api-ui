import {
  ActionIcon,
  Anchor,
  AppShell,
  Button,
  Container,
  Group,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconBell, IconBriefcase, IconCalculator, IconChartLine, IconLogout, IconMoon, IconSun } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useMatch } from 'react-router';
import { logout } from '../api/client';
import { TelegramConnect } from '../components/TelegramConnect';

// у списка облигаций слева лента новостей - таблице нужна ширина больше стандартного контейнера
const WIDE_PAGE_WIDTH = 1920;

export function AppLayout() {
  const wide = useMatch('/bonds') != null;

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Container size={wide ? WIDE_PAGE_WIDTH : 'xl'} h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="lg" wrap="nowrap">
              <Anchor component={Link} to="/bonds" underline="never" c="inherit">
                <Group gap="xs">
                  <IconChartLine size={24} color="var(--mantine-primary-color-filled)" />
                  <Text fw={600} size="lg">
                    Облигации
                  </Text>
                </Group>
              </Anchor>
              <NavButton to="/portfolio" icon={<IconBriefcase size={18} />} label="Портфель" />
              <NavButton to="/calculator" icon={<IconCalculator size={18} />} label="Калькулятор" />
              <NavButton to="/alerts" icon={<IconBell size={18} />} label="Уведомления" />
            </Group>
            <Group gap="xs" wrap="nowrap">
              <TelegramConnect />
              <ColorSchemeToggle />
              <LogoutButton />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size={wide ? WIDE_PAGE_WIDTH : 'xl'} px={0}>
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

function LogoutButton() {
  return (
    <Tooltip label="Выйти">
      <ActionIcon variant="default" size="lg" aria-label="Выйти" onClick={() => void logout()}>
        <IconLogout size={18} />
      </ActionIcon>
    </Tooltip>
  );
}

/** Пункт меню: подсвечен, пока открыт его раздел */
function NavButton({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} aria-label={label}>
      {({ isActive }) => (
        <>
          <Button component="span" variant={isActive ? 'light' : 'subtle'} leftSection={icon} visibleFrom="xs">
            {label}
          </Button>
          {/* на телефоне подпись не помещается рядом с брендом и кнопками - только иконка */}
          <ActionIcon component="span" variant={isActive ? 'light' : 'subtle'} size="lg" hiddenFrom="xs">
            {icon}
          </ActionIcon>
        </>
      )}
    </NavLink>
  );
}
