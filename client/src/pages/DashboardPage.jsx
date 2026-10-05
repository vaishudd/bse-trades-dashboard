import Header from '../components/Header.jsx';
import StatsGrid from '../components/StatsGrid.jsx';
import PullControls from '../components/PullControls.jsx';
import TradesTable from '../components/TradesTable.jsx';
import { useDashboard } from '../hooks/useDashboard.js';

export default function DashboardPage() {
  const { trades, stats, status, loading, error, notice, connected, starting, refresh, handleStartPull } =
    useDashboard();

  const isPulling = status.state === 'pulling';
  // If the last pull failed and there is no fresher message, still tell the user why.
  const shownNotice =
    notice ?? (status.state === 'failed' && status.job?.error
      ? { type: 'error', text: `Last pull failed: ${status.job.error}` }
      : null);

  return (
    <div className="page">
      <Header connected={connected} status={status} />
      <main>
        {error && trades.length > 0 && (
          <div className="banner" role="alert">
            {error} Showing the last loaded data. <button className="link-btn" onClick={refresh}>Retry</button>
          </div>
        )}
        <StatsGrid stats={stats} status={status} />
        <PullControls isPulling={isPulling} starting={starting} onStart={handleStartPull} notice={shownNotice} />
        <TradesTable trades={trades} loading={loading} error={error} onRetry={refresh} />
      </main>
    </div>
  );
}
