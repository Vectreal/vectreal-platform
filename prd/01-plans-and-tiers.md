# Plans & Tiers

_Single source of truth for plan definitions, target audiences, pricing anchors, and transition rules._

---

## Plan Identifiers

The values in the **`id`** column are the canonical string literals used in:
- the `plan` column of the `organizations` table
- the `plan` column of the `users` table (personal/hobby workspaces)
- API responses, feature-flag checks, and billing-provider metadata

| id | Display name | Audience |
|----|-------------|---------|
| `free` | Free | Individual hobbyists, students, open-source projects |
| `pro` | Pro | Independent creators, small studios, freelancers |
| `business` | Business | Growing teams and agencies |
| `enterprise` | Enterprise | Large organisations with custom SLA requirements |

---

## Plan Descriptions

### `free`
- No credit card required.
- Aimed at first-time users exploring the platform.
- Subject to the tightest quotas (see [Limits & Quotas](./02-limits-and-quotas.md)).
- Upgrades to `pro` via self-serve checkout.
- Cannot be downgraded (it is the floor).

### `pro`
- Monthly or annual billing.
- Unlocks higher quotas, priority optimization queue, and advanced embed controls.
- Upgrades to `business` or `enterprise` via self-serve or sales-assisted flow.
- Downgrades to `free` at end of current billing period.

### `business`
- Monthly or annual billing (annual discount applies).
- Adds team seats, organization-level API key management, and SAML/OIDC-compatible architecture (SSO is only fully unlocked on `enterprise`; see [Entitlements](./03-entitlements.md)).
- Upgrades to `enterprise` via sales-assisted flow.
- Downgrades to `pro` at end of current billing period.

### `enterprise`
- Annual billing only; custom pricing negotiated via sales.
- Adds custom SLA, dedicated support channel, custom data-residency options, and audit log export.
- Does not self-serve upgrade or downgrade; all changes are managed by the account team.

---

## Upgrade / Downgrade Rules

| From | To | Mechanism | When effective |
|------|----|-----------|---------------|
| `free` | `pro` | Self-serve checkout | Immediately on payment |
| `free` | `business` | Self-serve checkout | Immediately on payment |
| `free` | `enterprise` | Sales-assisted | On contract execution |
| `pro` | `business` | Self-serve upgrade | Immediately (prorated) |
| `pro` | `enterprise` | Sales-assisted | On contract execution |
| `pro` | `free` | Self-serve cancellation | End of billing period |
| `business` | `enterprise` | Sales-assisted | On contract execution |
| `business` | `pro` | Self-serve downgrade | End of billing period |
| `business` | `free` | Self-serve cancellation | End of billing period |
| `enterprise` | any | Account-team managed | Per contract terms |

---

## Trial Policy

- New sign-ups start on `free` by default.
- A **14-day `pro` trial** may be offered via referral links or in-app prompts (no credit card required).
- Trial state is tracked as a billing state; see [Billing States](./04-billing-states.md).
- At trial end the account reverts to `free` unless a payment method has been added.

---

## Open Questions

<!-- Add outstanding decisions here and remove them once resolved -->

- [ ] Should `business` be renamed to `team` for clarity?
- [ ] Confirm annual pricing discounts (currently assumed 20 %).
- [ ] Decide whether `enterprise` requires a minimum seat count.
