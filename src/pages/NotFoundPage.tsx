import { Button, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';

export function NotFoundPage({ message = 'Такой страницы нет' }: { message?: string }) {
  return (
    <Stack align="center" py="xl" gap="sm">
      <Title order={2}>404</Title>
      <Text c="dimmed">{message}</Text>
      <Button component={Link} to="/bonds" variant="light">
        К списку облигаций
      </Button>
    </Stack>
  );
}
