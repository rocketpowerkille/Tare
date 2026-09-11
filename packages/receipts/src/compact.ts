export function compactEvidenceReport(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'invalid-report', captureOmitted: true };
  }
  const { capture: _capture, ...report } = value as Record<string, unknown>;
  return {
    ...report,
    captureOmitted: true,
    captureNote: 'Raw acquisition evidence is available from the full API response; this agent view preserves the evaluated report and digest.',
  };
}
