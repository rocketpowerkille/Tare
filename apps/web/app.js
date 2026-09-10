import { renderReport, clearReport } from './report.js';
const $ = id => document.getElementById(id);
let capabilities;
let busy = false;
let accessToken = '';

async function api(action, input) {
  const response = await fetch(`/api/${action}`, {
    headers: { ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(input === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(input === undefined ? {} : { method: 'POST', body: JSON.stringify(input) }),
  });
  const value = await response.json();
  if (response.status === 401) $('access-panel').hidden = false;
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
async function run(task) {
  if (busy) return;
  busy = true;
  clearReport();
  $('empty').hidden = true;
  $('error').hidden = true;
  $('activity').textContent = 'Reading evidence and calculating… Live reads can take several minutes.';
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  $('capture-file').disabled = true;
  try {
    renderReport(await task());
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
async function connect() {
  try {
    capabilities = await api('status');
    $('example').replaceChildren();
    for (const example of capabilities.examples) {
      const option = document.createElement('option');
      option.value = example.id;
      option.textContent = example.label;
      $('example').append(option);
    }
    updateForm();
    $('access-panel').hidden = true;
    $('error').hidden = true;
  } catch (error) {
    $('error').textContent = error.message;
    $('error').hidden = false;
  }
}
$('access-form').addEventListener('submit', event => {
  event.preventDefault();
  accessToken = $('access-token').value.trim();
  $('access-token').value = '';
  void connect();
});
void connect();
