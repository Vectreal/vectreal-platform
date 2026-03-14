# Consent Categories

_Taxonomy of user consent categories, their scope, enforcement rules, and storage requirements._

This document governs what data the Vectreal Platform may collect or process and under what legal basis.

---

## Legal Basis Reference

| Basis | Abbreviation | When used |
|-------|-------------|----------|
| Legitimate Interest | LI | Processing necessary for the platform to function |
| Consent | C | User has explicitly opted in |
| Contractual Necessity | CN | Required to fulfil the service contract |
| Legal Obligation | LO | Required by law (e.g., fraud prevention, tax) |

---

## Consent Category Definitions

### `necessary`
- **Display name:** Strictly Necessary
- **Legal basis:** CN / LO (no consent required)
- **Description:** Cookies and data processing that are essential for the platform to function. Includes session management, authentication tokens, CSRF protection, and load balancing.
- **Examples:** `sb-auth-token`, CSRF cookie, session affinity cookie.
- **User can opt out:** No.
- **Retention:** Duration of session or as required by auth provider.

---

### `functional`
- **Display name:** Functional
- **Legal basis:** C
- **Description:** Preferences that remember user choices to improve the experience (e.g., UI theme, sidebar state, last-used optimization preset).
- **Examples:** `theme`, `sidebar_collapsed`, `last_preset`.
- **User can opt out:** Yes.
- **Retention:** Up to 1 year from last activity.

---

### `analytics`
- **Display name:** Analytics & Performance
- **Legal basis:** C
- **Description:** Aggregate, anonymised usage data used to understand how users interact with the platform and improve product decisions. No personally identifiable information (PII) is sent to third-party analytics services without explicit consent.
- **Examples:** PostHog page views, feature-usage events (see [Analytics Event Taxonomy](./06-analytics-event-taxonomy.md)).
- **User can opt out:** Yes.
- **Retention:** 24 months of aggregate event data; raw events purged after 90 days.
- **Third parties:** PostHog (self-hosted or EU-region cloud).

---

### `marketing`
- **Display name:** Marketing & Personalisation
- **Legal basis:** C
- **Description:** Data used to personalise marketing communications, retargeting ads, and product-led growth experiments.
- **Examples:** UTM parameter capture, ad-platform pixels, email engagement tracking.
- **User can opt out:** Yes.
- **Retention:** 12 months from last touch.
- **Third parties:** To be determined (must be listed explicitly before activation).

---

### `third_party_integrations`
- **Display name:** Third-Party Integrations
- **Legal basis:** C
- **Description:** Data shared with optional third-party services that users explicitly connect (e.g., a CMS or e-commerce platform integration). Consent is per integration.
- **Examples:** Shopify product sync, Webflow site embed telemetry.
- **User can opt out:** Yes (per integration).
- **Retention:** As defined per integration.

---

## Consent Banner Requirements

1. The consent banner **must** be shown on first visit before any `analytics` or `marketing` cookies are set.
2. The banner **must** provide a "Reject all" option at the same prominence as "Accept all".
3. Granular category toggles **must** be accessible via a "Manage preferences" link.
4. Consent choices **must** be stored server-side (tied to `user_id` when authenticated, or to a first-party consent cookie when anonymous).
5. Consent **must** be re-solicited if the consent policy changes materially (version bump in the consent record).

---

## Consent Storage Schema (Reference)

```
consent_records
  id             uuid        PK
  user_id        uuid        FK → users (nullable for anonymous)
  anonymous_id   text        (populated when user_id is null)
  version        text        consent policy version (semver)
  necessary      boolean     always true
  functional     boolean
  analytics      boolean
  marketing      boolean
  recorded_at    timestamptz
  ip_country     text        (for jurisdiction detection)
  user_agent     text
```

---

## Jurisdiction Rules

| Jurisdiction | Regulation | Default state |
|-------------|-----------|--------------|
| EU / EEA | GDPR | All optional categories default to **off**; explicit opt-in required |
| UK | UK GDPR | Same as EU |
| US (general) | CCPA / state laws | All optional categories default to **on**; opt-out provided |
| Other | — | All optional categories default to **on**; opt-out provided |

_Jurisdiction is determined from IP geolocation on first visit. Users may override in account settings._

---

## Open Questions

- [ ] Confirm PostHog deployment model (self-hosted vs. EU cloud).
- [ ] Enumerate specific marketing third parties when campaign infrastructure is selected.
- [ ] Decide consent re-solicitation trigger (version bump threshold).
- [ ] Confirm whether `functional` consent is required for EU users or can be set under LI.
