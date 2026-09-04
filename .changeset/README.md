# Changesets

Release flow:

1. With every user-facing change, run `pnpm changeset` and describe it.
2. To cut a release: `pnpm changeset version` (bumps versions, updates package changelogs), commit, then `pnpm release`.
