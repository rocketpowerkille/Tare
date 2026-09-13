# Three-minute demo script

Aim for 3:30 at a normal speaking pace. Prepare the views before recording, but
do not splice saved and live evidence together as if they were one execution.
The canonical position is the saved Steakhouse USDC example. The CRE control is
a separate Base Sepolia experiment and must be introduced that way.

## Before recording

Open Explorer, the saved example, a separately acquired Graph comparison, the
[public Bazantic Recipe](https://bazantic.com/recipes/explain-defi-vault-evidence-clearly),
and [the CRE manifest](../deployments/cre-hosted-execution.json). Keep credentials
off screen. If the live Graph source is unavailable, use a clearly labeled retained
acceptance view and disclose that a live-provider demonstration is still needed.
Do not fabricate a passing card or claim a saved capture meets a live-data rule.

## 0:00 to 0:25: Show the problem and result

Screen: Open the saved Steakhouse USDC report, not a long homepage introduction.

"A vault balance tells me how many shares an address holds. It does not tell me
what sits behind them. Tare traces supported positions and tells me which evidence
was checked. This saved Ethereum example reports a conversion quote of
28,728,443.339809 USDC at block 25937756. That is the vault's accounting quote,
not a direct USDC balance in this wallet."

## 0:25 to 0:55: Explain the path

Screen: Select a market node and open its details. Keep the block and source mode
visible. Show the raw share quantity only with its raw-unit label.

"Tare attributes this position across twelve Morpho Blue markets. The graph lets
me inspect the path and source behind each allocation. The collateral addresses
are dependencies of those loans, not tokens this wallet directly owns. This adds
a bounded position interpretation to the contract details I can inspect in an
explorer."

## 0:55 to 1:30: Show The Graph doing work

Screen: Switch to the separately labeled live comparison for Steakhouse USDC.
Show its actual block, deployment, Token API observation, and Studio/RPC read set.

"This is a separate check with its own block. The Graph provides indexed evidence,
and Tare compares the eligible observations with RPC. In this vault, the declared
accounting set contains fifty-six reads. The result here tells us whether those
reads agreed. It does not tell us that every loan is recoverable. Missing data or
a different block stays visible instead of becoming a confidence score."

Read the actual result on screen. Say "matched" only if it is matched. The saved
example does not itself contain a Graph comparison or a Chainlink price.

## 1:30 to 2:05: Show the Bazantic agent path

Screen: Run or show a retained, explicitly dated public Recipe execution and its
tool calls. Use the saved example task from the Bazantic integration guide.

"An agent can use Tare through this Bazantic Recipe. It calls Tare's tools and
receives exact values, source mode, checks, and limitations. The agent then
explains what the evidence supports and what remains unknown. This is different
from the website's copy-context button, which only prepares text for an assistant.
This example is saved evidence, and the answer must say so."

Point to the actual unknown-backing statement. If showing an operator test,
state that it made no payment. Do not show an access token.

## 2:05 to 2:50: Show Chainlink's separate confidential path

Screen: Show `handlerInTee`, then the public hosted execution manifest and testnet
transaction. Do not open private policy or credential files.

"Chainlink has a separate policy role. Inside the confidential handler, the workflow
reads authenticated Tare evidence and evaluates private thresholds. A bounded
result leaves the handler for reporting. This historical Base Sepolia control
redeemed exactly one hundred outer shares through Chainlink's forwarder. The
permit was consumed, and the retained workflow is paused. This is not execution
against the Ethereum lending position we just inspected."

"Explorer also supports eligible Chainlink reference prices. A reference price
helps value an amount; it does not prove custody or backing."

## 2:50 to 3:30: Show the boundary and finish

Screen: Return to the visible report limitation, then open raw JSON or download
the capture. If prepared, show an unavailable-source case with its actual label.

"The important result is not a green badge. Here, accounting can be explained,
but independent lending backing remains unverified. A source outage is different
from a missing asset. The raw evidence and capture remain available so another
developer can reproduce the calculation. Tare helps people and agents understand
supported DeFi positions without turning incomplete evidence into a safety claim."

Do not end with an invented metric, performance claim, or promise of solvency.
Link the repository, public app, Recipe, and relevant public execution record in
the submission description.
