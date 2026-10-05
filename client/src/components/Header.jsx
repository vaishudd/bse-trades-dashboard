import StatusBadge from './StatusBadge.jsx';
import { formatDateTime } from '../utils/format.js';

export default function Header({ connected, status }) {
  return (
    <header className="header">
      <div>
        <h1>Trades Dashboard</h1>
        <p className="muted">BSE trade pulls, updated live</p>
      </div>
      <div className="header-meta">
        <span className={`badge ${connected ? 'badge-ok' : 'badge-failed'}`} role="status">
          ● {connected ? 'Connected' : 'Disconnected'}
        </span>
        <StatusBadge state={status.state} />
        <span className="muted">Last successful pull: {formatDateTime(status.lastSuccessfulPullAt)}</span>
      </div>
    </header>
  );
}
