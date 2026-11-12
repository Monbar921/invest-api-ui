import { Button, Center, Container, Loader, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useRouteError } from 'react-router';
import { isChunkLoadError, reloadForNewVersion } from '../lib/chunkReload';

/**
 * Ошибка маршрута. Не загрузился чанк страницы (вкладку открыли до выкладки новой версии) - один раз перезагружаем:
 * адрес уже новый, так что откроется та страница, куда шли. Остальное - сообщение и «Обновить страницу».
 */
export function RouteError() {
  const error = useRouteError();
  const [reloading] = useState(() => isChunkLoadError(error) && reloadForNewVersion());

  useEffect(() => {
    if (!reloading) {
      console.error(error);
    }
  }, [error, reloading]);

  if (reloading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="md" align="flex-start">
        <Title order={2}>Не удалось открыть страницу</Title>
        <Text>
          {isChunkLoadError(error)
            ? 'Вышла новая версия сайта. Обновите страницу.'
            : 'Произошла ошибка. Попробуйте обновить страницу.'}
        </Text>
        <Button onClick={() => window.location.reload()}>Обновить страницу</Button>
      </Stack>
    </Container>
  );
}
