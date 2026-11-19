import { join } from 'node:path'
import { createApp, openDb } from './app.js'

const {
  PORT = 3001,
  DB_PATH = join(import.meta.dirname, 'data.db'),
  ADMIN_PASSWORD,
  NODE_ENV,
  CORS_ORIGINS = 'http://localhost:5173,http://localhost:5174',
} = process.env
if (!ADMIN_PASSWORD && NODE_ENV === 'production') throw new Error('Set ADMIN_PASSWORD in production')

const app = createApp({
  db: openDb(DB_PATH),
  uploadsDir: join(import.meta.dirname, 'uploads'),
  adminPassword: ADMIN_PASSWORD ?? 'admin',
  corsOrigins: CORS_ORIGINS.split(','),
})
app.listen(PORT, () => console.log(`api on http://localhost:${PORT}`))
