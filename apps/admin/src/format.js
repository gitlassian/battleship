// Display helpers shared by the admin pages.

export const CAT_STATUSES = {
  available: 'Свободен',
  reserved: 'Забронирован',
  sold: 'Продан',
};

export const ORDER_STATUSES = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  cancelled: 'Отменён',
  completed: 'Завершён',
};

export const SEX = { male: 'Кот', female: 'Кошка' };

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
export const formatPrice = (cents) => money.format((cents || 0) / 100);

export function formatAge(months) {
  const m = Number(months) || 0;
  if (m < 12) return `${m} мес.`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return rest ? `${years} г. ${rest} мес.` : `${years} г.`;
}

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '';
