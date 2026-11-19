// App.jsx: the cat-shop storefront.
//
// What it does: shows the cats for sale, lets a visitor filter by breed, open one cat,
// and order it with name, phone and email.
//
// Steps a visitor goes through:
//   Step 1. CatList    - grid of available cats with a breed filter.
//   Step 2. CatDetail  - one cat: photo, details, price, and the order form.
//   Step 3. Thank-you  - the order went through; the cat is now reserved.
//
// Which screen shows is kept in state (no router): selectedCat is null on the list.
import { useEffect, useState } from 'react';
import { listAvailableCats, placeOrder, formatPrice, formatAge } from './api.js';

export default function App() {
  const [selectedCat, setSelectedCat] = useState(null);
  const [placedOrder, setPlacedOrder] = useState(null);

  function backToList() {
    setSelectedCat(null);
    setPlacedOrder(null);
  }

  return (
    <div className="page">
      <header className="site-header">
        <h1 onClick={backToList}>Cat Shop</h1>
      </header>
      <main>
        {placedOrder ? (
          <ThankYou cat={selectedCat} order={placedOrder} onDone={backToList} />
        ) : selectedCat ? (
          <CatDetail cat={selectedCat} onBack={backToList} onOrdered={setPlacedOrder} />
        ) : (
          <CatList onSelect={setSelectedCat} />
        )}
      </main>
    </div>
  );
}

// ---------- Step 1: list of available cats ----------

function CatList({ onSelect }) {
  const [cats, setCats] = useState([]);
  const [breedFilter, setBreedFilter] = useState('');
  const [breedsSeen, setBreedsSeen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false; // ignore a slow answer once the filter has changed again
    setLoading(true);
    setErrorMessage('');
    listAvailableCats(breedFilter)
      .then((foundCats) => {
        if (cancelled) return;
        setCats(foundCats);
        // The API has no breeds endpoint, so collect breeds from the unfiltered list.
        if (!breedFilter) setBreedsSeen([...new Set(foundCats.map((cat) => cat.breed))].sort());
      })
      .catch((error) => !cancelled && setErrorMessage(error.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [breedFilter]);

  return (
    <section>
      <label className="filter">
        Breed{' '}
        <select value={breedFilter} onChange={(event) => setBreedFilter(event.target.value)}>
          <option value="">All breeds</option>
          {breedsSeen.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
        </select>
      </label>

      {loading && <p>Loading cats…</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
      {!loading && !errorMessage && cats.length === 0 && <p>No cats available right now.</p>}

      <ul className="cat-grid">
        {cats.map((cat) => (
          <li key={cat.id}>
            <button className="cat-card" onClick={() => onSelect(cat)}>
              <img src={cat.photo_url} alt={cat.name} />
              <strong>{cat.name}</strong>
              <span>{cat.breed} · {formatAge(cat.age_months)}</span>
              <span className="price">{formatPrice(cat.price_cents)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Step 2: one cat and the order form ----------

function CatDetail({ cat, onBack, onOrdered }) {
  const [customer, setCustomer] = useState({ customer_name: '', phone: '', email: '' });
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function updateField(event) {
    setCustomer({ ...customer, [event.target.name]: event.target.value });
  }

  async function submitOrder(event) {
    event.preventDefault();
    setSending(true);
    setErrorMessage('');
    try {
      onOrdered(await placeOrder({ cat_id: cat.id, ...customer }));
    } catch (error) {
      // e.g. someone else reserved this cat a moment ago
      setErrorMessage(error.message);
      setSending(false);
    }
  }

  return (
    <section className="cat-detail">
      <button className="link" onClick={onBack}>← All cats</button>
      <img src={cat.photo_url} alt={cat.name} />
      <div>
        <h2>{cat.name}</h2>
        <p>{cat.breed} · {formatAge(cat.age_months)}</p>
        <p className="price">{formatPrice(cat.price_cents)}</p>
        <p>{cat.description}</p>

        <form onSubmit={submitOrder} className="order-form">
          <h3>Order {cat.name}</h3>
          <label>Name <input name="customer_name" required value={customer.customer_name} onChange={updateField} /></label>
          <label>Phone <input name="phone" type="tel" required value={customer.phone} onChange={updateField} /></label>
          <label>Email <input name="email" type="email" required value={customer.email} onChange={updateField} /></label>
          {errorMessage && <p className="error">{errorMessage}</p>}
          <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Place order'}</button>
        </form>
      </div>
    </section>
  );
}

// ---------- Step 3: order confirmation ----------

function ThankYou({ cat, order, onDone }) {
  return (
    <section>
      <h2>Thank you, {order.customer_name}!</h2>
      <p>{cat.name} is reserved for you. Order #{order.id}. We will contact you at {order.email}.</p>
      <button onClick={onDone}>Back to all cats</button>
    </section>
  );
}
