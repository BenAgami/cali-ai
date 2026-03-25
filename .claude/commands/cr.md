---
name: cr
description: Run a manual GitHub code review (CR) using the gh CLI. Use ONLY when the user explicitly asks for a code review, types /cr, or says something like "do a CR", "review my PR", "check PR status", "show me review feedback". Do NOT trigger automatically — this is intentionally manual and on-demand because CRs are expensive.
argument-hint: "[PR number or branch name — optional, defaults to current branch]"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Manual Code Review (CR)

Run a thorough code review for the current branch or a specified PR using `gh`.

## Goal

Give the user a clear picture of their PR's state: what's in it, CI status, reviewer feedback, and any blocking issues — all in one pass.

## Steps

### 1. Orient: branch + commits

```bash
git branch --show-current
git log main..HEAD --oneline
git diff main..HEAD --stat
```

If no commits ahead of main, tell the user and stop — there's nothing to review.

### 2. Find or create the PR

```bash
gh pr view --json number,title,state,url,baseRefName,headRefName,isDraft,reviewDecision,mergeable
```

- If no PR exists yet, ask the user if they'd like to create one before continuing.
  - If yes: `gh pr create --draft --fill` then proceed.
  - If no: stop here.

### 3. CI checks

```bash
gh pr checks
```

Summarize pass/fail/pending. Flag any failures prominently — the user needs to know before they can merge.

### 4. Review comments and decisions

```bash
gh pr view --comments
gh pr review list 2>/dev/null || gh api repos/:owner/:repo/pulls/{PR_NUMBER}/reviews 2>/dev/null
```

Summarize:
- Overall review decision (approved / changes requested / pending)
- Any inline or general comments — group by reviewer, highlight actionable ones
- Unresolved threads if any

### 5. Diff summary

```bash
gh pr diff
```

Give a brief summary of what changed (files touched, rough scope). Don't narrate every line — focus on what a reviewer would flag: large changes, risky areas, missing tests.

### 6. Report

Present a concise CR report:

```
## CR: <PR title> (#<number>)
**Branch:** <head> → <base>
**State:** <open/draft/merged> | **Mergeable:** <yes/no/conflicts>

### Commits (<N>)
- <one-liner per commit>

### CI
<pass/fail summary>

### Review Status
<decision> — <reviewer names and their verdicts>
<key comments or "No review comments yet">

### Diff Summary
<files changed, rough scope, anything noteworthy>

### Blockers
<list any merge blockers: failing CI, requested changes, conflicts — or "None">
```

Keep it scannable. The user can drill into details themselves with `gh pr view` or the URL.

## Notes

- If the user passes a PR number as an argument (e.g., `/cr 42`), use `gh pr view 42` instead of the current branch.
- If the user passes a branch name, use `gh pr view --head <branch>`.
- Don't push, merge, or request reviews unless the user explicitly asks.
