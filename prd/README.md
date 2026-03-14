# Vectreal Platform — Product Contracts & Policies

This directory is the **single source of truth** for all productization decisions: plans, limits, entitlements, billing states, consent categories, and the analytics event taxonomy.

Every decision that touches monetisation, access control, or data collection **must** be reflected here first and then implemented in code.

---

## Document Index

| # | Document | What it defines |
|---|----------|-----------------|
| 1 | [Plans & Tiers](./01-plans-and-tiers.md) | Plan names, target audiences, pricing anchors, and upgrade/downgrade rules |
| 2 | [Limits & Quotas](./02-limits-and-quotas.md) | Hard and soft resource limits per plan (storage, scenes, API calls, …) |
| 3 | [Entitlements](./03-entitlements.md) | Feature flags and capability matrix keyed by plan |
| 4 | [Billing States](./04-billing-states.md) | Subscription lifecycle states and allowed transitions |
| 5 | [Consent Categories](./05-consent-categories.md) | Cookie / data-processing consent taxonomy and enforcement rules |
| 6 | [Analytics Event Taxonomy](./06-analytics-event-taxonomy.md) | Canonical event names, required properties, and routing rules |

---

## How to Use This Directory

### Reading the contracts
Each document is self-contained. Start with the document that is relevant to the work you are about to do. Cross-references between documents are explicit (e.g., a billing state may gate an entitlement).

### Updating the contracts
1. Open a PR that edits the relevant document(s) **and** the corresponding implementation (documentation first, implementation in subsequent commits of the same PR).
2. Tag the PR with the `productization` label.
3. Get sign-off from at least one product owner before merging.

### Enforcing the contracts in code
- Plan identifiers used in this directory are the **canonical** string values to use in database columns, API responses, and feature-flag checks.
- Limit values are expressed as plain numbers (no units embedded in the identifier). Unit of measure is defined once per row in [Limits & Quotas](./02-limits-and-quotas.md).
- Billing state identifiers match the values returned by the billing provider webhook.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Plan** | A named tier that a user or organization subscribes to |
| **Quota** | A hard numeric ceiling enforced by the platform |
| **Soft limit** | A threshold that triggers a warning but does not block the action |
| **Hard limit** | A threshold that blocks the action when exceeded |
| **Entitlement** | A boolean capability granted by a plan |
| **Billing state** | The current lifecycle state of a subscription |
| **Consent category** | A named bucket of data-processing activities requiring user consent |
| **Event** | A discrete, named analytics signal emitted by the platform |
