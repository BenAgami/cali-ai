---
name: visualize
description: Turns your previous answer in this conversation into a polished visual web page and publishes it as a private artifact. Run only when the user explicitly types /visualize, optionally with an argument that narrows the scope or adds instructions.
disable-model-invocation: true
argument-hint: "[scope or instructions, e.g. only the bugs]"
---

# /visualize

Turn **your previous answer** in this conversation into a polished web page,
publish it as a private artifact, and reply with one sentence and the link.

Argument: `$ARGUMENTS`

If an argument is given, it narrows the scope or adds instructions (for example
`only the bugs` or `as a comparison table`). Follow it. With no argument,
visualize the whole previous answer.

## Content rules

- The source is your previous answer, and only that. Keep all of its content in
  scope: every item, file:line reference, caveat, open question and decision
  point.
- Don't invent anything that wasn't in the answer: no new findings, numbers,
  dates, owners or recommendations. Rewording for brevity is fine; adding facts
  is not.
- If the answer said something was unverified, uncertain or skipped, the page
  says so too, in the notice (see below).

## Pick a layout from the shape of the answer

Adapt the layout to the content. Don't force everything into cards.

| Answer shape                        | Layout                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| List of findings, issues or tasks   | The **board** layout below.                                                                                     |
| Comparison of options               | Side-by-side table or columns, one per option, with the recommended option highlighted (accent border + label). |
| Explanation or step-by-step         | Numbered timeline or sections, code in styled blocks.                                                           |
| Numbers (counts, timings, sizes, $) | Summary tiles plus a simple chart drawn with inline SVG (no chart library).                                     |
| Mixed                               | Combine: e.g. tiles + chart on top, then a board or timeline below.                                             |

## Shared design rules (every layout)

**Header**

- An eyebrow line in mono with real context, e.g.
  `branch → main · 226 files · /code-review high`. Use only facts you know.
- A short title (a noun phrase) and a one-line lede that says what the page
  holds and what to do first.
- A highlighted notice (amber-tinted box, bold amber lead word) for caveats such
  as "Not verified yet." Omit it when there are no caveats.

**Type and colour**

- Instrument Sans for text, JetBrains Mono for code, paths and the eyebrow
  (Google Fonts, with system fallbacks: `"Segoe UI", system-ui, sans-serif` and
  `Consolas, monospace`).
- A cool slate palette: light background `#f4f6f8`, white surfaces, ink
  `#17202b`, muted `#5d6b7a`, lines `#dde3ea`.
- One blue accent (`#1f6feb`, soft `#e3edfd`) for links, paths, active chips,
  focus rings and decision callouts.
- Semantic red (critical), amber (warning), green (info/ok) and grey (low), each
  with a `-soft` tint. They are separate from the accent and carry meaning only.
- All colours are custom properties in `:root`.

**Themes and accessibility**

- A full light theme and a dark theme. Dark applies both under
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }`
  and under `:root[data-theme="dark"]`. Set `color-scheme` in each.
- Dark tokens: background `#0f141a`, surface `#171e26`, ink `#e6ebf1`, muted
  `#93a1b0`, lines `#2a3440`, accent `#6ea8ff`, and lighter semantic colours
  with dark soft tints.
- Visible `:focus-visible` outlines (2px accent, 2px offset) on every
  interactive element. Interactive things are real `<button>`/`<input>`
  elements.
- Works at phone width: max-width wrapper (~980px), wrapping flex rows, a
  `@media (max-width: 520px)` step that shrinks the title and lets card headers
  wrap. Respect `prefers-reduced-motion`.

**Code structure**

- Data lives in one JS array (plus a small groups/config array if needed) at the
  bottom of the page, rendered by small functions (`renderSummary`,
  `renderChips`, `renderGroups`, …).
- HTML-escape every piece of text from the data before inserting it
  (`&`, `<`, `>`, `"`).
- Any `localStorage` read or write is wrapped in `try/catch`. Use a storage key
  specific to this page.

## The board layout (findings, issues, tasks)

1. **Summary tiles** at the top, one per group, showing the count. Each tile is
   a button with a coloured top border (the group's semantic colour) that
   scrolls to its group.
2. **Sticky filter bar** with chips. Filter on a real dimension of the data
   (workspace, category, status, owner…), derived from the data, with an "All"
   chip. Active chip uses `aria-pressed="true"` and the accent fill. The bar
   also holds a "Hide done" toggle and an "x of n done" counter on the right.
3. **Grouped sections**, ordered by importance. Each has a heading, a count and
   a one-line description.
4. **Cards**, each with:
   - a coloured left severity stripe (the group colour),
   - a `#n` badge (mono, soft-tinted), numbered across the whole page,
   - a title,
   - file paths as mono pills (`path:line`, accent text on accent-soft),
   - the main text,
   - a dashed-top-border detail block with an uppercase label such as
     "What goes wrong",
   - an accent-tinted callout for anything that needs the user's decision,
   - a "Done" checkbox. Done state is saved in `localStorage`; done cards fade
     and strike through their title.
5. An empty state ("Nothing left in this view.") when filters hide everything,
   and a short footer saying ticks are kept in this browser only.

## Publishing steps

1. Call the claude-artifacts `guide` tool with topic `pages`, then with topic
   `design`, before writing. Follow those rules; where they conflict with this
   file on a technical requirement, theirs win.
2. Write the page as `index.html` in the session scratchpad directory. Never
   write it inside the repo.
3. Publish it with `publish_files` as a new artifact (omit `slug`), with a short
   noun-phrase `title` and a one-word `icon` (e.g. `checklist`, `chart`,
   `compare`, `steps`). If `publish_files` is unavailable, send the same HTML
   with `publish_version`.
4. Reply with only one sentence describing the page and the URL. Nothing else.
