# Sharing Permission Model (MVP)

## Purpose

This document locks the MVP authorization model for sharing across scene, folder, and project scopes.

Primary requirements:

- External iframe preview must render only when provided valid identifiers and a valid preview API key.
- External iframe preview must come from an allowed domain pattern configured on the project.
- External iframe preview must return not found for draft scenes.
- Draft scenes remain viewable by authenticated collaborators.
- MVP collaborator source is existing organization membership.

## Definitions

- **External embed principal**: Client using preview API key (`token` query param or `Authorization: Bearer`).
- **Authenticated collaborator principal**: Signed-in user with project access via organization membership.
- **Draft scene**: Scene whose status is not `published`.
- **Published scene**: Scene with status `published` and a published preview asset.
- **Allowed embed domain pattern**: Exact host (`example.com`) or leading wildcard subdomain (`*.example.com`).

## Scope Matrix (MVP)

| Scope   | Action                              | External embed principal (API key)                              | Authenticated collaborator principal                                          |
| ------- | ----------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Scene   | View preview aggregate              | Allowed only if scene is published and key is valid for project | Allowed for draft and published when user has project access                  |
| Scene   | Read scene settings in preview mode | Allowed only if scene is published and key is valid for project | Allowed for draft and published when user has project access                  |
| Scene   | Save / edit / publish / delete      | Not allowed                                                     | Allowed when user has project access (current repository enforcement)         |
| Folder  | View/list/manage                    | Not allowed in embed flow                                       | Allowed when user has project access                                          |
| Project | View/list/manage                    | Limited to project bound to API key for preview-only reads      | Allowed when user has org membership; role restrictions apply to some actions |

## Endpoint Enforcement (Cross-API)

### Preview route loader

File: [app/routes/layouts/preview-layout.tsx](app/routes/layouts/preview-layout.tsx)

- Requires both `projectId` and `sceneId` route params.
- If preview API key token is present:
  - Validate key for project via preview API key auth.
  - Load preview scene via published preview repository.
  - If scene is draft/unpublished or missing published preview asset: return not found.
- If token is absent:
  - Require authenticated session.
  - Require project membership access.
  - Allow draft and published scenes for authenticated collaborators.

### Preview API scene loader/action (`preview=1` mode)

File: [app/routes/api/scenes.$sceneId.ts](app/routes/api/scenes.$sceneId.ts)

- Requires `sceneId`, `projectId` query param for preview mode.
- Supports only read-style preview action (`get-scene-settings`) in preview mode.
- Auth mode resolution:
  - Token present => API key mode.
  - Token absent => authenticated session mode.
- API key mode:
  - Must resolve through published preview lookup.
  - Draft scenes return not found.
- Session mode:
  - Requires project membership via existing project/scene access checks.
  - Draft scenes are viewable for authenticated collaborators.

### Preview API key validation

File: [app/lib/domain/auth/preview-api-key-auth.server.ts](app/lib/domain/auth/preview-api-key-auth.server.ts)

- Token can come from `token` query param or Bearer header.
- Key must be active, not revoked, not expired.
- Key must be scoped to requested project.
- API key organization must match project organization.
- Request host policy in API-key mode:
  - Request host is derived from `Referer` first, then `Origin`.
  - Host is allowed if it matches configured project domain pattern.
  - Internal same-host calls (preview page to preview API) are allowed.
  - Missing headers are blocked except localhost-like development hosts.

## Data Access Rules (Repository Layer)

### Project domain policy storage

Files:

- [app/db/schema/project/projects.ts](app/db/schema/project/projects.ts)
- [app/routes/dashboard-page/projects/projects-edit.tsx](app/routes/dashboard-page/projects/projects-edit.tsx)

- Allowed embed domains are stored on the project as newline-separated patterns.
- Project settings validates input to exact host or leading wildcard host only.

### Published-only preview data

File: [app/lib/domain/scene/server/scene-preview-repository.server.ts](app/lib/domain/scene/server/scene-preview-repository.server.ts)

- Preview lookup returns data only if:
  - Scene belongs to project.
  - Scene has published asset row.
  - Scene status is `published`.

### Authenticated collaborator access

Files:

- [app/lib/domain/project/project-repository.server.ts](app/lib/domain/project/project-repository.server.ts)
- [app/lib/domain/scene/server/scene-folder-repository.server.ts](app/lib/domain/scene/server/scene-folder-repository.server.ts)

- Collaborator access is established through organization membership tied to project.
- Scene/folder/project reads and writes follow existing membership-based repository checks.

## UI Contract (Cross-UI)

### Embed UX constraints

Files:

- [app/components/publisher/sidebars/publish-sidebar/sections/embed-options.tsx](app/components/publisher/sidebars/publish-sidebar/sections/embed-options.tsx)
- [app/routes/dashboard-page/projects/scene.tsx](app/routes/dashboard-page/projects/scene.tsx)
- [app/lib/domain/embed/embed-snippet.ts](app/lib/domain/embed/embed-snippet.ts)

- Publisher and dashboard embed surfaces use one shared snippet builder.
- Canonical embed URL is `/preview/fullscreen/:projectId/:sceneId?token=YOUR_PREVIEW_API_KEY`.
- Canonical embed format is responsive wrapper markup containing an iframe.
- Embed snippets must communicate that external iframe access requires a preview API key.
- Embed snippets must communicate that draft scenes are not externally embeddable.

### Publish UX constraints

File: [app/components/publisher/sidebars/publish-sidebar/sections/publish-options.tsx](app/components/publisher/sidebars/publish-sidebar/sections/publish-options.tsx)

- Publish action is the transition from draft to externally embeddable state.

## Status Code Policy (MVP)

- Missing required identifiers: `400`.
- Rate limited token validation: `429`.
- Disallowed embed domain in API-key flow: `403`.
- Draft or non-existent scene in external/API-key preview flow: `404`.
- Session-authenticated collaborator without access: conceal with not found where applicable in scene-level reads.

## Locked MVP Decisions

- External iframe preview is API key gated.
- External iframe preview is published-only.
- Draft scenes are not externally embeddable and must return not found in API-key flow.
- Draft scenes remain viewable by authenticated collaborators.
- Collaborator set in MVP = existing organization members with project access.
- Allowed domains are configured per project.
- Allowed domain grammar is exact host + leading wildcard subdomain only.
- Missing `Referer`/`Origin` is blocked except localhost-like development hosts.
- Share deliverables are out of scope for MVP; embed deliverables are in scope.
