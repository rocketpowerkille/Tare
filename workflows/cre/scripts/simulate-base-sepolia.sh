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

for name in TARE_BASE_RPC_URL TARE_BASE_SECONDARY_RPC_URL TARE_CRE_API_URL \
  SECRET_TARE_PRIVATE_POLICY SECRET_TARE_API_TOKEN CRE_ETH_PRIVATE_KEY; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing $name in $env_file" >&2
    exit 1
  fi
done

if [[ "$CRE_ETH_PRIVATE_KEY" =~ ^[[:xdigit:]]{64}$ ]]; then
  export CRE_ETH_PRIVATE_KEY="0x$CRE_ETH_PRIVATE_KEY"
elif [[ ! "$CRE_ETH_PRIVATE_KEY" =~ ^0x[[:xdigit:]]{64}$ ]]; then
  echo "CRE_ETH_PRIVATE_KEY must contain exactly 64 hexadecimal characters." >&2
  exit 1
fi

case "${1:-}" in
  "") broadcast=() ;;
  --broadcast) broadcast=(--broadcast) ;;
  *) echo "Usage: bash workflows/cre/scripts/simulate-base-sepolia.sh [--broadcast]" >&2; exit 2 ;;
esac

cd "$root_dir"
npm run prepare:simulation --prefix workflows/cre

config_path="$(cygpath -w "$root_dir/.tare/cre/base-sepolia-simulation.json")"
env_path="$(cygpath -w "$env_file")"
exec cre workflow simulate ./workflows/cre \
  --project-root . \
  --target staging-settings \
  --config "$config_path" \
  --env "$env_path" \
  --non-interactive \
  --trigger-index 0 \
  --limits none \
  "${broadcast[@]}"
