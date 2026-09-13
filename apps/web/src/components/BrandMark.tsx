export function BrandMark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M4 7h24M8 16h16M12 25h8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
  </svg>;
}
