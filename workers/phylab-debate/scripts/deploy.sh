#!/bin/sh
# Deploy command for Cloudflare Workers Builds (`npm run deploy`).
# DEEPSEEK_API_KEY is stored as a build secret in the dashboard. It is copied
# to the Worker's runtime secret on every deploy, so the key only lives in one
# place. The temporary file is removed even if the deploy fails.
set -eu
if [ -z "${DEEPSEEK_API_KEY:-}" ]; then
  echo "DEEPSEEK_API_KEY build secret not set; deploying without updating it."
  exec npx wrangler deploy
fi
secrets=$(mktemp --suffix=.env)
trap 'rm -f "$secrets"' EXIT
printf 'DEEPSEEK_API_KEY=%s\n' "$DEEPSEEK_API_KEY" > "$secrets"
npx wrangler deploy --secrets-file "$secrets"
