# Claude Code session setup

`hooks/session-start.sh` runs once at the start of every Claude Code on the web
session, registered through `settings.json`. It does two things:

**npm dependencies.** Runs `npm install`, so express, socket.io, qrcode and
jimp are present and `npm start` works. A web session starts from an empty
container with no `node_modules`.

**Skills.** Installs the skill set this project is worked on with, globally
into `~/.claude/skills` rather than committed here - the container is fresh
each session, so this costs a ~26s download instead of megabytes of vendored
files in git history.

This project is thirteen HTML pages of customer and admin UI with no build
step, so the design skills carry most of the weight: `ui-ux-pro-max` (colour
palettes, font pairings, UX guidelines) and `impeccable` (design critique and
anti-pattern detection). The rest is the superpowers development chain plus
code-exploration skills.

Local sessions exit immediately (`CLAUDE_CODE_REMOTE` guard) - a developer's
own machine has its own global skills and its own `node_modules`.

## Changing the skill list

Edit the `npx skills add` lines in the hook. `npx skills find <query>` searches
for more; `npx skills remove -g -s <name>` drops one from the current session.

## Note

`impeccable` sends a telemetry ping to impeccable.style. Add
`export IMPECCABLE_NO_TELEMETRY=1` to the hook to disable it.
