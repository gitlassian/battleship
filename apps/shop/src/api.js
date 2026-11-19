// api.js: the storefront's only connection to apps/api.
//
// Words:
//   cat    - { id, name, breed, age_months, price_cents, photo_url, description, status }
//   order  - { id, cat_id, customer_name, phone, email, status, created_at }
//   status - a cat is "available", "reserved" or "sold"; only "available" cats are shown.
//
// Every call goes to /api/... ; in development Vite forwards it to port 3001.
// On failure the API answers { error: "message" }; we throw that message so the page can show it.

// Send one request and return its JSON body, or throw the API's error message.
async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

// List cats that can still be bought, optionally only one breed (e.g. "Maine Coon").
export function listAvailableCats(breed) {
  const query = new URLSearchParams({ status: 'available' });
  if (breed) query.set('breed', breed);
  return request(`/api/cats?${query}`);
}

// Place an order; the API marks the cat "reserved" and returns the new order.
export function placeOrder({ cat_id, customer_name, phone, email }) {
  return request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cat_id, customer_name, phone, email }),
  });
}

// Show 12500 price_cents as "$125.00".
export function formatPrice(price_cents) {
  return `$${(price_cents / 100).toFixed(2)}`;
}

// Show 14 age_months as "1 yr 2 mo".
export function formatAge(age_months) {
  const years = Math.floor(age_months / 12);
  const months = age_months % 12;
  if (years === 0) return `${months} mo`;
  return months === 0 ? `${years} yr` : `${years} yr ${months} mo`;
}
