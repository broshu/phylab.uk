#!/bin/sh
# Deploy command for Cloudflare Workers Builds (`npm run deploy`).
# GITHUB_TOKEN and DEEPSEEK_API_KEY are build secrets in the dashboard; each one
# that is set is copied to the Worker's runtime secret on every deploy, the same
# way as phylab-debate. Secrets that are not set are left as they are.
set -eu
secrets=$(mktemp --suffix=.env)
trap 'rm -f "$secrets"' EXIT
count=0
if [ -n "${GITHUB_TOKEN:-}" ]; then
  printf 'GITHUB_TOKEN=%s\n' "$GITHUB_TOKEN" >> "$secrets"
  count=$((count + 1))
else
  echo "GITHUB_TOKEN build secret not set; not updating it."
fi
if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  printf 'DEEPSEEK_API_KEY=%s\n' "$DEEPSEEK_API_KEY" >> "$secrets"
  count=$((count + 1))
else
  echo "DEEPSEEK_API_KEY build secret not set; not updating it."
fi
if [ "$count" -eq 0 ]; then
  exec npx wrangler deploy
fi
npx wrangler deploy --secrets-file "$secrets"
