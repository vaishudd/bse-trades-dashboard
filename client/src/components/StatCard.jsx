export default function StatCard({ label, children }) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{children}</span>
    </div>
  );
}
