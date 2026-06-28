# Product Overview

_Single source of truth for platform description, open-source packages, supported file formats, and key feature claims used in marketing, SEO, GEO, and documentation._

---

## What Vectreal Is

Vectreal is a web platform for uploading, optimizing, and publishing 3D models as embeddable scenes. It provides a self-contained workflow — from raw file to hosted, embeddable 3D experience — without requiring a WebGL framework or build pipeline on the consumer side.

**Primary use cases**
- Product visualization on e-commerce and marketing pages
- Portfolio and concept presentation
- Augmented reality previews (iOS USDZ / Android WebXR)
- Developer integration via REST API or open-source SDKs

---

## Open-Source Packages

All four packages are part of this monorepo and published to npm under the `@vctrl` scope. Every claim made in marketing copy, SEO/GEO content, or documentation must match the actual package API.

| Package | npm | Description |
|---------|-----|-------------|
| `@vctrl/viewer` | [`@vctrl/viewer`](https://www.npmjs.com/package/@vctrl/viewer) | Ready-to-use React component for rendering 3D models. Built on Three.js and React Three Fiber. |
| `@vctrl/hooks` | [`@vctrl/hooks`](https://www.npmjs.com/package/@vctrl/hooks) | Browser-side React hooks for loading, optimizing, and exporting 3D models. |
| `@vctrl/core` | [`@vctrl/core`](https://www.npmjs.com/package/@vctrl/core) | Isomorphic 3D model processing for Node.js and browser/Web Worker environments. |
| `@vctrl/embed` | [`@vctrl/embed`](https://www.npmjs.com/package/@vctrl/embed) | Framework-agnostic JavaScript SDK for controlling Vectreal embedded 3D scenes from any web page. Includes CDN UMD build. |

---

## Supported Upload Formats

The canonical list is enforced by `shared/components/src/hooks/use-accept-pattern.ts` and `packages/core/src/model-loader/model-loader.ts`. **Do not claim support for formats not listed here.**

| Format | Extension(s) | Notes |
|--------|-------------|-------|
| glTF Binary | `.glb` | Recommended upload format. Single-file bundle. |
| glTF JSON | `.gltf` + `.bin` + textures | Multi-file upload; all referenced assets must be included in the same upload batch. |
| USDZ | `.usdz` | Apple AR QuickLook format. Primarily used for AR mode delivery. |
| USDA | `.usda` | USD ASCII format. Basic support. |

**Not supported:** FBX, OBJ, STL, PLY, DAE, 3DS, or any other format not listed above.

> **Known inconsistency (open):** The home page FAQ and "How It Works" step card currently claim FBX, OBJ, and STL support. These claims are incorrect and must be corrected to match this list.

---

## Key Features

Derived from `prd/03-entitlements.md`. Use this list when writing marketing copy or populating SEO/GEO schema fields. Do not invent features not present in the entitlement matrix.

- Upload GLB, glTF (with assets), USDZ, and USDA 3D models
- Automated 3D model optimization with Draco compression (low / medium / high presets)
- Embeddable 3D viewer via iframe — no framework dependency on the embedding page
- Scene version history
- Viewer customization: colors, lighting, camera presets, AR button, branding removal
- Per-embed analytics (load counts, interaction events)
- AR mode: iOS (USDZ via Quick Look), Android (WebXR)
- Domain allowlist for embed security
- REST API with API key authentication for scene management and publishing
- Team collaboration with role-based access (admin / editor / viewer)
- Priority optimization queue
- EU data residency
- SAML/OIDC single sign-on (SSO)
- Audit log export

---

## Platform Description Strings

These are the canonical human-readable strings to use in meta tags, JSON-LD schema, and llms.txt. Change them here first, then update `app/constants/product-copy.ts` to match.

**Tagline (≤ 160 chars, for meta description):**
> Web platform for uploading, optimizing, and publishing 3D models as embeddable scenes.

**Short description (≤ 40 words, for AI "what is X" answers):**
> Vectreal lets developers and teams upload 3D models, run automated optimization pipelines, compose scenes, and publish them as embeddable iframes or via REST API. The viewer requires no WebGL framework on the embedding page.

**Social / OG description:**
> Vectreal is your platform for creating, sharing, and exploring 3D scenes. Upload, optimize, and publish 3D content in seconds.

---

## Open Questions

- [ ] Confirm whether FBX/OBJ/STL conversion is planned (server-side). Until confirmed, remove all existing claims.
- [ ] Define canonical list of supported texture formats for multi-file glTF uploads.
- [ ] Confirm whether USDA support is production-ready or experimental.
