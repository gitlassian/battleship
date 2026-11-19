# cat-shop

Online shop selling cats, with an admin panel.

| App | Path | Port | Stack |
|---|---|---|---|
| API | `apps/api` | 3001 | Node 22.13+, Express, built-in `node:sqlite` |
| Storefront | `apps/shop` | 5173 | React, Vite |
| Admin panel | `apps/admin` | 5174 | React, Vite |

Both frontends proxy `/api` to the API on port 3001 (override with `API_URL`).

## Run locally

```sh
npm run install:all
npm run dev:api     # http://localhost:3001
npm run dev:shop    # http://localhost:5173
npm run dev:admin   # http://localhost:5174  (dev password: admin)
```

The admin panel can also run without the API on an in-memory mock:
`npm --prefix apps/admin run dev:mock`.

Each app is a separate npm project; there is no root lockfile.

## Workflow

Work on `feat/<part>` branches and open a pull request into `main`.
