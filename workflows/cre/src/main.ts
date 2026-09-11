import { Runner } from '@chainlink/cre-sdk';
import type { Config } from './config';
import { initWorkflow } from './workflow';

export async function main() {
  // The transformed policy schema is parsed inside the confidential handler.
  // Keeping subscription structural avoids current CRE/Javy Standard Schema incompatibilities.
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
