export const BAZANTIC_GATEWAY_URL = 'https://zvnss2njirhqjllnbfsv3sneca.bazgateway.com';
export const BAZANTIC_GATEWAY_SLUG = 'zvnss2njirhqjllnbfsv3sneca';
export const BAZANTIC_SESSION_PATH = '/api/bazantic/session';
export const BAZANTIC_PRICE_USDC = '0.001';
export const BAZANTIC_CLI_DOCS = 'https://bazantic.com/docs/cli#make-a-paid-call';
export const BAZANTIC_GRANT_DOCS = 'https://bazantic.com/docs/spend-grants#create-a-grant';
export const CIRCLE_TESTNET_FAUCET = 'https://faucet.circle.com/';

export const TERMINALS = [
  { id: 'powershell', label: 'PowerShell', continuation: '`' },
  { id: 'git-bash', label: 'Git Bash', continuation: '\\' },
  { id: 'bash-zsh', label: 'macOS / Linux', continuation: '\\' },
  { id: 'cmd', label: 'Command Prompt', continuation: '^' },
] as const;
export type Terminal = typeof TERMINALS[number]['id'];

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
  terminal: Terminal = 'git-bash',
) {
  const { continuation } = TERMINALS.find(option => option.id === terminal)!;
  const body = terminal === 'cmd' ? '"{}"' : "'{}'";
  return [
    `baz curl ${bazanticSessionUrl(gatewayUrl, sessionPath)}`,
    '-X POST',
    '-H "Content-Type: application/json"',
    `-d ${body}`,
    '--account tare-demo',
    `--max-amount ${BAZANTIC_PRICE_USDC}`,
    '--yes',
    '--json',
  ].join(` ${continuation}\n  `);
}
