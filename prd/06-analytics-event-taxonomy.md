# Analytics Event Taxonomy

_Canonical registry of every analytics event the Vectreal Platform emits. This is the single source of truth for event names, required properties, and routing rules._

---

## Conventions

- **Event names** use `snake_case` with the pattern `<noun>_<verb>` (e.g., `scene_uploaded`).
- All events carry a **common property envelope** (see below).
- Properties are listed as `required` or `optional`. Required properties **must** be present or the event is dropped.
- `$` prefix indicates a PostHog built-in property — do not alias it.

---

## Common Property Envelope

Every event automatically includes the following properties:

| Property        | Type          | Description                               |
| --------------- | ------------- | ----------------------------------------- |
| `$current_url`  | string        | Full URL at the time of the event         |
| `$pathname`     | string        | URL path                                  |
| `user_id`       | string (uuid) | Authenticated user ID (null if anonymous) |
| `org_id`        | string (uuid) | Organisation ID (null if no org context)  |
| `plan`          | string        | Current plan id (e.g., `free`, `pro`)     |
| `billing_state` | string        | Current billing state                     |
| `client_type`   | string        | `web` / `api` / `embed`                   |
| `session_id`    | string        | PostHog session ID                        |

---

## Event Registry

### Authentication

| Event name                      | Trigger                        | Required properties                 | Optional properties                                           | Consent required |
| ------------------------------- | ------------------------------ | ----------------------------------- | ------------------------------------------------------------- | ---------------- |
| `user_signed_up`                | New account created            | `method` (email\|oauth\|magic_link) | `referral_source`, `utm_source`, `utm_medium`, `utm_campaign` | `analytics`      |
| `user_signed_in`                | Successful sign-in             | `method`                            | —                                                             | `analytics`      |
| `user_signed_out`               | Sign-out action                | —                                   | —                                                             | `analytics`      |
| `user_password_reset_requested` | Password reset email triggered | —                                   | —                                                             | `analytics`      |

---

### Scene Lifecycle

| Event name                     | Trigger                       | Required properties                                                          | Optional properties                                               | Consent required |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------- |
| `scene_upload_started`         | User begins file upload       | `file_format`, `file_size_bytes`                                             | `project_id`, `folder_id`                                         | `analytics`      |
| `scene_upload_completed`       | Upload pipeline completes     | `scene_id`, `file_format`, `file_size_bytes`, `duration_ms`                  | `project_id`, `folder_id`                                         | `analytics`      |
| `scene_upload_failed`          | Upload pipeline fails         | `file_format`, `error_code`                                                  | `file_size_bytes`, `error_message`                                | `analytics`      |
| `scene_optimization_started`   | Optimization job queued       | `scene_id`, `preset`                                                         | `custom_params`                                                   | `analytics`      |
| `scene_optimization_completed` | Optimization job finishes     | `scene_id`, `preset`, `duration_ms`, `size_before_bytes`, `size_after_bytes` | —                                                                 | `analytics`      |
| `scene_optimization_failed`    | Optimization job fails        | `scene_id`, `preset`, `error_code`                                           | `error_message`                                                   | `analytics`      |
| `scene_published`              | Scene published to CDN        | `scene_id`                                                                   | `project_id`, `has_embed_domain_allowlist`, `has_custom_branding` | `analytics`      |
| `scene_unpublished`            | Scene publish revoked         | `scene_id`                                                                   | `project_id`                                                      | `analytics`      |
| `scene_deleted`                | Scene permanently deleted     | `scene_id`                                                                   | `project_id`                                                      | `analytics`      |
| `scene_settings_saved`         | Scene viewer settings updated | `scene_id`                                                                   | `changed_fields[]`                                                | `analytics`      |

---

### Embed & Preview

| Event name                       | Trigger                        | Required properties                             | Optional properties             | Consent required |
| -------------------------------- | ------------------------------ | ----------------------------------------------- | ------------------------------- | ---------------- |
| `embed_snippet_copied`           | User copies embed code         | `scene_id`, `embed_type` (iframe\|script\|link) | —                               | `analytics`      |
| `embed_domain_allowlist_updated` | Domain allowlist saved         | `scene_id`, `domain_count`                      | —                               | `analytics`      |
| `preview_viewed`                 | Published scene preview loaded | `scene_id`                                      | `referrer_domain`, `embed_type` | `analytics`      |
| `preview_ar_entered`             | User enters AR/WebXR mode      | `scene_id`                                      | `device_type`                   | `analytics`      |

---

### Projects & Organisation

