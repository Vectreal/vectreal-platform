# Enforcement

Owner of: the rules a machine already checks, and how to verify a design change.

These are errors, not warnings: `eslint.config.mts` fails the build on every rule
below. Read the failure message rather than guessing — each rule carries a
comment in its own config naming the failure it prevents.

## ESLint (`eslint.config.mts`, the `no-restricted-syntax` block)

Scoped to `apps/**` and `shared/**`, with exemptions for email templates,
`*.stories.tsx`, specs, and `**/assets/icons/**`.

1. **Tailwind variants on `ds-*` or `text-*` classes.** They live in
   `@layer components` and are not registered utilities, so a variant attaches to
   nothing and Tailwind emits no rule at all. It fails silently. Use an arbitrary
   utility instead.
2. **Raw hex in a Tailwind arbitrary value.** Use a token. Where a literal is
   genuinely correct, such as depicting someone else's interface, hoist it to a
   named constant with a comment saying why.
3. **`className` built by template literal or `+`.** Use `cn()`. It merges
   conflicting Tailwind classes so a caller can override a default, and drops
   falsy values instead of rendering `undefined` as a class. Pass the parts as
   separate arguments; pre-joining them inside `cn()` defeats it, and that has
   its own rule.
4. **Inline `<svg>`.** Extract to `shared/components/src/assets/icons` as a named
   component. A component that exists to draw a graphic rather than an icon
   disables the rule on the line with a reason.
5. **A z-index at or above 50, and every escape hatch below it.** 50 is where the
   site nav and Radix's portal layer live, in the root stacking context, so a
   number there is competing with them and needs a tier name. Tailwind v4 spells
   the escape hatch three ways and all three are rejected: the bracket, the `z-`
   custom-property shorthand in parentheses, and a leading `!`. This is the rule
   the route loading bar needed: it and the header were both fixed to the top of
   the viewport at 50, nothing recorded that they overlapped, and DOM order
   decided the bar painted underneath, on every navigation.

`eslint-house-rules.spec.ts` lints real snippets through the repo's own config in
both directions, and asserts every in-scope file gets the full rule set or none —
catching the flat-config option-replacement bug that once silently disabled the
design rules for every route module.

## Specs that guard design

| Spec | Guards |
| --- | --- |
| `type-scale-adherence.spec.ts` | Overlay titles sit on a rung, on the *same* rung; no hand-rolled font size; the scale defines every rung it claims to; no rung reached through a variant |
| `z-index-tiers.spec.ts` | `--z-index-*` in the stylesheet equals `Z_INDEX_TIERS` in `styling.utils.ts`, and tailwind-merge resolves tiers against bare numbers both ways |
| `container-scale.spec.ts` | The same two-file agreement for `--container-*` vs `CONTAINER_SCALE` |
| `tooltip-copy-length.spec.ts` | Every tooltip string literal in `app/` is at most 140 characters |
| `documented-claims.spec.ts` | Executes the `claims` blocks in every skill and in the registered docs |
| `eslint-house-rules.spec.ts` | The rules above actually fire, and survive config resolution |

## Claims blocks

Every `SKILL.md` is globbed automatically and must declare at least one claim; a
skill whose block was deleted would otherwise pass by asserting nothing. Files
under `references/` are **not** globbed — they carry enforcement only once added
to `CLAIM_CARRYING_DOCS` in `documented-claims.spec.ts`, and every entry there is
held to the same at-least-one-claim rule. A reference with nothing mechanically
checkable stays out of the array rather than being given filler.

Grammar, one per line, paths relative to the repo root, literals matched
verbatim:

```
exists   <path>
present  <path>  <literal>
absent   <path>  <literal>
```

The `absent` form is the one that earns its keep: it fails the day someone
reintroduces the thing the rule exists to prevent.

## Tailwind scans more than markup

`globals.css` declares `@source '../../../../'`, the repository root, so any
string that looks like a utility is compiled into the bundle whether or not it
was ever meant to render.

Specs, config files and markdown are excluded, so prose in this file and in a
README costs nothing. Comments and strings inside `.ts` and `.tsx` are still
scanned, and cannot be excluded, because those files also hold the real markup.
A JSDoc example, a commented-out block of JSX, and plain English both ways: the
word "ordinal" in a sentence about clip ids compiles to Tailwind's `ordinal`
utility. Roughly fifteen rules in the bundle today come from comments alone.

So the rule survives where it still bites: do not name a utility in a code
comment unless the file actually uses it.

Note also that `.claude/skills/` symlinks to `.agents/skills/`, so a skill file
is walked under both paths and an exclusion naming only one of them removes
nothing.

## Verify in a browser, not in your head

Design changes close with a screenshot, not a claim. Use the preview tools:
`preview_start` with `{name: "vectreal-platform"}`, then `read_page`,
`resize_window` for responsive and both themes, and `computer` for a screenshot.
The quality bar for marketing UI is high, and the only way to know a gradient, a
hover step or a snap point survived is to look at it.

Check both themes. Only `/` and `/home` are force-dark; every other marketing
surface renders light and dark, so a shared component changed for one is
unverified until seen in the other.

```claims
present  eslint.config.mts                                                     Use a tier from globals.css (z-page-chrome
present  eslint.config.mts                                                     Build className with cn()
present  eslint.config.mts                                                     Inline SVG
present  shared/components/src/styles/globals.css                              @source '../../../../'
present  shared/components/src/styles/globals.css                              @source not '../../../../**/*.md'
present  shared/utils/src/lib/styling.utils.ts                                 extendTailwindMerge
exists   apps/vectreal-platform/tests/documented-claims.spec.ts
exists   apps/vectreal-platform/tests/eslint-house-rules.spec.ts
exists   apps/vectreal-platform/tests/z-index-tiers.spec.ts
exists   apps/vectreal-platform/tests/container-scale.spec.ts
```
