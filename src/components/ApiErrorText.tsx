import { Anchor, Text } from '@mantine/core';
import { Link } from 'react-router';
import { isPlanRestriction } from '../api/client';

/**
 * Ошибка действия (создание правила, покупки, ссылки) под формой. Если действие не входит в тариф (402) - рядом
 * ссылка на страницу тарифов: сообщение бэка уже говорит, в каком тарифе больше.
 */
export function ApiErrorText({ error, size = 'sm' }: { error: Error; size?: 'xs' | 'sm' }) {
  return (
    <Text size={size} c="red">
      {error.message}
      {isPlanRestriction(error) && (
        <>
          {' '}
          <Anchor component={Link} to="/plan" size={size}>
            Тарифы
          </Anchor>
        </>
      )}
    </Text>
  );
}
