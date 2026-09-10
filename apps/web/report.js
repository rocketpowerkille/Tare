const $ = id => document.getElementById(id);
let downloads = [];

export function clearReport() {
  for (const url of downloads) URL.revokeObjectURL(url);
  downloads = [];
  $('report').hidden = true;
}

function addFact(label, value) {
  if (value === undefined || value === null) return;
  const group = document.createElement('div');
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  term.textContent = label;
  detail.textContent = String(value);
  group.append(term, detail);
  $('facts').append(group);
}

export function renderReport(report) {
  const capture = report.capture;
  const block = capture.block ?? capture.rpc?.block ?? capture.witnesses?.[0]?.rpc.block;
  $('source').textContent = report.sourceMode;
  $('result-title').textContent = report.reportType ?? report.protocol;
  $('result-status').textContent = report.status ?? report.kind;
  $('facts').replaceChildren();
  addFact('Owner', capture.owner);
  addFact('Vault', capture.vault);
  addFact('Block', block ? BigInt(block.number).toString() : 'Unavailable');
  addFact('Block hash', block?.hash);
  addFact('Captured at', capture.capturedAt);
  addFact('Evidence digest', report.captureDigest);
  addFact('Scope', report.scope ?? capture.scope);
  addFact('Verification', report.verification);
  addFact('USDC claim, raw', report.analysis?.quoteRaw ?? report.vault?.convertToAssetsRaw);
  addFact('USDC rounding / unattributed, raw', report.analysis?.unattributedAssetsRaw ?? report.unattributedAssetsRaw);
  addFact('Observed USD value, raw (8 decimals)', report.valuation?.rootClaim?.valueRaw);
  addFact('Price timestamp, Unix seconds', report.valuation?.price?.updatedAt ?? report.claim?.price?.updatedAt);
  addFact('WETH claim, raw (18 decimals)', report.claim?.balanceRaw);
  addFact('Compared reads', report.checks ? `${report.checks.filter(check => check.status === 'matched').length} matched / ${report.checks.length} compared` : null);
  const metric = report.metric;
  $('metric').textContent = metric.kind === 'available'
    ? `${metric.multipleMillionths === '1000000' ? '1×' : `${metric.multipleMillionths} millionths`} · ${metric.scope}` : 'Unavailable';
  $('metric-reasons').textContent = (metric.reasons ?? report.limitations ?? []).join(' · ');
  $('findings').replaceChildren();
  const notes = [...report.findings, ...(report.limitations ?? [])];
  if (report.sourceMode.startsWith('recorded')) notes.unshift('Historical, unsigned recording. This replay does not check current chain state.');
  if (metric.kind === 'unavailable') notes.push('A complete accounting trace does not establish verified backing.');
  if (!notes.length) notes.push('No findings within the reported scope.');
  for (const note of notes) {
    const item = document.createElement('li');
    item.textContent = typeof note === 'string' ? note : JSON.stringify(note);
    $('findings').append(item);
  }
  $('rows').replaceChildren();
  $('branches').replaceChildren();
  for (const branch of report.analysis?.branches ?? []) {
    const item = document.createElement('li');
    item.textContent = `Adapter ${branch.adapter} → ${branch.vault ?? 'not expanded'} · ${branch.assetsRaw} raw USDC controlled · ${branch.attributedAssetsRaw ?? 'unavailable'} attributed · ${branch.markets.length} observed markets`;
    $('branches').append(item);
  }
  $('paths').hidden = !$('branches').children.length;
  const branches = report.analysis?.branches ?? [{ vault: capture.vault, markets: report.markets ?? [] }];
  for (const branch of branches) for (const market of branch.markets) {
    const row = document.createElement('tr');
    for (const value of [`${branch.vault} / ${market.marketId}`, market.attributedAssetsRaw ?? 'Unavailable']) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    $('rows').append(row);
  }
  $('allocations').hidden = !$('rows').children.length;
  $('raw').textContent = JSON.stringify(report, null, 2);
  $('empty').hidden = true;
  for (const [id, value, filename] of [['download', report, 'tare.report.json'], ['download-capture', report.capture, 'tare.capture.json']]) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    downloads.push(url);
    $(id).href = url;
    $(id).download = filename;
  }
  $('report').hidden = false;
}

