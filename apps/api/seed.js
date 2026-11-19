import { join } from 'node:path'
import { openDb } from './app.js'

const db = openDb(process.env.DB_PATH ?? join(import.meta.dirname, 'data.db'))
if (db.prepare('SELECT count(*) AS n FROM cats').get().n > 0) {
  console.log('cats table is not empty, nothing seeded (delete data.db to start over)')
  process.exit(0)
}

const cats = [
  ['Барсик', 'Британская короткошёрстная', 3, 'male', 2500000, 'Спокойный, любит сидеть на руках.'],
  ['Мурка', 'Мейн-кун', 4, 'female', 4500000, 'Крупная и ласковая, ладит с собаками.'],
  ['Снежок', 'Сибирская', 2, 'male', 2000000, 'Пушистый, гипоаллергенная порода.'],
  ['Уголёк', 'Бомбейская', 5, 'male', 3500000, 'Чёрный как ночь, очень общительный.'],
  ['Луна', 'Шотландская вислоухая', 3, 'female', 3000000, 'Тихая, приучена к лотку.'],
  ['Персик', 'Персидская', 6, 'male', 2800000, 'Любит, когда его вычёсывают.'],
  ['Соня', 'Рэгдолл', 4, 'female', 5000000, 'Обмякает на руках, как тряпичная кукла.'],
  ['Тигр', 'Бенгальская', 5, 'male', 6000000, 'Активный, любит играть с водой.'],
  ['Ася', 'Сфинкс', 3, 'female', 4000000, 'Тёплая и бархатная, ищет свитер и хозяина.'],
  ['Рыжик', 'Беспородная', 2, 'male', 500000, 'Рыжий, весёлый, здоровый.'],
]
const insert = db.prepare(
  'INSERT INTO cats (name, breed, age_months, sex, price_cents, description) VALUES (?, ?, ?, ?, ?, ?)',
)
for (const cat of cats) insert.run(...cat)
console.log(`seeded ${cats.length} cats`)
