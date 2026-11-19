import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CAT_STATUSES, SEX } from '../format.js';
import Thumb from '../components/Thumb.jsx';

const EMPTY = {
  name: '',
  breed: '',
  age_months: '',
  sex: 'male',
  price_rub: '',
  photo_url: '',
  description: '',
  status: 'available',
};

// The form edits prices in whole rubles; the API stores integer cents.
function toForm(cat) {
  return {
    name: cat.name ?? '',
    breed: cat.breed ?? '',
    age_months: cat.age_months ?? '',
    sex: cat.sex ?? 'male',
    price_rub: cat.price_cents != null ? String(cat.price_cents / 100) : '',
    photo_url: cat.photo_url ?? '',
    description: cat.description ?? '',
    status: cat.status ?? 'available',
  };
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    breed: form.breed.trim(),
    age_months: Number(form.age_months),
    sex: form.sex,
    price_cents: Math.round(Number(form.price_rub) * 100),
    photo_url: form.photo_url,
    description: form.description.trim(),
    status: form.status,
  };
}

export default function CatForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [breeds, setBreeds] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.breeds().then(setBreeds).catch(() => setBreeds([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .listCats()
      .then((cats) => {
        const cat = cats.find((c) => String(c.id) === id);
        if (!cat) throw new Error('Кот не найден');
        setForm(toForm(cat));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await api.uploadPhoto(file);
      setForm((f) => ({ ...f, photo_url: url }));
    } catch (err) {
      setError(`Фото не загрузилось: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = toPayload(form);
      if (isNew) await api.createCat(payload);
      else await api.updateCat(id, payload);
      navigate('/cats');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <>
      <div className="page-head">
        <h1>{isNew ? 'Новый кот' : `Редактирование: ${form.name}`}</h1>
        <Link to="/cats">← К списку</Link>
      </div>

      <form className="card cat-form" onSubmit={submit}>
        <div className="photo-field">
          <Thumb url={form.photo_url} large />
          <label className="button">
            {uploading ? 'Загружаем…' : form.photo_url ? 'Заменить фото' : 'Загрузить фото'}
            <input type="file" accept="image/*" onChange={upload} hidden disabled={uploading} />
          </label>
          {form.photo_url && (
            <button type="button" className="link danger" onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}>
              Убрать фото
            </button>
          )}
        </div>

        <div className="grid">
          <label>
            Имя
            <input value={form.name} onChange={set('name')} required maxLength={100} />
          </label>
          <label>
            Порода
            <input value={form.breed} onChange={set('breed')} required list="breeds" maxLength={100} />
            <datalist id="breeds">
              {breeds.map((b) => <option key={b} value={b} />)}
            </datalist>
          </label>
          <label>
            Возраст, месяцев
            <input type="number" min="0" max="360" step="1" value={form.age_months} onChange={set('age_months')} required />
          </label>
          <label>
            Пол
            <select value={form.sex} onChange={set('sex')}>
              {Object.entries(SEX).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Цена, ₽
            <input type="number" min="0" step="1" value={form.price_rub} onChange={set('price_rub')} required />
          </label>
          <label>
            Статус
            <select value={form.status} onChange={set('status')}>
              {Object.entries(CAT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <label>
          Описание
          <textarea rows={5} value={form.description} onChange={set('description')} maxLength={2000} />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="form-actions">
          <button className="primary" disabled={saving || uploading}>
            {saving ? 'Сохраняем…' : isNew ? 'Добавить' : 'Сохранить'}
          </button>
          <Link to="/cats">Отмена</Link>
        </div>
      </form>
    </>
  );
}
