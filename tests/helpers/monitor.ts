import { compositionFixture } from './composition.js';
import { initialState } from '../../packages/monitor/src/model.js';
import type { Frame } from '../../packages/monitor/src/model.js';
import { evaluateCaptures } from '../../packages/monitor/src/evaluate.js';

export const monitorHash = (digit: string) => `0x${digit.repeat(64)}`;
export async function monitorFixture() {
  const evidence = await compositionFixture();
  const capture = evidence.resolutionCapture;
  const position = { chainId: 1 as const, owner: capture.owner, vault: capture.vault };
  const block = { number: String(BigInt(capture.block!.number)), hash: capture.block!.hash };
  const frame: Extract<Frame, { type: 'block' }> = { type: 'block', block, cursor: 'cursor-a',
    events: [{ address: capture.vault, transactionHash: monitorHash('a'), logIndex: 0 }] };
  return { evidence, position, frame, state: initialState(position, block.number, 'recorded-substreams', 'test'),
    evaluate: () => evaluateCaptures(evidence, position, block) };
}
