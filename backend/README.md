# Rapyd Ryd API (NestJS)

## Fare formula

\[
Fare = B + (D \times R_d) + (T \times R_t) + E
\]

| Symbol | Factor | Admin field |
| --- | --- | --- |
| B | Base fare | `baseFare` |
| D | Distance (km) | quote input |
| Rd | Price per km | `perKm` (flat) or `bands[]` (banded) |
| T | Duration (minutes) | quote input |
| Rt | Price per minute | `perMinute` |
| E | Extras | `bookingFee` + wait + intercity + airport/night/rain uplift |

Admin can change every factor via `PUT /admin/pricing`. Apps quote via `POST /pricing/quote`.

## Run

**Postgres is required** — there is no JSON/temp database anymore.

```bash
cp .env.example .env
# Set DATABASE_URL to Railway Postgres (or local Docker Postgres)
npm install
npm run start:dev
```

API defaults to `http://localhost:4000`.

Admin login: phone `admin`, password from `RAPYD_ADMIN_PASSWORD` (default `desk`).

Production env checklist (Railway + Google keys): see `../docs/production-env.md`.

## Email / OTP (Resend)

OTP and transactional mail go through the `mail` queue → Resend. The admin **Email** desk (`/email`) edits the HTML theme, templates, and can send to anyone or to users on file.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/PUT` | `/admin/mail/theme` | Brand HTML shell (colours, footer, wrap) |
| `GET/POST` | `/admin/mail/templates` | List / create-or-update templates |
| `DELETE` | `/admin/mail/templates/:id` | Remove a custom template |
| `POST` | `/admin/mail/preview` | Render subject + HTML with theme |
| `GET` | `/admin/mail/directory` | Users that have an email |
| `POST` | `/admin/mail/send` | Queue send to anyone / audiences / picked users |
| `GET` | `/admin/mail/outbox` | Recent desk sends |

1. Create an API key at [resend.com](https://resend.com/api-keys)
2. Set `RESEND_API_KEY` and a verified `RESEND_FROM`
3. Request OTP with an email:

```bash
curl -X POST http://localhost:4000/auth/otp \
  -H 'content-type: application/json' \
  -d '{"phone":"+2348000000000","purpose":"login","email":"you@example.com"}'
```

Without `RESEND_API_KEY`, codes and desk sends are logged to the server console (OTP returned when `EXPOSE_OTP=true`).

## Ride sessions

Every trip is a full `RideSession` (not a thin receipt): customer + driver parties, pickup/dropoff coords, planned/actual distance, quoted/fare/earnings, payment, Along seat, latest locations, and append-only status / fare / location / chat history.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/rides` | customer, admin | Create session (quotes fare, status `searching`) |
| `GET` | `/rides` | admin / scoped driver or customer | List sessions |
| `GET` | `/rides/active/current` | any JWT | Active session for relaunch |
| `GET` | `/rides/:id` | JWT | Full session |
| `GET` | `/rides/:id/summary` | JWT | Compact card fields |
| `POST` | `/rides/:id/assign` | admin, driver | Bind driver + vehicle |
| `POST` | `/rides/:id/stage` | admin, driver, customer | Status change + history |
| `POST` | `/rides/:id/fare` | admin, driver, customer | Fare change + history |
| `POST` | `/rides/:id/location` | driver, customer | Location ping + trail |
| `POST` | `/rides/:id/chat` | driver, customer | Text/voice chat event |

Admin Rides desk loads `GET /rides` when `NEXT_PUBLIC_API_URL` points at this API.

## Sync vs queue

**Stay on the request path (fast):**

- `POST /pricing/quote`
- `GET/PUT /admin/pricing`
- Auth login / OTP verify / refresh
- Ride create / stage / fare / location / chat (state only)

**Always enqueue (so the API is not overwhelmed):**

| Job | Why |
| --- | --- |
| `notify.push` | Device fan-out |
| `mail.send` | Receipts, OTP SMS/email, digests |
| `dispatch.match` | Nearby-driver geo + offer fan-out |
| `kyc.verify` | NIN / BVN / bank partner calls |
| `payouts.transfer` | Payout partner transfers |
| `ledger.settle` | Wallet + commission after trip complete |
| `analytics.track` | Telemetry |

Set `REDIS_URL` to use BullMQ. Without it, jobs drain in-process (fine for local demos).

See `GET /admin/ops` or `GET /` for the live list.
