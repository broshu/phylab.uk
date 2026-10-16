#!/bin/sh
# Deploy command for Cloudflare Workers Builds (`npm run deploy`).
# GITHUB_TOKEN is a build secret in the dashboard; it is copied to the
# Worker's runtime secret on every deploy, the same way as phylab-debate.
set -eu
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN build secret not set; deploying without updating it."
  exec npx wrangler deploy
fi
secrets=$(mktemp --suffix=.env)
trap 'rm -f "$secrets"' EXIT
printf 'GITHUB_TOKEN=%s\n' "$GITHUB_TOKEN" > "$secrets"
npx wrangler deploy --secrets-file "$secrets"
