export default function PullControls({ isPulling, starting, onStart, notice }) {
  const disabled = isPulling || starting;
  const label = starting ? 'Starting…' : isPulling ? 'Pull in progress…' : 'Start Trade Pull';

  return (
    <section className="card pull-controls">
      <button className="btn" onClick={onStart} disabled={disabled}>{label}</button>
      <div className="notice-area" role="status" aria-live="polite">
        {notice && <span className={`notice notice-${notice.type}`}>{notice.text}</span>}
        {!notice && isPulling && (
          <span className="notice notice-info">Pull running on the server. You can keep using the dashboard.</span>
        )}
      </div>
    </section>
  );
}
