const $ = id => document.getElementById(id);
let capabilities;
let currentReport;
let busy = false;

async function api(action, input) {
  const response = await fetch(`/api/${action}`, input === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error?.message ?? 'Request failed.');
  return value;
}

function updateForm() {
  const operation = $('operation').value;
  $('owner').disabled = operation === 'verify-accounting';
  $('vault').disabled = operation === 'verify-weth';
  const configured = capabilities?.live[operation];
  $('live-submit').disabled = busy || !configured;
  $('configuration').textContent = configured
    ? 'Uses locally configured providers. Addresses are public; no wallet connection is needed.'
    : 'Providers for this operation are not configured. Recorded examples and capture replay are ready to use.';
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

function render(report) {
  currentReport = report;
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
  $('report').hidden = false;
}

async function run(task) {
  if (busy) return;
  busy = true;
  currentReport = undefined;
  $('report').hidden = true;
  $('empty').hidden = true;
  $('error').hidden = true;
  $('activity').textContent = 'Reading evidence and calculating… Live reads can take several minutes.';
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  $('capture-file').disabled = true;
  try {
    render(await task());
    $('activity').textContent = 'Result ready. Review its source, scope and findings below.';
  } catch (error) {
    $('error').textContent = error.message;
    $('error').hidden = false;
    $('activity').textContent = 'No result was produced.';
  } finally {
    busy = false;
    for (const button of document.querySelectorAll('button')) button.disabled = false;
    $('capture-file').disabled = false;
    updateForm();
  }
}

$('operation').addEventListener('change', updateForm);
$('example-form').addEventListener('submit', event => {
  event.preventDefault();
  void run(() => api('example', { id: $('example').value }));
});
$('live-form').addEventListener('submit', event => {
  event.preventDefault();
  const request = { operation: $('operation').value };
  if (!$('owner').disabled) request.owner = $('owner').value.trim();
  if (!$('vault').disabled) request.vault = $('vault').value.trim();
  if ($('block').value) request.blockNumber = $('block').value;
  void run(() => api('analyze', request));
});
$('capture-file').addEventListener('change', () => {
  const file = $('capture-file').files[0];
  const operation = $('operation').value;
  if (!file) return;
  void run(async () => {
    if (file.size > 5 * 1024 * 1024) throw new Error('Capture exceeds 5 MiB.');
    let capture;
    try { capture = JSON.parse(await file.text()); }
    catch { throw new Error('Choose a valid raw capture JSON file.'); }
    return api('replay', { operation, capture });
  });
  $('capture-file').value = '';
});

function download(captureOnly) {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(captureOnly ? currentReport.capture : currentReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = captureOnly ? 'tare.capture.json' : 'tare.report.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('download').addEventListener('click', () => download(false));
$('download-capture').addEventListener('click', () => download(true));

try {
  capabilities = await api('status');
  for (const example of capabilities.examples) {
    const option = document.createElement('option');
    option.value = example.id;
    option.textContent = example.label;
    $('example').append(option);
  }
  updateForm();
} catch {
  $('error').textContent = 'Cannot reach the local Tare service. Restart the server and reload this page.';
  $('error').hidden = false;
}
