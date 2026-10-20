# @vctrl/cli

The Vectreal command line: sign in once, then let a terminal or an agent act for you in the organization you chose.

Private for now. Until it ships to npm, run it from the workspace root with pnpm's `-s`:

```bash
pnpm -s vectreal login
```

Without `-s`, pnpm prints its own banner to stdout before the CLI does, which breaks anything reading `--json` output.

## Commands

| Command | What it does |
| --- | --- |
| `vectreal login [--origin <url>] [--no-browser]` | Signs in through the browser and keeps the session in the OS keychain. Remembers the origin for later commands. |
| `vectreal whoami [--json]` | Shows the user, organization, role and scopes the session acts as. |
| `vectreal init [--project <id> \| --create <name>]` | Links the current directory to a project by writing `.vectreal/project.json`. |
| `vectreal logout` | Ends the session on the server and forgets it here. |

The origin is `--origin`, then `VECTREAL_ORIGIN`, then the last one signed in to, then `https://vectreal.com`. Plain http is allowed on localhost only.

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
