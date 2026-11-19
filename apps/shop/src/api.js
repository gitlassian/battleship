// api.js: the storefront's only connection to apps/api (contract v0 in plan.md on the board).
//
// Words:
//   cat    - { id, name, breed, age_months, sex, price_cents, photo_url, description, status, created_at }
//   order  - { id, cat_id, cat_name, customer_name, phone, email, comment, status, created_at }
//   status - a cat is "available", "reserved" or "sold"; the shop lists only "available" ones.
//   sort   - "newest", "price_asc" or "price_desc".
//
// On failure the API answers { error: "message" }; we throw that message so the page can show it.

// Empty means same origin: in dev, Vite forwards /api and /uploads to the API (see vite.config.js).
// Set VITE_API_URL only when the built shop is served apart from the API.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Send one request and return its JSON body, or throw the API's error message.
async function request(path, options) {
  const response = await fetch(API_BASE_URL + path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

// Cats still for sale, optionally one breed (e.g. "Maine Coon"), in the given sort order.
export function listAvailableCats({ breed, sort }) {
  const query = new URLSearchParams({ status: 'available' });
  if (breed) query.set('breed', breed);
  if (sort) query.set('sort', sort);
  return request(`/api/cats?${query}`);
}

export function getCat(catId) {
  return request(`/api/cats/${encodeURIComponent(catId)}`);
}

// All breed names, for the filter dropdown.
export function listBreeds() {
  return request('/api/breeds');
}

// Reserve a cat; the API marks it "reserved" and answers 409 if someone got there first.
export function placeOrder({ cat_id, customer_name, phone, email, comment }) {
  return request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cat_id, customer_name, phone, email, comment }),
  });
}

// Uploaded photos come back as "/uploads/x.jpg", served by the API, so prefix the API address if any.
export function photoUrl(photo_url) {
  if (!photo_url) return '';
  return photo_url.startsWith('/') ? API_BASE_URL + photo_url : photo_url;
}

// Show 500000 price_cents as "5 000 ₽" (seed prices are whole rubles, so no kopecks).
const priceFormat = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
export function formatPrice(price_cents) {
  return priceFormat.format(price_cents / 100);
}

// "male" -> "кот", "female" -> "кошка".
export function formatSex(sex) {
  return { male: 'кот', female: 'кошка' }[sex] || sex;
}

// Show 14 age_months as "1 г. 2 мес.".
export function formatAge(age_months) {
  const years = Math.floor(age_months / 12);
  const months = age_months % 12;
  if (years === 0) return `${months} мес.`;
  return months === 0 ? `${years} г.` : `${years} г. ${months} мес.`;
}
