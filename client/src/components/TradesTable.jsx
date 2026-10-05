import { useMemo, useState } from 'react';
import { formatDateTime, formatNumber, formatPrice } from '../utils/format.js';

const COLUMNS = [
  { key: 'tradeId', label: 'Trade ID' },
  { key: 'client', label: 'Client' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'quantity', label: 'Quantity', numeric: true },
  { key: 'price', label: 'Price (₹)', numeric: true },
  { key: 'timestamp', label: 'Timestamp' },
];
const PAGE_SIZE = 50; // keeps the DOM small even with thousands of trades

function compareBy(key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  return (a, b) => {
    const x = a[key];
    const y = b[key];
    // ISO timestamps sort correctly as strings, numbers as numbers.
    if (typeof x === 'number') return (x - y) * sign;
    return String(x).localeCompare(String(y)) * sign;
  };
}

function Message({ title, text, action }) {
  return (
    <div className="table-message">
      <strong>{title}</strong>
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

export default function TradesTable({ trades, loading, error, onRetry }) {
  const [query, setQuery] = useState('');
  const [symbol, setSymbol] = useState('');
  const [sort, setSort] = useState({ key: 'timestamp', dir: 'desc' });
  const [page, setPage] = useState(1);

  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))].sort(), [trades]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = trades.filter(
      (t) =>
        (!symbol || t.symbol === symbol) &&
        (!q || [t.tradeId, t.client, t.symbol].some((v) => v.toLowerCase().includes(q)))
    );
    return filtered.sort(compareBy(sort.key, sort.dir));
  }, [trades, query, symbol, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages); // new data may shrink the list
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = (key) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  let body;
  if (loading) {
    body = <Message title="Loading trades…" text="Fetching the trades stored so far." />;
  } else if (error && trades.length === 0) {
    body = (
      <Message
        title="Could not load trades"
        text={error}
        action={<button className="btn btn-secondary" onClick={onRetry}>Retry</button>}
      />
    );
  } else if (trades.length === 0) {
    body = <Message title="No trades stored yet" text="Click “Start Trade Pull” to fetch trades from BSE." />;
  } else if (visible.length === 0) {
    body = <Message title="No matching trades" text="Try a different search or clear the symbol filter." />;
  }

  return (
    <section className="card">
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search trade ID, client or symbol"
          aria-label="Search trades"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
        />
        <select
          aria-label="Filter by symbol"
          value={symbol}
          onChange={(e) => { setSymbol(e.target.value); setPage(1); }}
        >
          <option value="">All symbols</option>
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {body ?? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={col.numeric ? 'num' : ''}
                      aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button className="sort-btn" onClick={() => toggleSort(col.key)}>
                        {col.label}{sort.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.tradeId}>
                    <td>{t.tradeId}</td>
                    <td>{t.client}</td>
                    <td>{t.symbol}</td>
                    <td className="num">{formatNumber(t.quantity)}</td>
                    <td className="num">{formatPrice(t.price)}</td>
                    <td>{formatDateTime(t.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="muted">{formatNumber(visible.length)} trades · page {currentPage} of {totalPages}</span>
            <div>
              <button className="btn btn-secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
              <button className="btn btn-secondary" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
