function shortModel(name) {
  if (!name) return '—'
  if (name === 'cache') return 'Cache'
  if (name.includes('8b'))  return 'Llama 8B'
  if (name.includes('70b')) return 'Llama 70B'
  return name
}

function ModelBadge({ model }) {
  const color =
    model === 'cache'               ? 'var(--green)' :
    model?.includes('70b')          ? 'var(--cyan)'  :
                                      'var(--indigo-2)'
  const bg =
    model === 'cache'               ? 'rgba(34,197,94,0.1)'  :
    model?.includes('70b')          ? 'rgba(6,182,212,0.1)'  :
                                      'rgba(99,102,241,0.1)'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: '2px 8px', borderRadius: 12 }}>
      {shortModel(model)}
    </span>
  )
}

function StatusDot({ on, color }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: on ? color : 'var(--border-2)',
    }} />
  )
}

function formatTime(str) {
  if (!str) return '—'
  return new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function RecentRequests({ data }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Recent Requests</span>
        <span style={styles.count}>{data.length} rows</span>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Request ID', 'Model', 'In Tokens', 'Out Tokens', 'Latency', 'Cache', 'Cycle', 'Remediated', 'Pruned', 'Time'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const tokensSaved = Math.max(0, (row.original_tokens ?? 0) - (row.pruned_tokens ?? 0))
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ ...styles.td, ...styles.mono, color: 'var(--text-secondary)', fontSize: 11 }}>
                    {row.request_id?.slice(0, 16)}…
                  </td>
                  <td style={styles.td}><ModelBadge model={row.model} /></td>
                  <td style={{ ...styles.td, ...styles.mono }}>{row.input_tokens?.toLocaleString()}</td>
                  <td style={{ ...styles.td, ...styles.mono }}>{row.output_tokens?.toLocaleString()}</td>
                  <td style={{ ...styles.td, ...styles.mono, color: row.latency_ms > 2000 ? 'var(--red)' : row.latency_ms > 1000 ? 'var(--amber)' : 'var(--text-primary)' }}>
                    {row.latency_ms ? `${row.latency_ms.toLocaleString()}ms` : '—'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <StatusDot on={row.cache_hit} color="var(--green)" />
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <StatusDot on={row.cycle_detected} color="var(--amber)" />
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <StatusDot on={row.remediation_applied} color="var(--cyan)" />
                  </td>
                  <td style={{ ...styles.td, ...styles.mono, color: tokensSaved > 0 ? 'var(--cyan)' : 'var(--text-muted)', fontSize: 11 }}>
                    {tokensSaved > 0 ? `-${tokensSaved}` : '—'}
                  </td>
                  <td style={{ ...styles.td, ...styles.mono, color: 'var(--text-muted)', fontSize: 11 }}>
                    {formatTime(row.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '18px 20px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  title: { fontSize: 14, fontWeight: 600 },
  count: {
    fontSize: 11, color: 'var(--text-muted)',
    background: 'var(--bg-card-2)', border: '1px solid var(--border)',
    padding: '2px 8px', borderRadius: 20,
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '9px 12px',
    color: 'var(--text-primary)',
    borderBottom: '1px solid rgba(31,45,69,0.5)',
    whiteSpace: 'nowrap',
  },
  mono: { fontFamily: 'var(--font-mono)' },
}