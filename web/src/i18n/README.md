# Web i18n (`src/i18n/`)

Runtime wiring for `useI18n()` → `t.*`. **Copy lives in modules** (`modules/<seg>/i18n/`) and `core/` (`common`, `shell`, `workspace_nav`, `workspace_runtime`, …).

| File | Role |
| --- | --- |
| `en.ts`, `zh.ts` | Aggregated `t` trees (`core` + `chrome` + all modules) |
| `module-locales.ts` | **Generated** — module namespace imports (`refresh-module-i18n-index.mjs`) |
| `context.tsx` | `I18nProvider`, `useI18n()` |
| `pick-locale.ts` | `messagesForLocale(locale)` for non-React code |
| `format.ts` | `fmt()`, number/date helpers |
| `locale.ts` | `Locale`, `LOCALES`, `localeLabel()` |
| `locale-menu.tsx` | Language switcher items |
| `dev-messages.ts` | `core.dev` hook error strings |
| `indexed-list.ts` | `i18nIndexedList()` for marketing `"0"`/`"1"` blobs |
| `core/en.ts`, `core/zh.ts` | Product-wide: `common`, `api_error_codes`, `dev` |

**Add module copy:** edit `modules/<seg>/i18n/en.ts` + `zh.ts`, then `npx tsx scripts/refresh-module-i18n-index.mjs`.

**Checks:** `npm run audit:locale && npm run typecheck && npm test`

Convention: [modules/i18n-convention.md](../modules/i18n-convention.md)
