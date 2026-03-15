# Limits & Quotas

_Per-plan resource ceilings. Hard limits block the action; soft limits trigger an in-app warning._

All values are per **organisation** (or per personal workspace for `free` accounts).

---

## Storage

| Limit key                 | Unit | `free` | `pro`  | `business` | `enterprise` |
| ------------------------- | ---- | ------ | ------ | ---------- | ------------ |
| `storage_bytes_total`     | MB   | 500    | 10,240 | 102,400    | Custom       |
| `storage_bytes_per_scene` | MB   | 50     | 200    | 500        | Custom       |

_Enforcement: hard limit. Upload is blocked when the org total would be exceeded._

---

## Scenes

| Limit key                     | Unit  | `free` | `pro` | `business` | `enterprise` |
| ----------------------------- | ----- | ------ | ----- | ---------- | ------------ |
| `scenes_total`                | count | 10     | 200   | 2,000      | Unlimited    |
| `scenes_published_concurrent` | count | 3      | 50    | 500        | Unlimited    |

_Enforcement: `scenes_total` is a hard limit. `scenes_published_concurrent` is a hard limit._

---

## Projects

| Limit key        | Unit  | `free` | `pro` | `business` | `enterprise` |
| ---------------- | ----- | ------ | ----- | ---------- | ------------ |
| `projects_total` | count | 2      | 20    | 200        | Unlimited    |

_Enforcement: hard limit._

---

## Organization Seats

| Limit key   | Unit  | `free` | `pro` | `business` | `enterprise` |
| ----------- | ----- | ------ | ----- | ---------- | ------------ |
| `org_seats` | count | 1      | 1     | 10         | Custom       |

_Notes: `free` and `pro` are single-user workspaces. `business` allows up to 10 members; additional seats may be purchased as an add-on (pricing TBD). `enterprise` seats are set by contract._

---

## Optimization Queue

| Limit key                     | Unit  | `free` | `pro` | `business` | `enterprise` |
| ----------------------------- | ----- | ------ | ----- | ---------- | ------------ |
| `optimization_runs_per_month` | count | 20     | 500   | 5 000      | Unlimited    |
| `optimization_concurrent`     | count | 1      | 3     | 10         | Custom       |

_Enforcement: `optimization_runs_per_month` is a soft limit (warning at 80 %, hard block at 100 %)._

---

## API Access

| Limit key                 | Unit  | `free` | `pro`   | `business` | `enterprise` |
| ------------------------- | ----- | ------ | ------- | ---------- | ------------ |
| `api_requests_per_minute` | count | 30     | 300     | 1 000      | Custom       |
| `api_requests_per_month`  | count | 5 000  | 100 000 | 1 000 000  | Custom       |
| `api_keys_per_org`        | count | 2      | 10      | 50         | Unlimited    |

_Enforcement: `api_requests_per_minute` is a hard rate limit (HTTP 429). `api_requests_per_month` is a soft limit._

---

## Embed & Preview

| Limit key                      | Unit  | `free` | `pro`   | `business` | `enterprise` |
| ------------------------------ | ----- | ------ | ------- | ---------- | ------------ |
| `embed_bandwidth_gb_per_month` | GB    | 5      | 100     | 1 000      | Custom       |
| `preview_loads_per_month`      | count | 10 000 | 500 000 | Unlimited  | Unlimited    |

_Enforcement: `embed_bandwidth_gb_per_month` is a soft limit. `preview_loads_per_month` is a soft limit._

---

## Limit Enforcement Model

```
Request arrives
  │
  ▼
Is the org's plan active?  ──No──▶  Return 402 Payment Required
  │
  Yes
  ▼
Does the action exceed a hard limit?  ──Yes──▶  Return 403 Quota Exceeded
  │
  No
  ▼
Does the action exceed a soft limit threshold (80 %)?  ──Yes──▶  Allow + emit soft-limit warning
  │
  No
  ▼
Allow action
```

---

## Reset Semantics

- Monthly counters reset at the start of each calendar month (UTC):
  - `optimization_runs_per_month`
  - `api_requests_per_month`
  - `embed_bandwidth_gb_per_month`
  - `preview_loads_per_month`
- `api_requests_per_minute` is enforced as a rolling per-minute rate limit (HTTP 429), not a monthly counter.
- All other limit keys are cumulative or concurrent limits and do not reset monthly (for example `scenes_total`, `projects_total`, `storage_bytes_total`).

---

## How Limits Are Stored

Limit values are **not** hard-coded in application logic. They are resolved at runtime from:

1. A `plan_limits` configuration map (keyed by plan id + limit key).
2. `org_limit_overrides` table rows (for enterprise custom values).

This allows limits to be updated without a code deploy.

---

## Open Questions

- [ ] Define add-on pricing for extra `business` seats.
- [ ] Confirm `embed_bandwidth_gb_per_month` free-tier value with infrastructure team.
- [ ] Decide overage behaviour for `pro` storage (block vs. charge per GB).
