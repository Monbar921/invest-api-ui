import { Button, Menu, Text, Tooltip } from '@mantine/core';
import { IconDownload, IconLogin } from '@tabler/icons-react';
import { useState } from 'react';
import { exportBonds } from '../api/bonds';
import { ApiError, login } from '../api/client';
import { useSession } from '../api/session';
import type { BondExportFormat, BondParameters, BondScope } from '../api/types';
import { trackGoal } from '../lib/analytics';

interface Props {
  scope: BondScope;
  parameters: BondParameters;
}

/**
 * Выгрузка текущей выборки (все страницы, те же фильтры и сортировка) в CSV или Excel. Только после входа: gateway
 * не отдаёт выгрузку гостю, чтобы все данные нельзя было выкачать одним запросом.
 */
export function BondExportButton({ scope, parameters }: Props) {
  const { authenticated } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authenticated) {
    return (
      <Tooltip label="Выгрузка выборки в CSV и Excel - после входа">
        <Button variant="default" size="xs" leftSection={<IconLogin size={14} />} onClick={login}>
          Войти, чтобы выгрузить
        </Button>
      </Tooltip>
    );
  }

  const save = async (format: BondExportFormat) => {
    setLoading(true);
    setError(null);
    try {
      const { blob, fileName } = await exportBonds(scope, format, parameters);
      trackGoal('bond_export', { format });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Не удалось выгрузить');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button variant="default" size="xs" leftSection={<IconDownload size={14} />} loading={loading}>
            Выгрузить
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Вся выборка с фильтрами</Menu.Label>
          <Menu.Item onClick={() => save('XLSX')}>Excel (.xlsx)</Menu.Item>
          <Menu.Item onClick={() => save('CSV')}>CSV (.csv)</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {error && (
        <Text size="xs" c="red" role="alert">
          {error}
        </Text>
      )}
    </>
  );
}
