// In-memory stand-in for apps/api, following contract v0 from plan.md.
// Used only when VITE_USE_MOCK=1. Data resets on page reload.

const PASSWORD = 'admin';
const TOKEN = 'mock-token';

const now = () => new Date().toISOString();
let nextCatId = 1;
let nextOrderId = 1;

const cats = [
  ['Барсик', 'Британская короткошёрстная', 8, 'male', 2500000],
  ['Мурка', 'Шотландская вислоухая', 5, 'female', 3000000],
  ['Снежок', 'Невская маскарадная', 12, 'male', 2200000],
  ['Луна', 'Мейн-кун', 4, 'female', 4500000],
  ['Рыжик', 'Абиссинская', 7, 'male', 3500000],
  ['Соня', 'Сфинкс', 10, 'female', 4000000],
].map(([name, breed, age_months, sex, price_cents]) => ({
  id: nextCatId++,
  name,
  breed,
  age_months,
  sex,
  price_cents,
  photo_url: '',
  description: `${name} — ласковый и игривый котёнок.`,
  status: 'available',
  created_at: now(),
}));

const orders = [];

function addOrder(cat, customer_name, phone, email, status) {
  cat.status = status === 'completed' ? 'sold' : status === 'cancelled' ? 'available' : 'reserved';
  orders.unshift({
    id: nextOrderId++,
    cat_id: cat.id,
    cat_name: cat.name,
    customer_name,
    phone,
    email,
    comment: '',
    status,
    created_at: now(),
  });
}
addOrder(cats[1], 'Анна Петрова', '+7 900 123-45-67', 'anna@example.com', 'new');
addOrder(cats[4], 'Иван Смирнов', '+7 900 765-43-21', 'ivan@example.com', 'confirmed');
addOrder(cats[5], 'Ольга Котова', '+7 900 555-00-11', 'olga@example.com', 'completed');

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function findCat(id) {
  return cats.find((c) => c.id === Number(id)) || fail(404, 'Кот не найден');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const CAT_FIELDS = ['name', 'breed', 'age_months', 'sex', 'price_cents', 'photo_url', 'description', 'status'];
const pick = (obj) => Object.fromEntries(CAT_FIELDS.filter((k) => k in obj).map((k) => [k, obj[k]]));
const clone = (x) => JSON.parse(JSON.stringify(x));

export async function handle(method, fullPath, body, token) {
  await new Promise((r) => setTimeout(r, 150));
  const [path, qs] = fullPath.split('?');
  const params = new URLSearchParams(qs || '');
  const route = `${method} ${path.replace(/\/\d+$/, '/:id')}`;
  const id = path.match(/\/(\d+)$/)?.[1];

  if (route === 'POST /api/admin/login') {
    if (body?.password !== PASSWORD) fail(401, 'Неверный пароль');
    return { token: TOKEN };
  }
  if (route === 'GET /api/breeds') {
    return [...new Set(cats.map((c) => c.breed))].sort();
  }
  if (path.startsWith('/api/admin/') && token !== TOKEN) fail(401, 'Нужно войти');

  switch (route) {
    case 'GET /api/admin/stats': {
      const count = (s) => cats.filter((c) => c.status === s).length;
      return {
        cats_available: count('available'),
        cats_reserved: count('reserved'),
        cats_sold: count('sold'),
        orders_new: orders.filter((o) => o.status === 'new').length,
        revenue_cents: orders
          .filter((o) => o.status === 'completed')
          .reduce((sum, o) => sum + (cats.find((c) => c.id === o.cat_id)?.price_cents || 0), 0),
      };
    }
    case 'GET /api/admin/cats': {
      const status = params.get('status');
      return clone(cats.filter((c) => !status || c.status === status));
    }
    case 'POST /api/admin/cats': {
      const cat = { status: 'available', ...pick(body), id: nextCatId++, created_at: now() };
      cats.push(cat);
      return clone(cat);
    }
    case 'PATCH /api/admin/cats/:id': {
      const cat = findCat(id);
      Object.assign(cat, pick(body));
      return clone(cat);
    }
    case 'DELETE /api/admin/cats/:id': {
      const cat = findCat(id);
      if (orders.some((o) => o.cat_id === cat.id && ['new', 'confirmed'].includes(o.status))) {
        fail(409, 'У кота есть открытый заказ');
      }
      cats.splice(cats.indexOf(cat), 1);
      return null;
    }
    case 'POST /api/admin/upload': {
      const file = body.get('photo');
      if (!file) fail(400, 'Нет файла');
      return { url: await readFileAsDataUrl(file) };
    }
    case 'GET /api/admin/orders': {
      const status = params.get('status');
      return clone(orders.filter((o) => !status || o.status === status));
    }
    case 'PATCH /api/admin/orders/:id': {
      const order = orders.find((o) => o.id === Number(id)) || fail(404, 'Заказ не найден');
      const cat = cats.find((c) => c.id === order.cat_id);
      order.status = body.status;
      if (cat) {
        if (body.status === 'cancelled') cat.status = 'available';
        if (body.status === 'completed') cat.status = 'sold';
        if (body.status === 'confirmed') cat.status = 'reserved';
      }
      return clone(order);
    }
    default:
      fail(404, `Нет такого маршрута: ${route}`);
  }
}
