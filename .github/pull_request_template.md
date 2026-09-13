## Summary

<!-- One or two sentences describing what this PR does and why. -->

Closes #<!-- issue number -->

## Root cause

<!--
  Required for any change to product code. One sentence: what is broken, where
  the rule governing it lives, and why the fix belongs there rather than at the
  call site. If it will not fit in a sentence, investigate further before
  editing. If the fix adds a check rather than removing a cause, go one level
  deeper. For docs, tooling or a pure addition, write "n/a" and why.
-->

## Work items

<!--
  The Notion Vectreal Work Items rows this PR moves, copied from the plan's
  Work items table and filled in with the final state. Status after merge is
  Shipped for a row the diff implements, In review while the PR is open.
  Rows filed rather than fixed go here too, so review reads rows and diff
  together. Write "none" when no catalogue row matches.
-->

| Row | Before | After merge |
| --- | --- | --- |
| [name](https://app.notion.com/...) | Not started | Shipped |

## Changes

<!-- Bullet list of the key changes made. -->

- 

## Type of Change

- [ ] Bug fix (non-breaking, fixes an issue)
- [ ] New feature (non-breaking, adds functionality)
- [ ] Breaking change (existing functionality changes)
- [ ] Documentation update
- [ ] Refactor / chore (no functional change)

## Testing

<!-- Describe how you tested this change. -->

- [ ] Unit / integration tests added or updated
- [ ] Tested manually in the browser
- [ ] Storybook story added/updated (for `@vctrl/viewer` changes)
- [ ] No tests required (explain why)

## Checklist

- [ ] My commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [ ] `pnpm nx affected --target=lint` passes
- [ ] `pnpm nx affected --target=typecheck` passes
- [ ] `pnpm nx affected --target=test` passes
- [ ] I updated documentation where needed
- [ ] I linked the related issue above
