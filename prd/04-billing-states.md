# Billing States

_Subscription lifecycle state machine — authoritative values for the `billing_status` field on organisations and users._

---

## State Identifiers

| State id | Display name | Description |
|----------|-------------|-------------|
| `none` | No subscription | Account has never had a paid subscription (default for `free`) |
| `trialing` | Trial | Active 14-day trial of a paid plan; no payment method required |
| `active` | Active | Subscription is current and all payments are up to date |
| `past_due` | Past due | Latest payment attempt failed; grace period is in effect |
| `unpaid` | Unpaid | Grace period exhausted; account is soft-locked |
| `canceled` | Canceled | Subscription was explicitly canceled; will not renew |
| `paused` | Paused | Subscription temporarily paused (e.g., at user request) |
| `incomplete` | Incomplete | Subscription created but initial payment not yet confirmed |
| `incomplete_expired` | Incomplete (expired) | Initial payment window elapsed without confirmation |

---

## State Transition Diagram

```
  new account (plan = free,        start paid trial
  billing_state = none)            ──────────────▶ [ trialing ] ──── trial ends ──▶ [ none ]
         │                                              │
         │ checkout                                     │ payment added
         ▼                                              ▼
                  [ incomplete ] ─────────▶ [ active ] ◀─────── payment succeeds ─────┐
                       │                        │                                       │
                  window expires          payment fails                                 │
                       │                        ▼                                       │
                       ▼                  [ past_due ] ──── payment retries succeed ───┘
              [ incomplete_expired ]           │
                                          grace period exhausted
                                               │
                                               ▼
                                          [ unpaid ] ──── payment succeeds ──▶ [ active ]
                                               │
                                          user cancels
                                               │
                                               ▼
                                          [ canceled ]
```

---

## Access Model Per State

The table below defines what level of platform access is granted in each state. "Full access" means all entitlements for the subscribed plan are available.

| State id | Platform access | Uploads | Publishes | API | Dashboard |
|----------|----------------|---------|-----------|-----|-----------|
| `none` | Free-tier entitlements only | ✓ (free limits) | ✓ (free limits) | ✓ (free limits) | ✓ |
| `trialing` | Full access for trial plan | ✓ | ✓ | ✓ | ✓ |
| `active` | Full access for subscribed plan | ✓ | ✓ | ✓ | ✓ |
| `past_due` | Full access + warning banner | ✓ | ✓ | ✓ | ✓ |
| `unpaid` | Read-only; no new uploads or publishes | ✗ | ✗ | Read-only | ✓ |
| `canceled` | Reverts to free-tier entitlements | ✓ (free limits) | ✓ (free limits) | ✓ (free limits) | ✓ |
| `paused` | Read-only | ✗ | ✗ | Read-only | ✓ |
| `incomplete` | Free-tier entitlements only | ✓ (free limits) | ✓ (free limits) | ✓ (free limits) | ✓ |
| `incomplete_expired` | Free-tier entitlements only | ✓ (free limits) | ✓ (free limits) | ✓ (free limits) | ✓ |

---

## Grace Period Policy

| State | Grace period | Action at expiry |
|-------|-------------|-----------------|
| `past_due` | 7 days | Transition to `unpaid` |
| `trialing` | 0 days (trial period is explicit) | Transition to `none` |
| `incomplete` | 23 hours | Transition to `incomplete_expired` |

---

## Dunning Sequence (`past_due`)

When a payment fails the billing provider (Stripe) drives the retry schedule. The platform mirrors its webhook events:

1. **Day 0** — Payment fails → state transitions to `past_due`; in-app banner shown; email sent.
2. **Day 3** — Retry 1; if succeeds → `active`; if fails → email reminder.
3. **Day 5** — Retry 2; email reminder.
4. **Day 7** — Retry 3; if fails → `unpaid`; account soft-locked; email notification.

---

## Cancellation & Data Retention

- On cancellation the state becomes `canceled` at end of the billing period.
- Scenes, projects, and assets are retained for **90 days** after cancellation.
- After 90 days, data exceeding `free` quotas is flagged for deletion; users receive a 7-day warning email.
- Data within `free` quotas is retained indefinitely.

---

## Webhook Events (Billing Provider → Platform)

| Webhook event | Resulting state transition |
|---------------|---------------------------|
| `checkout.session.completed` | `incomplete` → `active` (or `trialing` → `active`) |
| `invoice.payment_succeeded` | `past_due` / `unpaid` → `active` |
| `invoice.payment_failed` | `active` → `past_due` |
| `customer.subscription.trial_will_end` | (notification only; no state change) |
| `customer.subscription.deleted` | any → `canceled` |
| `customer.subscription.paused` | `active` → `paused` |
| `customer.subscription.resumed` | `paused` → `active` |

---

## Open Questions

- [ ] Confirm grace period duration with finance (currently 7 days).
- [ ] Decide data-retention period post-cancellation (currently 90 days).
- [ ] Clarify whether `paused` state is exposed to all plans or enterprise only.
