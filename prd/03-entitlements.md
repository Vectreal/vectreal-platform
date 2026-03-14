# Entitlements

_Feature capability matrix keyed by plan. An entitlement is a boolean grant — a feature is either available (`✓`) or not (`✗`) for a given plan._

---

## Entitlement Keys

Each row defines a canonical **entitlement key** used in feature-flag checks, API guards, and UI gating.

### Core Publishing

| Entitlement key | Description | `free` | `pro` | `business` | `enterprise` |
|-----------------|-------------|--------|-------|------------|-------------|
| `scene_upload` | Upload 3D scenes | ✓ | ✓ | ✓ | ✓ |
| `scene_optimize` | Run optimization pipeline | ✓ | ✓ | ✓ | ✓ |
| `scene_publish` | Publish scene to CDN | ✓ | ✓ | ✓ | ✓ |
| `scene_embed` | Generate embed snippet | ✓ | ✓ | ✓ | ✓ |
| `scene_preview_private` | Share private preview link | ✗ | ✓ | ✓ | ✓ |
| `scene_version_history` | Access version history | ✗ | ✓ | ✓ | ✓ |

### Optimization

| Entitlement key | Description | `free` | `pro` | `business` | `enterprise` |
|-----------------|-------------|--------|-------|------------|-------------|
| `optimization_preset_low` | Apply low-quality optimization preset | ✓ | ✓ | ✓ | ✓ |
| `optimization_preset_medium` | Apply medium-quality preset | ✓ | ✓ | ✓ | ✓ |
| `optimization_preset_high` | Apply high-quality preset | ✗ | ✓ | ✓ | ✓ |
| `optimization_custom_params` | Override individual optimization parameters | ✗ | ✓ | ✓ | ✓ |
| `optimization_priority_queue` | Skip to front of optimization queue | ✗ | ✗ | ✓ | ✓ |

### Embed & Viewer

| Entitlement key | Description | `free` | `pro` | `business` | `enterprise` |
|-----------------|-------------|--------|-------|------------|-------------|
| `embed_domain_allowlist` | Restrict embed to specific domains | ✗ | ✓ | ✓ | ✓ |
| `embed_branding_removal` | Remove Vectreal watermark from embed | ✗ | ✓ | ✓ | ✓ |
| `embed_viewer_customisation` | Customise viewer colours and UI | ✗ | ✓ | ✓ | ✓ |
| `embed_analytics` | View per-embed analytics | ✗ | ✓ | ✓ | ✓ |
| `embed_ar_mode` | Enable AR / WebXR mode in embed | ✗ | ✓ | ✓ | ✓ |

### Organisation & Collaboration

| Entitlement key | Description | `free` | `pro` | `business` | `enterprise` |
|-----------------|-------------|--------|-------|------------|-------------|
| `org_multi_member` | Invite team members to organisation | ✗ | ✗ | ✓ | ✓ |
| `org_roles` | Assign member roles (admin / editor / viewer) | ✗ | ✗ | ✓ | ✓ |
| `org_api_keys` | Create organisation-scoped API keys | ✗ | ✓ | ✓ | ✓ |
| `org_sso` | SAML/OIDC single sign-on | ✗ | ✗ | ✗ | ✓ |
| `org_audit_log` | Export audit log | ✗ | ✗ | ✗ | ✓ |

### Data & Compliance

| Entitlement key | Description | `free` | `pro` | `business` | `enterprise` |
|-----------------|-------------|--------|-------|------------|-------------|
| `data_export` | Bulk export all scenes and metadata | ✗ | ✓ | ✓ | ✓ |
| `data_residency_eu` | Pin data storage to EU region | ✗ | ✗ | ✓ | ✓ |
| `data_residency_custom` | Custom data-residency region | ✗ | ✗ | ✗ | ✓ |

### Support

| Entitlement key | Description | `free` | `pro` | `business` | `enterprise` |
|-----------------|-------------|--------|-------|------------|-------------|
| `support_community` | Community forum and Discord | ✓ | ✓ | ✓ | ✓ |
| `support_email` | Email support (48 h SLA) | ✗ | ✓ | ✓ | ✓ |
| `support_priority` | Priority support (8 h SLA) | ✗ | ✗ | ✓ | ✓ |
| `support_dedicated` | Dedicated support channel (custom SLA) | ✗ | ✗ | ✗ | ✓ |

---

## Entitlement Resolution Logic

```
hasEntitlement(orgId, entitlementKey):
  1. Resolve org's current plan (considering billing state)
  2. If billing state blocks access → return false  (see Billing States doc)
  3. Look up entitlement key in plan_entitlements map
  4. Check for org-level overrides (enterprise add-ons) → merge
  5. Return resolved boolean
```

---

## Billing-State Interaction

Some billing states restrict entitlements even if the plan would normally grant them. See [Billing States](./04-billing-states.md) for the authoritative state-to-access mapping.

---

## Open Questions

- [ ] Confirm whether `embed_branding_removal` should also be available on annual `free` plan.
- [ ] Define granularity for `org_roles` — is viewer-only a paid seat?
- [ ] Decide if `embed_ar_mode` requires a separate add-on or is bundled with `pro`.
