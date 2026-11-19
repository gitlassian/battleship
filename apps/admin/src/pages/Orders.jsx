import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ORDER_STATUSES, formatDate } from '../format.js';
import useLoad from '../components/useLoad.js';
import ErrorBox from '../components/ErrorBox.jsx';
import FilterButton from '../components/FilterButton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

// Which buttons an order shows in each status. The API applies the effect on the cat:
// confirmed -> cat stays reserved, cancelled -> cat available again, completed -> cat sold.
const ACTIONS = {
  new: [
    { to: 'confirmed', label: 'Подтвердить', cls: 'primary' },
    { to: 'cancelled', label: 'Отменить', cls: 'danger', confirm: 'Отменить заказ? Кот снова станет свободным.' },
  ],
  confirmed: [
    { to: 'completed', label: 'Завершить (продан)', cls: 'primary', confirm: 'Завершить заказ? Кот будет отмечен как проданный.' },
    { to: 'cancelled', label: 'Отменить', cls: 'danger', confirm: 'Отменить заказ? Кот снова станет свободным.' },
  ],
  cancelled: [],
  completed: [],
};

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const { data: orders, error, loading, reload } = useLoad(() => api.listOrders({ status }), [status]);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const setStatusFilter = (value) => setParams(value ? { status: value } : {});

  const change = async (order, action) => {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusyId(order.id);
    setActionError('');
    try {
      await api.setOrderStatus(order.id, action.to);
      reload();
    } catch (err) {
      setActionError(`Заказ №${order.id}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <h1>Заказы</h1>

      <div className="filters">
        <FilterButton active={!status} onClick={() => setStatusFilter('')}>Все</FilterButton>
        {Object.entries(ORDER_STATUSES).map(([value, label]) => (
          <FilterButton key={value} active={status === value} onClick={() => setStatusFilter(value)}>{label}</FilterButton>
        ))}
      </div>

      {actionError && <div className="error">{actionError}</div>}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !orders && <p className="muted">Загрузка…</p>}
      {orders && orders.length === 0 && <p className="muted empty">Заказов нет.</p>}

      {orders && orders.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Дата</th>
                <th>Кот</th>
                <th>Покупатель</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order.id}>
                  <tr className={openId === order.id ? 'open' : ''}>
                    <td>
                      <button className="link" onClick={() => setOpenId(openId === order.id ? null : order.id)}>
                        {order.id} {openId === order.id ? '▴' : '▾'}
                      </button>
                    </td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>
                      {order.cat_id != null
                        ? <Link to={`/cats/${order.cat_id}`}>{order.cat_name || `#${order.cat_id}`}</Link>
                        : <span className="muted">{order.cat_name || 'удалён'}</span>}
                    </td>
                    <td>{order.customer_name}</td>
                    <td><a href={`tel:${order.phone}`}>{order.phone}</a></td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="actions">
                      {(ACTIONS[order.status] || []).map((action) => (
                        <button
                          key={action.to}
                          className={`small ${action.cls}`}
                          disabled={busyId === order.id}
                          onClick={() => change(order, action)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </td>
                  </tr>
                  {openId === order.id && (
                    <tr className="details">
                      <td colSpan={7}>
                        <dl>
                          <dt>Email</dt>
                          <dd>{order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : '—'}</dd>
                          <dt>Комментарий</dt>
                          <dd>{order.comment || '—'}</dd>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
