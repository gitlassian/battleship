import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CAT_STATUSES, SEX, formatAge, formatPrice } from '../format.js';
import useLoad from '../components/useLoad.js';
import ErrorBox from '../components/ErrorBox.jsx';
import FilterButton from '../components/FilterButton.jsx';
import Thumb from '../components/Thumb.jsx';

export default function Cats() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const { data: cats, error, loading, reload } = useLoad(() => api.listCats({ status }), [status]);
  const [actionError, setActionError] = useState('');

  const setStatusFilter = (value) => setParams(value ? { status: value } : {});

  const run = async (action) => {
    setActionError('');
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const remove = (cat) => {
    if (!window.confirm(`Удалить «${cat.name}»? Это нельзя отменить.`)) return;
    run(() => api.deleteCat(cat.id));
  };

  return (
    <>
      <div className="page-head">
        <h1>Коты</h1>
        <Link className="button primary" to="/cats/new">+ Добавить кота</Link>
      </div>

      <div className="filters">
        <FilterButton active={!status} onClick={() => setStatusFilter('')}>Все</FilterButton>
        {Object.entries(CAT_STATUSES).map(([value, label]) => (
          <FilterButton key={value} active={status === value} onClick={() => setStatusFilter(value)}>{label}</FilterButton>
        ))}
      </div>

      {actionError && <div className="error">{actionError}</div>}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !cats && <p className="muted">Загрузка…</p>}
      {cats && cats.length === 0 && <p className="muted empty">Котов с таким статусом нет.</p>}

      {cats && cats.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Имя</th>
                <th>Порода</th>
                <th>Пол</th>
                <th>Возраст</th>
                <th className="num">Цена</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => (
                <tr key={cat.id}>
                  <td><Thumb url={cat.photo_url} /></td>
                  <td><Link to={`/cats/${cat.id}`}>{cat.name}</Link></td>
                  <td>{cat.breed}</td>
                  <td>{SEX[cat.sex] || '—'}</td>
                  <td>{formatAge(cat.age_months)}</td>
                  <td className="num">{formatPrice(cat.price_cents)}</td>
                  <td>
                    <select
                      className={`status-select badge-${cat.status}`}
                      value={cat.status}
                      onChange={(e) => run(() => api.updateCat(cat.id, { status: e.target.value }))}
                    >
                      {Object.entries(CAT_STATUSES).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="actions">
                    <Link to={`/cats/${cat.id}`}>Изменить</Link>
                    <button className="link danger" onClick={() => remove(cat)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

