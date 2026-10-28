# TradeFi Ops — Trading Automation Admin Dashboard

A frontend-only, multi-strategy trading operations dashboard built on the
[Reacto template](https://github.com/parvejhossain55/reacto). The implementation follows the
template's React 18 + TypeScript + Vite + Tailwind CSS + React Router + Zustand foundation and
uses its existing `@/` aliases, component conventions, color tokens, and test setup.

> **Demo mode:** this project has no trading engine, backend, broker integration, market feed, or
> execution system. Every pair status, signal, execution, heartbeat, and event shown in the UI is
> local mock data. No orders are placed and no financial result is implied.

## Features

- **Overview dashboard** — computed summary metrics, a searchable/filterable pair monitoring table,
  pair status distribution, strategy usage, recent simulated signals, recent configuration changes,
  and recent application events.
- **Trading pairs** — create, edit, search, filter, sort, enable/disable, and archive pairs. Symbols
  are normalized to uppercase letters/digits and must be unique.
- **Pair details** — six tabs: Overview, Strategy Configuration, Risk Settings, Signals,
  Execution History, and Activity Log.
- **Strategy Library** — reusable definitions with identifier, version, category, supported markets
  and timeframes, parameter schema, defaults, enable/disable, duplication, and assigned-pair
  inspection. A built-in schema builder creates and edits parameter definitions.
- **Schema-driven pair configuration** — fields are generated from each strategy's parameter schema
  (integer, decimal, boolean, select, text, timeframe, percentage, and duration). Includes validation,
  inheritance/customization markers, per-field revert, reset-to-defaults confirmation, configuration
  versioning, unsaved-change protection, and version-mismatch warnings.
- **Strategy assignments** — pair-to-strategy assignment records with configuration status,
  automation status, assignment enable/disable, reassignment, and configuration inspection.
- **Live Monitor** — explicit disconnected/demo status, static heartbeat, pair health, last signal,
  last processed event, warning/error indicators, and a filterable feed of simulated events.
- **Signals & execution history** — search, pair/strategy/type/status/date filters, pagination, and
  detail dialogs. Execution mode is always `Simulation`.
- **Risk Management** — global caps and session restrictions, pair-level overrides (stop loss,
  take profit, sizing, sessions, cooldown), validation, and a confirmed emergency automation halt
  that updates local state only.
- **Global Settings** — app identity, timezones, default market/timeframe/strategy, notification
  preferences, risk summary, environment status, read-only data-source placeholders, and demo reset.
- **Working interactions throughout** — dialogs, toasts, confirmations, validation, empty states,
  responsive sidebar/header/tables, dark theme, and global pair/strategy search.

## Run locally

Requires Node.js 20+ and pnpm (the repository includes a `pnpm-lock.yaml` and pins
`pnpm@12` via `packageManager`).

```bash
pnpm install
pnpm dev
```

Open the Vite URL (default `http://localhost:5173`).

### Verification commands

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

## Routes

| Route | Page |
| --- | --- |
| `/` | Overview |
| `/trading-pairs` | Trading Pairs |
| `/trading-pairs/:pairId` | Pair Details (`?tab=configuration` deep-links the config tab) |
| `/strategies` | Strategy Library |
| `/assignments` | Strategy Assignments |
| `/monitor` | Live Monitor |
| `/signals` | Signals & Events |
| `/executions` | Execution History |
| `/risk` | Risk Management |
| `/settings` | Global Settings |

## Architecture

```text
src/
├── components/
│   ├── layout/          # Sidebar, header, global search, admin shell
│   ├── ui/              # Icons, cards, tables, modals, forms, charts, toasts
│   ├── pairs/           # Pair dialog, schema-driven parameter fields
│   ├── strategies/      # Strategy metadata + schema builder
│   ├── assignments/     # Assign/reassign dialog
│   ├── risk/            # Pair risk override form
│   ├── signals/         # Reusable signal history table
│   └── executions/      # Reusable execution history table
├── data/seed.ts         # Seeded demo records
├── services/
│   ├── mockDb.ts        # localStorage-backed mock database
│   └── tradingApi.ts    # Repository/service boundary for future API integration
├── store/
│   ├── tradingStore.ts  # Zustand snapshot state + actions
│   └── toastStore.ts    # Toast notifications
├── types/trading.ts     # Domain models and shared enums
├── utils/trading.ts     # Normalization, schema validation, overrides, status helpers
└── pages/               # Route-level dashboard pages
```

### Data and configuration model

- `TradingPair` — stable ID, normalized symbol, market, timeframe, lifecycle status, automation flag.
- `StrategyDefinition` — reusable definition with a declared parameter schema and defaults.
- `StrategyAssignment` — one record per pair (initially); references a strategy and stores only
  **explicit pair overrides**.
- `PairRiskConfiguration` — global-by-default or pair-specific limits; global saves never rewrite
  pair overrides.
- Signals, execution records, and application events are separate history collections keyed by
  stable pair/strategy IDs.

Pair configuration values resolve as `override ?? strategy default`. Editing a strategy definition
or its defaults therefore cannot silently overwrite customized pair values. Saving pair
configuration increments its configuration version and writes an application event.

The seeded demo database persists to `localStorage` under `tradefi.admin.db.v1`. Use **Global
Settings → Reset demo workspace** to restore the original records.

## Backend integration readiness

Page components consume Zustand actions backed by `tradingApi`. Replace those methods with HTTP
client calls while preserving the returned `TradingSnapshot` contract (or adapt the store to
per-resource loading). Suggested endpoints align with the service methods:

- `GET/POST/PATCH /pairs`, pair status and automation actions
- `GET/POST/PATCH /strategies`, duplicate and enable/disable
- `GET/POST/PATCH /assignments`, pair configuration updates
- `GET /signals`, `GET /executions`, `GET /events`, monitoring health
- `GET/PUT /risk/global`, `GET/PUT /risk/pairs/:pairId`
- `GET/PUT /settings`

Security requirements for a real implementation:

- Never place broker credentials, API secrets, or private keys in frontend code or mock data.
- Enforce risk limits and assignment state server-side before execution.
- Only present live monitoring after a real authenticated connection is available.
- Treat the current demo heartbeat and status as static UI state, not a connectivity signal.

## Remaining limitations

- Frontend-only; no backend, auth, WebSocket, market feed, broker, order placement, or strategy
  execution engine.
- Seeded timestamps and heartbeat are static; refreshing reloads the same local snapshot.
- One active strategy per pair is supported by the current UI. The data model uses stable IDs so a
  future one-to-many assignment model can be added without rewriting page contracts.
- Archived pairs cannot be restored in this demo.
- Local mock data is per-browser and can be cleared by browser storage settings.
- Risk controls configure the dashboard model only and do not guarantee execution safety.

## Attribution

Built on the Reacto React template by parvejhossain55 (MIT). Application domain models, pages,
components, mock data, and service layer were added for this dashboard.
