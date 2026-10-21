---
name: publish-a-3d-model
description: Put a 3D model (a GLB file) on a website with Vectreal - upload it as a scene, adjust its look, publish it compressed, and add the embed snippet to a page. Use when the user wants a 3D model, product viewer or GLB shown on their site.
---

# Publish a 3D model with Vectreal

The `vectreal` MCP server's tools do the work. Run them in this order.

1. **Check the session.** Call `whoami`. If it says no one is signed in, ask the user to run `npx -y @vctrl/cli login` in a terminal and approve it in the browser, then try again. Check that the granted scopes cover what you are about to do: uploading needs `projects:write`, publishing `scenes:publish`, and the embed `embed:manage`.
2. **Pick the project.** Use `list_projects`, or `create_project` when the user wants a new one. Tools that take `projectId` fall back to the project `vectreal init` linked in the user's directory.
3. **Look at the model.** Call `describe_model` with the GLB's path, to learn its size, its parts and their materials, and whether it has animation clips. Mention anything unusual, such as a model hundreds of units tall or one with no materials.
4. **Upload it.** `create_scene_from_file` with the path makes a draft scene. Only GLB files work; ask the user to convert other formats first, for example in the Vectreal publisher.
5. **Adjust the look, if asked.** Read the settings with `get_scene_settings`, change the section you need, and send that whole section back with `update_scene_settings`. Only environment, controls, bounds, shadows and presentation can be changed this way.
6. **Publish.** `publish_scene` with the same file compresses it (Draco geometry, KTX2 textures) and publishes it. Tell the user the size before and after.
7. **Embed.** `get_embed_snippet` with the scene and the domains the page is served from returns the iframe snippet. Add it to the page the user named.

## Good to know

- A scene made this way has no thumbnail or baked shadow until the user opens it once in the Vectreal publisher, which fills both. Suggest they do.
- Nothing here deletes. To remove a scene, the user does it in the dashboard; `unpublish_scene` only takes it offline.
- When a call is refused for a scope, name the scope and ask the user to sign in again with `npx -y @vctrl/cli login` and approve it.
- `search_docs` and `read_doc` answer questions about Vectreal without signing in.
