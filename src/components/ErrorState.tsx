import { Alert, Button, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Alert color="red" variant="light" icon={<IconAlertTriangle />} title="Не удалось загрузить данные">
      {error.message}
      {onRetry && (
        <Group mt="sm">
          <Button size="xs" variant="light" color="red" onClick={onRetry}>
            Повторить
          </Button>
        </Group>
      )}
    </Alert>
  );
}
