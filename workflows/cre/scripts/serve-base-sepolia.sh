#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/../../.." && pwd)"
env_file="$root_dir/.env"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file; copy .env.example to .env and configure it." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

for name in TARE_BASE_RPC_URL TARE_BASE_SECONDARY_RPC_URL TARE_BASE_CUSTODY_DEPLOYMENT TARE_PORT; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing $name in $env_file" >&2
    exit 1
  fi
done

cd "$root_dir"
exec pnpm serve
