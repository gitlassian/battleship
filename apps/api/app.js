import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CAT_STATUSES = ['available', 'reserved', 'sold']
const ORDER_STATUSES = ['new', 'confirmed', 'cancelled', 'completed']
// what a cat becomes when an admin moves its order to this status
const CAT_STATUS_FOR_ORDER = { confirmed: 'reserved', cancelled: 'available', completed: 'sold' }
const ORDER_COLS = 'id, cat_id, cat_name, customer_name, phone, email, comment, status, created_at'
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }
const MAX_UPLOAD = 5 * 1024 * 1024

export function openDb(path) {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS cats (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      breed TEXT NOT NULL,
      age_months INTEGER NOT NULL,
      sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
      price_cents INTEGER NOT NULL,
      photo_url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      cat_id INTEGER REFERENCES cats (id) ON DELETE SET NULL,
      cat_name TEXT NOT NULL,
      price_cents INTEGER NOT NULL, -- snapshot, so revenue survives price edits and deleted cats
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'cancelled', 'completed')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );`)
  return db
}

const httpError = (status, message) => Object.assign(new Error(message), { status })

const str = (max, required = true) => (v) =>
  typeof v === 'string' && v.length <= max && (!required || v.trim() !== '')
const int = (v) => Number.isInteger(v) && v >= 0
const oneOf = (list) => (v) => list.includes(v)

const CAT_FIELDS = {
  name: str(100),
  breed: str(100),
  age_months: int,
  sex: oneOf(['male', 'female']),
  price_cents: int,
  photo_url: str(500, false),
  description: str(5000, false),
  status: oneOf(CAT_STATUSES),
}
const ORDER_FIELDS = {
  cat_id: int,
  customer_name: str(100),
  phone: str(50),
  email: (v) => str(200)(v) && /^\S+@\S+\.\S+$/.test(v.trim()),
  comment: str(2000, false),
}

// Validates a JSON body against a spec; only spec keys get through, so they are safe as column names.
function fields(body, spec, required) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'JSON body required')
  const out = {}
  for (const [key, ok] of Object.entries(spec)) {
    if (body[key] === undefined) {
      if (required.includes(key)) throw httpError(400, `${key} is required`)
      continue
    }
    if (!ok(body[key])) throw httpError(400, `${key} is invalid`)
    out[key] = typeof body[key] === 'string' ? body[key].trim() : body[key]
  }
  return out
}

export function createApp({ db, uploadsDir, adminPassword, corsOrigins = [] }) {
  mkdirSync(uploadsDir, { recursive: true })
  // shortcut: tokens live in memory and never expire; admins log in again after a restart. Move to a table if that bothers anyone.
  const tokens = new Set()

  const tx = (fn) => {
    db.exec('BEGIN')
    try {
      const result = fn()
      db.exec('COMMIT')
      return result
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  const getCat = (id) => db.prepare('SELECT * FROM cats WHERE id = ?').get(Number(id) || 0)
  const getOrder = (id) => db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).get(Number(id) || 0)
  const found = (row, what) => {
    if (!row) throw httpError(404, `${what} not found`)
    return row
  }
  const statusFilter = (status, allowed) => {
    if (status === undefined) return null
    if (!allowed.includes(status)) throw httpError(400, 'status is invalid')
    return status
  }

  function listCats(query) {
    const order = { newest: 'id DESC', price_asc: 'price_cents, id', price_desc: 'price_cents DESC, id' }[query.sort ?? 'newest']
    if (!order) throw httpError(400, 'sort is invalid')
    const breed = typeof query.breed === 'string' && query.breed ? query.breed : null
    return db
      .prepare(`SELECT * FROM cats WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR breed = ?2) ORDER BY ${order}`)
      .all(statusFilter(query.status, CAT_STATUSES), breed)
  }

  const app = express()

  app.use((req, res, next) => {
    const origin = req.get('origin')
    if (corsOrigins.includes(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
        Vary: 'Origin',
      })
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
  app.use(express.json())
  app.use('/uploads', express.static(uploadsDir, { setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }))

  // Public
  app.get('/api/cats', (req, res) => res.json(listCats(req.query)))
  app.get('/api/cats/:id', (req, res) => res.json(found(getCat(req.params.id), 'cat')))
  app.get('/api/breeds', (req, res) =>
    res.json(db.prepare('SELECT DISTINCT breed FROM cats ORDER BY breed').all().map((r) => r.breed)),
  )

  app.post('/api/orders', (req, res) => {
    const o = fields(req.body, ORDER_FIELDS, ['cat_id', 'customer_name', 'phone', 'email'])
    const order = tx(() => {
      const cat = found(getCat(o.cat_id), 'cat')
      if (cat.status !== 'available') throw httpError(409, 'cat is not available')
      db.prepare("UPDATE cats SET status = 'reserved' WHERE id = ?").run(cat.id)
      const { lastInsertRowid } = db
        .prepare(
          'INSERT INTO orders (cat_id, cat_name, price_cents, customer_name, phone, email, comment) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(cat.id, cat.name, cat.price_cents, o.customer_name, o.phone, o.email, o.comment ?? '')
      return getOrder(lastInsertRowid)
    })
    res.status(201).json(order)
  })

  // Admin
  const hash = (s) => createHash('sha256').update(s).digest()
  app.post('/api/admin/login', (req, res) => {
    const password = req.body?.password
    if (typeof password !== 'string' || !timingSafeEqual(hash(password), hash(adminPassword))) {
      throw httpError(401, 'wrong password')
    }
    const token = randomBytes(32).toString('hex')
    tokens.add(token)
    res.json({ token })
  })

  app.use('/api/admin', (req, res, next) => {
    const token = req.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
    if (!tokens.has(token)) throw httpError(401, 'unauthorized')
    next()
  })

  app.get('/api/admin/cats', (req, res) => res.json(listCats(req.query)))

  app.post('/api/admin/cats', (req, res) => {
    const c = fields(req.body, CAT_FIELDS, ['name', 'breed', 'age_months', 'sex', 'price_cents'])
    const keys = Object.keys(c)
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO cats (${keys}) VALUES (${keys.map(() => '?')})`)
      .run(...Object.values(c))
    res.status(201).json(getCat(lastInsertRowid))
  })

  app.patch('/api/admin/cats/:id', (req, res) => {
    const cat = found(getCat(req.params.id), 'cat')
    const c = fields(req.body, CAT_FIELDS, [])
    const keys = Object.keys(c)
    if (keys.length) {
      db.prepare(`UPDATE cats SET ${keys.map((k) => `${k} = ?`)} WHERE id = ?`).run(...Object.values(c), cat.id)
    }
    res.json(getCat(cat.id))
  })

  app.delete('/api/admin/cats/:id', (req, res) => {
    const cat = found(getCat(req.params.id), 'cat')
    if (db.prepare("SELECT 1 FROM orders WHERE cat_id = ? AND status IN ('new', 'confirmed')").get(cat.id)) {
      throw httpError(409, 'cat has an open order')
    }
    db.prepare('DELETE FROM cats WHERE id = ?').run(cat.id)
    res.sendStatus(204)
  })

  app.post('/api/admin/upload', async (req, res) => {
    const size = Number(req.get('content-length'))
    if (!size) throw httpError(411, 'content-length required')
    if (size > MAX_UPLOAD) throw httpError(413, 'photo must be up to 5 MB')
    // shortcut: the built-in multipart parser holds the whole body in memory; fine under the 5 MB cap
    const form = await new Request('http://upload', {
      method: 'POST',
      headers: { 'content-type': req.get('content-type') ?? '' },
      body: req,
      duplex: 'half',
    })
      .formData()
      .catch(() => {
        throw httpError(400, 'multipart form with a "photo" file required')
      })
    const photo = form.get('photo')
    const ext = IMAGE_EXT[photo?.type]
    if (!ext) throw httpError(400, 'photo must be a jpeg, png, webp or gif file')
    const name = randomBytes(16).toString('hex') + ext
    writeFileSync(join(uploadsDir, name), Buffer.from(await photo.arrayBuffer()))
    // relative: both frontends proxy /uploads to the api
    res.json({ url: `/uploads/${name}` })
  })

  app.get('/api/admin/orders', (req, res) =>
    res.json(
      db
        .prepare(`SELECT ${ORDER_COLS} FROM orders WHERE (?1 IS NULL OR status = ?1) ORDER BY id DESC`)
        .all(statusFilter(req.query.status, ORDER_STATUSES)),
    ),
  )

  app.patch('/api/admin/orders/:id', (req, res) => {
    const { status } = fields(req.body, { status: oneOf(Object.keys(CAT_STATUS_FOR_ORDER)) }, ['status'])
    const order = tx(() => {
      const o = found(getOrder(req.params.id), 'order')
      if (o.status === 'cancelled' || o.status === 'completed') throw httpError(409, `order is already ${o.status}`)
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, o.id)
      if (o.cat_id !== null) db.prepare('UPDATE cats SET status = ? WHERE id = ?').run(CAT_STATUS_FOR_ORDER[status], o.cat_id)
      return getOrder(o.id)
    })
    res.json(order)
  })

  app.get('/api/admin/stats', (req, res) =>
    res.json(
      db
        .prepare(
          `SELECT
            (SELECT count(*) FROM cats WHERE status = 'available') AS cats_available,
            (SELECT count(*) FROM cats WHERE status = 'reserved') AS cats_reserved,
            (SELECT count(*) FROM cats WHERE status = 'sold') AS cats_sold,
            (SELECT count(*) FROM orders WHERE status = 'new') AS orders_new,
            (SELECT coalesce(sum(price_cents), 0) FROM orders WHERE status = 'completed') AS revenue_cents`,
        )
        .get(),
    ),
  )

  app.use((req, res) => res.status(404).json({ error: 'not found' }))
  app.use((err, req, res, next) => {
    const status = err.status ?? 500
    if (status >= 500) console.error(err)
    res.status(status).json({ error: status < 500 ? err.message : 'internal error' })
  })

  return app
}