| Event name           | Trigger             | Required properties                   | Optional properties | Consent required |
| -------------------- | ------------------- | ------------------------------------- | ------------------- | ---------------- |
| `project_created`    | New project created | `project_id`                          | —                   | `analytics`      |
| `project_deleted`    | Project deleted     | `project_id`                          | —                   | `analytics`      |
| `folder_created`     | New folder created  | `folder_id`, `project_id`             | —                   | `analytics`      |
| `org_member_invited` | Team member invited | `org_id`, `invited_role`              | —                   | `analytics`      |
| `org_member_removed` | Team member removed | `org_id`                              | —                   | `analytics`      |
| `api_key_created`    | API key generated   | `org_id`, `key_scope` (personal\|org) | —                   | `analytics`      |
| `api_key_revoked`    | API key revoked     | `org_id`, `key_scope`                 | —                   | `analytics`      |

---

### Billing & Plan

| Event name                 | Trigger                             | Required properties                                                     | Optional properties                                            | Consent required |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| `view_pricing`             | Pricing page or upgrade page viewed | —                                                                       | `plan`, `source` (direct\|upgrade_modal\|limit_gate\|settings) | `analytics`      |
| `plan_upgrade_started`     | User initiates checkout             | `from_plan`, `to_plan`, `billing_period` (monthly\|annual)              | `trigger` (in_app_prompt\|settings\|limit_gate)                | `analytics`      |
| `plan_upgrade_completed`   | Checkout session succeeds           | `from_plan`, `to_plan`, `billing_period`                                | —                                                              | `analytics`      |
| `plan_downgrade_scheduled` | Downgrade confirmed by user         | `from_plan`, `to_plan`                                                  | —                                                              | `analytics`      |
| `plan_canceled`            | Subscription canceled               | `plan`, `reason_code`                                                   | `reason_text`                                                  | `analytics`      |
| `trial_started`            | Free trial activated                | `plan`, `trial_days`                                                    | `trigger`                                                      | `analytics`      |
| `trial_converted`          | Trial converted to paid             | `plan`, `billing_period`                                                | —                                                              | `analytics`      |
| `trial_expired`            | Trial ended without conversion      | `plan`                                                                  | —                                                              | `analytics`      |
| `limit_gate_shown`         | User hits a quota wall              | `limit_key`, `plan`                                                     | `action_attempted`                                             | `analytics`      |
| `upgrade_modal_open`       | Upgrade / upsell modal displayed    | `reason` (quota_exceeded\|feature_not_available\|plan_inactive), `plan` | `limit_key`, `action_attempted`                                | `analytics`      |

---

### Contact

| Event name                    | Trigger                                        | Required properties                                          | Optional properties                           | Consent required |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- | ---------------- |
| `contact_page_viewed`         | Contact page rendered                          | `source` (direct\|pricing_cta\|footer\|other)                | `is_authenticated`                            | `analytics`      |
| `contact_form_submit_started` | User submits contact form                      | `inquiry_type` (support\|sales\|partnership\|other)          | `is_authenticated`                            | `analytics`      |
| `contact_form_submitted`      | Contact form accepted and forwarded            | `inquiry_type`                                               | `delivery_channel`, `response_time_bucket_ms` | `analytics`      |
| `contact_form_submit_failed`  | Contact form submission failed                 | `failure_stage` (validation\|anti_bot\|rate_limit\|provider) | `inquiry_type`, `error_code`                  | `analytics`      |
| `contact_form_blocked`        | Contact request blocked by anti-abuse controls | `block_reason` (honeypot\|rate_limit\|captcha_invalid)       | `inquiry_type`                                | `analytics`      |

---

### Consent

| Event name                  | Trigger                    | Required properties                               | Optional properties | Consent required |
| --------------------------- | -------------------------- | ------------------------------------------------- | ------------------- | ---------------- |
| `consent_banner_shown`      | Cookie banner displayed    | `version`, `jurisdiction`                         | —                   | `necessary`      |
| `consent_accepted_all`      | User clicks "Accept all"   | `version`                                         | —                   | `necessary`      |
| `consent_rejected_all`      | User clicks "Reject all"   | `version`                                         | —                   | `necessary`      |
| `consent_preferences_saved` | Granular preferences saved | `version`, `analytics`, `marketing`, `functional` | —                   | `necessary`      |

---

## Event Routing

| Destination                 | Events routed                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **PostHog** (analytics)     | All events where `Consent required` = `analytics` and user has granted `analytics` consent |
| **Internal data warehouse** | All events (regardless of consent, for internal product analytics only; PII stripped)      |
| **Marketing platform**      | Events tagged `marketing` where user has granted `marketing` consent                       |

---

## Naming Governance

- New events must be added to this document **before** being emitted in code.
- Event names are **immutable** once shipped. To rename, deprecate the old name and add a new one.
- Deprecated events are marked with `[DEPRECATED]` and removed after a 60-day migration window.

---

## Open Questions

- [ ] Confirm data warehouse target (BigQuery vs. ClickHouse).
- [ ] Define marketing platform once selected.
- [ ] Decide whether `preview_viewed` should fire for unauthenticated viewers (embed context).
- [ ] Add A/B experiment exposure events once experimentation framework is chosen.
