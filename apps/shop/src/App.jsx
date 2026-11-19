// App.jsx: the cat-shop storefront.
//
// What it does: shows the cats for sale, lets a visitor filter by breed and sort them,
// open one cat, and reserve it (no online payment: the shop calls the customer back).
//
// Pages a visitor goes through:
//   Step 1. /             CatalogPage - grid of available cats, breed filter, sort.
//   Step 2. /cats/:catId  CatPage     - one cat with the reservation form.
//   Step 3. /thanks       ThanksPage  - the reservation went through; the order arrives in router state.
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listAvailableCats, listBreeds, getCat, placeOrder, photoUrl, formatPrice, formatAge } from './api.js';

// Sort choices shown in the catalog; the values are what GET /api/cats?sort= accepts.
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function App() {
  return (
    <div className="page">
      <header className="site-header">
        <Link to="/"><h1>Cat Shop</h1></Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/cats/:catId" element={<CatPage />} />
          <Route path="/thanks" element={<ThanksPage />} />
          <Route path="*" element={<p>Page not found. <Link to="/">See all cats</Link></p>} />
        </Routes>
      </main>
    </div>
  );
}

// Run an API call when its inputs change; ignore a slow answer once the inputs moved on.
function useApi(loadData, inputs) {
  const [state, setState] = useState({ data: null, loading: true, errorMessage: '' });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, errorMessage: '' });
    loadData()
      .then((data) => !cancelled && setState({ data, loading: false, errorMessage: '' }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, errorMessage: error.message }));
    return () => { cancelled = true; };
  }, inputs); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

// ---------- Step 1: catalog ----------

function CatalogPage() {
  // Filter and sort live in the URL (?breed=Siamese&sort=price_asc) so they survive back/refresh.
  const [searchParams, setSearchParams] = useSearchParams();
  const breed = searchParams.get('breed') || '';
  const sort = searchParams.get('sort') || 'newest';

  const breeds = useApi(listBreeds, []);
  const cats = useApi(() => listAvailableCats({ breed, sort }), [breed, sort]);

  function changeParam(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    setSearchParams(next);
  }

  return (
    <section>
      <div className="toolbar">
        <label>
          Breed{' '}
          <select value={breed} onChange={(event) => changeParam('breed', event.target.value)}>
            <option value="">All breeds</option>
            {(breeds.data || []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          Sort{' '}
          <select value={sort} onChange={(event) => changeParam('sort', event.target.value)}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {cats.loading && <p>Loading cats…</p>}
      {cats.errorMessage && <p className="error">Could not load cats: {cats.errorMessage}</p>}
      {cats.data && cats.data.length === 0 && <p>No cats available right now.</p>}

      <ul className="cat-grid">
        {(cats.data || []).map((cat) => (
          <li key={cat.id}>
            <Link className="cat-card" to={`/cats/${cat.id}`}>
              <img src={photoUrl(cat.photo_url)} alt={cat.name} />
              <strong>{cat.name}</strong>
              <span>{cat.breed} · {cat.sex} · {formatAge(cat.age_months)}</span>
              <span className="price">{formatPrice(cat.price_cents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Step 2: one cat and the reservation form ----------

function CatPage() {
  const { catId } = useParams();
  const cat = useApi(() => getCat(catId), [catId]);

  if (cat.loading) return <p>Loading…</p>;
  if (cat.errorMessage) return <p className="error">{cat.errorMessage}. <Link to="/">See all cats</Link></p>;

  return (
    <section className="cat-detail">
      <Link className="back" to="/">← All cats</Link>
      <img src={photoUrl(cat.data.photo_url)} alt={cat.data.name} />
      <div>
        <h2>{cat.data.name}</h2>
        <p>{cat.data.breed} · {cat.data.sex} · {formatAge(cat.data.age_months)}</p>
        <p className="price">{formatPrice(cat.data.price_cents)}</p>
        <p>{cat.data.description}</p>
        {cat.data.status === 'available'
          ? <ReservationForm cat={cat.data} />
          : <p className="notice">{cat.data.name} is already {cat.data.status}.</p>}
      </div>
    </section>
  );
}

function ReservationForm({ cat }) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState({ customer_name: '', phone: '', email: '', comment: '' });
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function updateField(event) {
    setCustomer({ ...customer, [event.target.name]: event.target.value });
  }

  async function submitReservation(event) {
    event.preventDefault();
    setSending(true);
    setErrorMessage('');
    try {
      const order = await placeOrder({ cat_id: cat.id, ...customer });
      navigate('/thanks', { state: { order } });
    } catch (error) {
      // e.g. 409: someone else reserved this cat a moment ago
      setErrorMessage(error.message);
      setSending(false);
    }
  }

  return (
    <form onSubmit={submitReservation} className="order-form">
      <h3>Reserve {cat.name}</h3>
      <label>Name <input name="customer_name" required value={customer.customer_name} onChange={updateField} /></label>
      <label>Phone <input name="phone" type="tel" required value={customer.phone} onChange={updateField} /></label>
      <label>Email <input name="email" type="email" required value={customer.email} onChange={updateField} /></label>
      <label>Comment (optional) <textarea name="comment" rows="3" value={customer.comment} onChange={updateField} /></label>
      {errorMessage && <p className="error">{errorMessage}</p>}
      <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Reserve'}</button>
      <small>No payment now: we will call you to confirm.</small>
    </form>
  );
}

// ---------- Step 3: thank-you page ----------

function ThanksPage() {
  const order = useLocation().state?.order;
  if (!order) return <p>Nothing reserved yet. <Link to="/">See all cats</Link></p>;
  return (
    <section>
      <h2>Thank you, {order.customer_name}!</h2>
      <p>{order.cat_name} is reserved for you (order #{order.id}). We will call you at {order.phone} to confirm.</p>
      <Link to="/">Back to all cats</Link>
    </section>
  );
}
