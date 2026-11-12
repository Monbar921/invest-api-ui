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
  useMatches,
} from '@mantine/core';
import {
  IconBell,
  IconBriefcase,
  IconCalculator,
  IconChartLine,
  IconCrown,
  IconLogin,
  IconLogout,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { type ReactNode, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router';
import { login, logout } from '../api/client';
import { useSession } from '../api/session';
import { AnalyticsConsent } from '../components/AnalyticsConsent';
import { TelegramConnect } from '../components/TelegramConnect';
import { trackPageView } from '../lib/analytics';

// у списка облигаций слева лента новостей - таблице нужна ширина больше стандартного контейнера
const WIDE_PAGE_WIDTH = 1920;

export function AppLayout() {
  const wide = useMatch('/bonds') != null;
  const session = useSession();
  const location = useLocation();
  // на телефоне (375px) бренд, три раздела и до четырёх кнопок справа не помещаются с обычными отступами
  const leftGap = useMatches({ base: 'xs', sm: 'lg' });
  const rightGap = useMatches({ base: 4, sm: 'xs' });

  useEffect(() => {
    // вошедшего «/» сразу уводит на /bonds - просмотр лендинга, которого он не видел, не считаем
    if (location.pathname === '/' && session.authenticated) {
      return;
    }
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search, session.authenticated]);

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Container size={wide ? WIDE_PAGE_WIDTH : 'xl'} h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap={leftGap} wrap="nowrap">
              <Anchor component={Link} to="/bonds" underline="never" c="inherit" aria-label="Облигации">
                <Group gap="xs">
                  <IconChartLine size={24} color="var(--mantine-primary-color-filled)" />
                  {/* на телефоне - только иконка: подпись не помещается рядом с разделами и кнопками */}
                  <Text fw={600} size="lg" visibleFrom="sm">
                    Облигации
                  </Text>
                </Group>
              </Anchor>
              <NavButton to="/portfolio" icon={<IconBriefcase size={18} />} label="Портфель" />
              <NavButton to="/calculator" icon={<IconCalculator size={18} />} label="Калькулятор" />
              <NavButton to="/alerts" icon={<IconBell size={18} />} label="Уведомления" />
            </Group>
            <Group gap={rightGap} wrap="nowrap">
              {session.authenticated && <TelegramConnect />}
              {session.authenticated && <PlanButton />}
              <ColorSchemeToggle />
              {/* гость видит облигации без входа; портфель и уведомления сами предложат войти */}
              {session.authenticated ? <LogoutButton username={session.username} /> : <LoginButton />}
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size={wide ? WIDE_PAGE_WIDTH : 'xl'} px={0}>
          <Outlet />
        </Container>
        <AnalyticsConsent />
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

/** Страница «Тариф»: лимиты и что входит */
function PlanButton() {
  return (
    <Tooltip label="Тариф">
      <NavLink to="/plan" aria-label="Тариф">
        {({ isActive }) => (
          <ActionIcon component="span" variant={isActive ? 'light' : 'default'} size="lg">
            <IconCrown size={18} />
          </ActionIcon>
        )}
      </NavLink>
    </Tooltip>
  );
}

function LogoutButton({ username }: { username: string | null }) {
  return (
    <Tooltip label={username ? `Выйти (${username})` : 'Выйти'}>
      <ActionIcon variant="default" size="lg" aria-label="Выйти" onClick={() => void logout()}>
        <IconLogout size={18} />
      </ActionIcon>
    </Tooltip>
  );
}

/** Вход с возвратом на текущую страницу */
function LoginButton() {
  return (
    <>
      <Button leftSection={<IconLogin size={18} />} onClick={login} visibleFrom="xs">
        Войти
      </Button>
      <ActionIcon size="lg" aria-label="Войти" onClick={login} hiddenFrom="xs">
        <IconLogin size={18} />
      </ActionIcon>
    </>
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
