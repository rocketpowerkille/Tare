export const BAZANTIC_GATEWAY_URL = 'https://zvnss2njirhqjllnbfsv3sneca.bazgateway.com';
export const BAZANTIC_GATEWAY_SLUG = 'zvnss2njirhqjllnbfsv3sneca';
export const BAZANTIC_SESSION_PATH = '/api/bazantic/session';
export const BAZANTIC_PRICE_USDC = '0.001';
export const BAZANTIC_CLI_DOCS = 'https://bazantic.com/docs/cli#make-a-paid-call';
export const BAZANTIC_GRANT_DOCS = 'https://bazantic.com/docs/spend-grants#create-a-grant';
export const CIRCLE_TESTNET_FAUCET = 'https://faucet.circle.com/';

export function bazanticSessionUrl(
  gatewayUrl = BAZANTIC_GATEWAY_URL,
  sessionPath = BAZANTIC_SESSION_PATH,
) {
  return `${gatewayUrl.replace(/\/$/, '')}/${sessionPath.replace(/^\//, '')}`;
}

export function bazanticGrantCommand() {
  return `baz grant create --name tare-demo --cap 0.01 --network base-sepolia --service ${BAZANTIC_GATEWAY_SLUG}`;
}

export function bazanticSessionCommand(
  gatewayUrl = BAZANTIC_GATEWAY_URL,
  sessionPath = BAZANTIC_SESSION_PATH,
) {
  return `baz curl ${bazanticSessionUrl(gatewayUrl, sessionPath)} \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{}' \\
  --account tare-demo \\
  --max-amount ${BAZANTIC_PRICE_USDC} \\
  --yes \\
  --json`;
}
