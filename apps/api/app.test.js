import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, openDb } from './app.js'

const app = createApp({
  db: openDb(':memory:'),
  uploadsDir: mkdtempSync(join(tmpdir(), 'api-uploads-')),
  adminPassword: 'secret',
  corsOrigins: ['http://localhost:5173'],
})
let server, base, token

before(async () => {
  await new Promise((resolve) => (server = app.listen(0, resolve)))
  base = `http://localhost:${server.address().port}`
  token = (await call('POST', '/api/admin/login', { password: 'secret' })).body.token
})
after(() => server.close())

async function call(method, path, body, auth) {
  const headers = { 'content-type': 'application/json' }
  if (auth) headers.authorization = `Bearer ${auth}`
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) })
  return { status: res.status, body: res.status === 204 ? null : await res.json() }
}
const newCat = (extra) =>
  call('POST', '/api/admin/cats', { name: 'Барсик', breed: 'Британская', age_months: 3, sex: 'male', price_cents: 2500000, ...extra }, token)
const order = (cat_id) =>
  call('POST', '/api/orders', { cat_id, customer_name: 'Анна', phone: '+70000000000', email: 'anna@example.com' })

test('admin endpoints need a token', async () => {
  assert.equal((await call('GET', '/api/admin/cats')).status, 401)
  assert.equal((await call('GET', '/api/admin/stats', null, 'wrong')).status, 401)
  assert.equal((await call('POST', '/api/admin/login', { password: 'nope' })).status, 401)
})

test('cat create validates input', async () => {
  assert.equal((await call('POST', '/api/admin/cats', { name: 'X' }, token)).status, 400)
  assert.equal((await newCat({ sex: 'robot' })).status, 400)
  assert.equal((await newCat({ price_cents: -1 })).status, 400)
  assert.equal((await call('GET', '/api/cats/999')).status, 404)
})

test('order lifecycle moves the cat through its statuses', async () => {
  const cat = (await newCat()).body
  assert.equal(cat.status, 'available')

  const created = await order(cat.id)
  assert.equal(created.status, 201)
  assert.equal(created.body.cat_name, 'Барсик')
  assert.equal(created.body.status, 'new')
  assert.equal((await call('GET', `/api/cats/${cat.id}`)).body.status, 'reserved')
  assert.equal((await order(cat.id)).status, 409, 'a reserved cat cannot be ordered twice')
  assert.equal((await call('DELETE', `/api/admin/cats/${cat.id}`, null, token)).status, 409)

  const stats = (await call('GET', '/api/admin/stats', null, token)).body
  assert.equal(stats.cats_reserved, 1)
  assert.equal(stats.orders_new, 1)

  const done = await call('PATCH', `/api/admin/orders/${created.body.id}`, { status: 'completed' }, token)
  assert.equal(done.body.status, 'completed')
  assert.equal((await call('GET', `/api/cats/${cat.id}`)).body.status, 'sold')
  assert.equal((await call('GET', '/api/admin/stats', null, token)).body.revenue_cents, 2500000)
  assert.equal((await call('PATCH', `/api/admin/orders/${created.body.id}`, { status: 'cancelled' }, token)).status, 409)
})

test('cancelling frees the cat, and it can then be deleted', async () => {
  const cat = (await newCat({ name: 'Мурка', breed: 'Мейн-кун', price_cents: 100 })).body
  const o = (await order(cat.id)).body
  assert.equal((await call('PATCH', `/api/admin/orders/${o.id}`, { status: 'new' }, token)).status, 400)
  await call('PATCH', `/api/admin/orders/${o.id}`, { status: 'cancelled' }, token)
  assert.equal((await call('GET', `/api/cats/${cat.id}`)).body.status, 'available')

  assert.equal((await call('DELETE', `/api/admin/cats/${cat.id}`, null, token)).status, 204)
  const orders = (await call('GET', '/api/admin/orders?status=cancelled', null, token)).body
  assert.equal(orders[0].cat_id, null)
  assert.equal(orders[0].cat_name, 'Мурка')
})

test('public list filters, sorts and lists breeds', async () => {
  await newCat({ name: 'Дешёвый', breed: 'Сфинкс', price_cents: 1 })
  const cheapFirst = (await call('GET', '/api/cats?sort=price_asc')).body
  assert.ok(Array.isArray(cheapFirst))
  assert.equal(cheapFirst[0].name, 'Дешёвый')
  assert.deepEqual((await call('GET', '/api/cats?breed=Сфинкс')).body.map((c) => c.name), ['Дешёвый'])
  assert.ok((await call('GET', '/api/cats?status=available')).body.every((c) => c.status === 'available'))
  assert.equal((await call('GET', '/api/cats?status=lost')).status, 400)
  assert.deepEqual((await call('GET', '/api/breeds')).body, ['Британская', 'Сфинкс'])
})

test('upload stores images only and serves them', async () => {
  const upload = (blob) => {
    const form = new FormData()
    form.append('photo', blob, 'cat.png')
    return fetch(base + '/api/admin/upload', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form })
  }
  const ok = await upload(new Blob(['png-bytes'], { type: 'image/png' }))
  const { url } = await ok.json()
  assert.match(url, /^\/uploads\/[0-9a-f]{32}\.png$/)
  const served = await fetch(base + url)
  assert.equal(await served.text(), 'png-bytes')
  assert.equal((await upload(new Blob(['<script>'], { type: 'text/html' }))).status, 400)
})

test('cors allows the configured origin only', async () => {
  const pre = await fetch(base + '/api/cats', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } })
  assert.equal(pre.status, 204)
  assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  const other = await fetch(base + '/api/cats', { headers: { origin: 'http://evil.test' } })
  assert.equal(other.headers.get('access-control-allow-origin'), null)
})
