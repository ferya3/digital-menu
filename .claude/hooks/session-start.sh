#!/bin/bash
# Prepares a Claude Code on the web session: npm dependencies so the server
# runs, and the skill set this project is worked on with.
#
# Local sessions are skipped - a developer's own machine has its own global
# skills and its own node_modules, and this should not reach into either.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# --- Node: express, socket.io, qrcode, jimp -------------------------------
# npm install rather than npm ci: the container image is cached after the hook
# completes, so an incremental install is the one that benefits from the cache.
echo "Installing npm dependencies..."
npm install --no-audit --no-fund --silent

# --- Skills ---------------------------------------------------------------
# Installed globally (-g), into ~/.claude/skills, rather than committed to the
# repo: the container is fresh each session, so this costs a download instead
# of megabytes of vendored files in git history.
#
# This project is thirteen HTML pages of customer and admin UI with no build
# step, so the design skills carry most of the weight here.
echo "Installing skills..."

npx --yes skills@latest add obra/superpowers -g -a claude-code --copy -y \
  -s brainstorming -s writing-plans -s executing-plans \
  -s subagent-driven-development -s dispatching-parallel-agents \
  -s test-driven-development -s systematic-debugging \
  -s requesting-code-review -s receiving-code-review \
  -s verification-before-completion -s finishing-a-development-branch \
  -s using-git-worktrees -s using-superpowers -s writing-skills

npx --yes skills@latest add thedotmack/claude-mem -g -a claude-code --copy -y \
  -s smart-explore -s learn-codebase -s pathfinder -s babysit

npx --yes skills@latest add pbakaus/impeccable -g -a claude-code --copy -y -s impeccable
npx --yes skills@latest add vercel-labs/skills -g -a claude-code --copy -y -s find-skills
npx --yes skills@latest add rebelytics/one-skill-to-rule-them-all -g -a claude-code --copy -y \
  -s task-observer

# UI/UX Pro Max ships as its own CLI rather than a skills-repo, so it installs
# in two steps. -g here means the home directory, same destination as above.
npm install -g --silent ui-ux-pro-max-cli@latest
uipro init -g -a claude --force

echo "Session ready."
