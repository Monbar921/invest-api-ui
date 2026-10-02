import { screen, within } from '@testing-library/react';
import type { Coupon } from '../api/types';
import { renderWithMantine } from '../test/render';
import { CouponSchedule } from './CouponSchedule';

const payment = (paymentDate: string, quantity: number) => ({
  price: { quantity, currency: 'rub' },
  fixDate: paymentDate.replace('T00', 'T01'),
  paymentDate,
});

const coupon = (couponData: Coupon['couponData']): Coupon => ({ uid: 'uid', quantityPerYear: 12, interest: 18.5, couponData });

const normalize = (value: string | null) => value?.replace(/\s/g, ' ');

describe('CouponSchedule', () => {
  const now = new Date('2026-11-01T10:00:00');

  it('показывает ближайшую выплату и сумму оставшихся', () => {
    renderWithMantine(
      <CouponSchedule
        now={now}
        coupon={coupon([
          payment('2026-10-14T00:00:00', 15.21),
          payment('2026-11-14T00:00:00', 15.21),
          payment('2026-12-14T00:00:00', 15.71),
        ])}
      />,
    );

    expect(normalize(screen.getByText(/Ближайшая/).textContent)).toBe('Ближайшая: 15,21 ₽ 14.11.2026');
    expect(normalize(screen.getByText(/Осталось/).textContent)).toBe('Осталось 2 на 30,92 ₽');
    // в таблице все выплаты, включая прошедшие
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
  });

  it('все выплаты в прошлом', () => {
    renderWithMantine(<CouponSchedule now={now} coupon={coupon([payment('2026-10-14T00:00:00', 15.21)])} />);

    expect(screen.getByText('Все выплаты прошли')).toBeInTheDocument();
  });

  it('купон без графика и облигация без купона', () => {
    const { unmount } = renderWithMantine(<CouponSchedule coupon={coupon(null)} />);
    expect(screen.getByText('График выплат ещё не загружен')).toBeInTheDocument();
    unmount();

    renderWithMantine(<CouponSchedule coupon={null} />);
    expect(screen.getByText('Данных о купонах нет')).toBeInTheDocument();
  });
});
