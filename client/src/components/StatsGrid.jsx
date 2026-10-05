import StatCard from './StatCard.jsx';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime, formatNumber } from '../utils/format.js';

export default function StatsGrid({ stats, status }) {
  return (
    <section className="stats-grid" aria-label="Statistics">
      <StatCard label="Total Trades">{formatNumber(stats.totalTrades)}</StatCard>
      <StatCard label="Current Pull Status"><StatusBadge state={status.state} /></StatCard>
      <StatCard label="Last Updated"><span className="stat-small">{formatDateTime(status.lastSuccessfulPullAt)}</span></StatCard>
      <StatCard label="Clients">{formatNumber(stats.clientCount)}</StatCard>
      <StatCard label="Symbols">{formatNumber(stats.symbolCount)}</StatCard>
    </section>
  );
}
