import { AppLink } from './AppLink';

/** Public product explanation; operational details live in the linked guide sections. */
export function DocumentationRationale() {
  return <>
    <section className="doc-section" id="why-tare">
      <p className="section-label">Why Tare exists</p><h2>A balance is not the whole position.</h2>
      <p>A vault share can represent a claim through several contracts and lending markets. Its accounting value does not tell you whether the assets can be withdrawn, whether borrowers will repay, or whether two vaults depend on the same market. Sources may also describe different blocks.</p>
      <p>Tare helps depositors, treasury reviewers and agents separate those questions. It brings supported protocol interpretation, exact calculations, source comparisons and unresolved claims into one inspectable report. Block explorers and protocol apps remain useful for examining contracts and transactions; Tare adds the position-level investigation, not a replacement for those tools.</p>
      <div className="plain-example"><strong>What a useful answer looks like</strong><p>“The wallet holds vault shares. The eligible accounting observations agree at their checked block. A reference price values the reported amount. Full backing and future redemption are still unverified.” If evidence is missing or disagrees, the answer must say so instead.</p></div>
      <p>Success means you can explain what the numbers mean and trace a claim back to evidence—not that every result turns green.</p>
    </section>

    <section className="doc-section" id="integration-roles">
      <p className="section-label">Integration roles</p><h2>Each source answers a different question.</h2>
      <div className="definition-list">
        <div><strong>Protocol discovery and RPC → find and read</strong><p>Morpho, enabled Euler discovery and configured registry entries identify candidates. Supported adapters interpret contract reads and calculate exposure. Discovery is not verification; generic ERC-4626 accounting does not explain arbitrary strategies.</p></div>
        <div><strong>The Graph → retrieve indexed evidence and compare</strong><p>Studio supplies eligible accounting and a separate historical share ledger. Product composition adds The Graph Token API's wallet balance. Tare compares qualifying observations with RPC, preserving block differences and mismatches. The two Graph products are Token API and Studio—not Morpho discovery or two mappings in one subgraph.</p></div>
        <div><strong>Chainlink → price a supported amount</strong><p>Reviewed asset/feed mappings provide reference prices with round, freshness and L2 sequencer checks. A price helps interpret an accounting amount in USD; it does not prove custody or backing. Unsupported or stale prices remain unavailable.</p></div>
        <div><strong>Bazantic → make Tare usable by agents</strong><p>Gateway tools expose evidence through hosted MCP. Recipes guide retrieval and explanation. The in-page assistant explains a consented snapshot and links fact IDs; Tare checks answer structure and retrieval, not the truth of every sentence. Copy context is a separate option that makes no AI request.</p></div>
        <div><strong>Captures and replay → reproduce the calculation</strong><p>Saved observations can be recomputed with the same analysis code. This makes failures and comparisons inspectable without a fresh provider request. Captures are unsigned; replay does not authenticate the original provider.</p></div>
      </div>
      <p>A separate Chainlink CRE workflow demonstrates private policy evaluation and bounded Base Sepolia execution. Its latest retained binding is paused with execution disabled. It is not triggered by this website and is not a production protection service.</p>
      <p>For contracts, configuration and implementation details, read the <AppLink href="/developers">developer guide</AppLink> and the <a href="https://github.com/rocketpowerkille/Tare/blob/main/docs/PRODUCT_GUIDE.md" target="_blank" rel="noreferrer">repository product guide</a>.</p>
    </section>
  </>;
}
