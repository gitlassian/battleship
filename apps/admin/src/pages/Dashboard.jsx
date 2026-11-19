import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatPrice } from '../format.js';
import useLoad from '../components/useLoad.js';
import ErrorBox from '../components/ErrorBox.jsx';

export default function Dashboard() {
  const { data: stats, error, loading, reload } = useLoad(() => api.stats(), []);

  if (loading && !stats) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const cards = [
    { label: 'Свободны', value: stats.cats_available, to: '/cats?status=available' },
    { label: 'Забронированы', value: stats.cats_reserved, to: '/cats?status=reserved' },
    { label: 'Проданы', value: stats.cats_sold, to: '/cats?status=sold' },
    { label: 'Новые заказы', value: stats.orders_new, to: '/orders?status=new', accent: stats.orders_new > 0 },
    { label: 'Выручка', value: formatPrice(stats.revenue_cents), to: '/orders?status=completed' },
  ];

  return (
    <>
      <h1>Обзор</h1>
      <div className="stats">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className={`card stat${c.accent ? ' accent' : ''}`}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </Link>
        ))}
      </div>
    </>
  );
}

