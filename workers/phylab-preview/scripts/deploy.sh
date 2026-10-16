#!/bin/sh
# Deploy command for Cloudflare Workers Builds (`npm run deploy`).
# DEEPSEEK_API_KEY and GITHUB_TOKEN are build secrets in the dashboard; they
# are copied to the Worker's runtime secrets on every deploy, the same way as
# phylab-debate. The D1 schema is applied first (it is idempotent).
set -eu
npx wrangler d1 migrations apply phylab-preview --remote || echo "Could not apply D1 migrations (the schema is idempotent and may already exist)."
secrets=$(mktemp --suffix=.env)
trap 'rm -f "$secrets"' EXIT
: > "$secrets"
for name in DEEPSEEK_API_KEY GITHUB_TOKEN PREVIEW_KEY; do
  value=$(printenv "$name" || true)
  if [ -n "$value" ]; then printf '%s=%s\n' "$name" "$value" >> "$secrets"; fi
done
if [ -s "$secrets" ]; then
  npx wrangler deploy --secrets-file "$secrets"
else
  echo "No build secrets set; deploying without updating secrets."
  npx wrangler deploy
fi
