const LABELS = { idle: 'Idle', pulling: 'Pulling', completed: 'Completed', failed: 'Failed' };

export default function StatusBadge({ state }) {
  return <span className={`badge badge-${state}`}>{LABELS[state] ?? state}</span>;
}
