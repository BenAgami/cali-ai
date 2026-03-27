---
name: commit
description: Stage changes and write a conventional commit (type(scope): subject + body). Use when the user wants to commit, says "commit this", "make a commit", or asks for a commit message.
argument-hint: "[optional hint or context]"
---

Inspect the working tree, craft a conventional commit message with a descriptive body, and commit.

## Steps

1. **Read the diff** — run these in parallel:
   - `git status` (untracked files)
   - `git diff HEAD` (all changes, staged and unstaged)
   - `git log --oneline -5` (recent commits for style reference)

2. **Stage intelligently** — stage all relevant changes. Prefer `git add <specific files>` over `git add -A`. Never stage `.env`, secrets, or large binaries unless explicitly asked.

3. **Write the commit message** using the Conventional Commits format:

   ```
   type(scope): short imperative subject (≤72 chars)

   Body explaining WHY, not just what. Wrap at 72 chars.
   Reference issues or decisions where relevant.
   ```

   **Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`

   **Subject rules:**
   - Imperative mood: "add X", not "added X" or "adds X"
   - No period at the end
   - Lowercase after the colon

   **Body rules:**
   - Separate from subject with a blank line
   - Explain motivation and context, not the diff itself
   - Keep lines ≤72 chars

4. **Commit** using a HEREDOC to preserve formatting:
   ```bash
   git commit -m "$(cat <<'EOF'
   type(scope): subject

   Body here.
EOF
)"
   ```

5. **Verify** with `git status` — confirm the commit landed cleanly.

## Safety rules (always apply)

- Never use `--no-verify` or skip hooks. If a hook fails, fix the issue and create a new commit — never amend to work around it.
- Never force-push or use `--amend` unless the user explicitly asks.
- Never commit to `main`/`master` without explicit user confirmation.
- If there is nothing to commit, say so clearly instead of creating an empty commit.

## Examples

**Example 1 — new feature:**
```
feat(auth): add JWT refresh token rotation

Tokens now rotate on each use to limit the blast radius of a stolen
token. The old token is immediately invalidated server-side so
concurrent requests within the grace period still succeed.
```

**Example 2 — bug fix:**
```
fix(queue): prevent PROCESSING jobs from hanging indefinitely

Jobs stuck in PROCESSING for >10 min are now auto-failed by a
scheduled worker. Addresses the edge case where the worker process
crashed mid-job and left no tombstone.
```

**Example 3 — chore:**
```
chore(deps): upgrade Prisma to 7.1.2

Picks up the fix for the N+1 query regression introduced in 7.1.0
that was causing slow list queries on WorkoutSession.
```
