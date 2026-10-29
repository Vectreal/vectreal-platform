# @vctrl/cli

The Vectreal command line: sign in once, then let a terminal or an agent act for you in the organization you chose.

Run it with `npx`, or install it globally to get the `vectreal` command:

```bash
npx -y @vctrl/cli login
```

```bash
npm install -g @vctrl/cli
```

Setup for Claude Code, Cursor and VS Code is in the [agents docs](https://vectreal.com/docs/agents).

## Commands

| Command | What it does |
| --- | --- |
| `vectreal login [--origin <url>] [--no-browser]` | Signs in through the browser and keeps the session in the OS keychain. Remembers the origin for later commands. |
| `vectreal whoami [--json]` | Shows the user, organization, role and scopes the session acts as. |
| `vectreal init [--project <id> \| --create <name>]` | Links the current directory to a project by writing `.vectreal/project.json`. |
| `vectreal logout` | Ends the session on the server and forgets it here. |
| `vectreal mcp` | Serves the Vectreal tools to an agent over stdio (MCP) until the agent closes the stream. |
| `vectreal mcp install [--origin <url>]` | Registers that server in the current directory's `.mcp.json`, launched the way this CLI was. |

The origin is `--origin`, then `VECTREAL_ORIGIN`, then the last one signed in to, then `https://vectreal.com`. Plain http is allowed on localhost only.

## The MCP server

`vectreal mcp` gives an agent these tools:

| Tool | Does |
| --- | --- |
| `search_docs`, `read_doc` | Search and read the Vectreal docs. No sign-in needed. |
| `whoami`, `list_projects`, `create_project`, `list_scenes` | Who the session is, and the organization's projects and scenes. |
| `create_scene_from_file` | Uploads a local GLB as a draft scene, as it is. |
| `describe_model` | A local GLB's size, meshes, materials and animation clips, and where the viewer places it, without rendering it. |
| `get_scene_settings`, `update_scene_settings` | Read every settings section; change environment, controls, bounds, shadows and presentation. |
| `publish_scene`, `unpublish_scene` | Compress a local GLB as the publisher does (Draco, KTX2) and publish it; take a scene offline. |
| `get_embed_snippet` | The snippet and preview URL for a published scene, creating an embed key and allowing domains when asked. |

Tools that take `projectId` default to the project `vectreal init` linked. The server finds that project in `CLAUDE_PROJECT_DIR` when the agent sets it, else in the directory it was started from. It signs in with the stored session, so run `vectreal login` first; a tool called without one says so.

To register it with Claude Code, run this in the project directory:

```bash
claude mcp add vectreal -- npx -y @vctrl/cli mcp
```

Or let the CLI write the entry into the current directory's `.mcp.json`:

```bash
npx -y @vctrl/cli mcp install
```

Run from `npx`, the entry it writes is `npx -y @vctrl/cli mcp`, so `.mcp.json` can be committed. Run from a checkout of this repository, it names paths on that machine instead.

The server is also listed in the MCP Registry as `io.github.Vectreal/vectreal`.

## Output and exit codes

Results go to stdout, as JSON with `--json`. Everything else goes to stderr.

| Code | Meaning |
| --- | --- |
| 0 | Done |
| 1 | Failed |
| 2 | Wrong usage |
| 3 | Not signed in, or the server no longer accepts the session: run `vectreal login` |

## Where the session is kept

In the OS keychain (macOS Keychain, Windows Credential Manager, Secret Service on Linux), one entry per origin. Where the keychain cannot be used, as on a headless Linux box with no Secret Service, the session goes to `$XDG_CONFIG_HOME/vectreal/credentials.json` (default `~/.config/vectreal`) instead, and each command that does so says it on stderr. On macOS and Linux that file is readable only by you; on Windows it relies on your profile folder's permissions.

## Signing in against a local stack

Register the CLI's OAuth client on the local Supabase stack once, then point the CLI at the dev server:

```bash
pnpm nx run vectreal-platform:supabase-register-cli-client
```

```bash
pnpm -s vectreal login --origin http://localhost:4200
```

From a checkout, use pnpm's `-s`: without it, pnpm prints its own banner to stdout before the CLI does, which breaks anything reading `--json` output.
