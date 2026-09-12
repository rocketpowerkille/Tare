interface StatusBadgeProps {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}

export function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
