function timeAgo(str) {
  const diff = Date.now() - new Date(str).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function shortModel(name) {
  if (!name) return '—'
  if (name.includes('8b'))  return 'Llama 8B'
  if (name.includes('70b')) return 'Llama 70B'
  return name
}

export default function CycleAlerts({ data }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.alertIcon}>↻</span>
          <span style={styles.title}>Cycle Detection Alerts</span>
          {data.length > 0 && (
            <span style={styles.count}>{data.length}</span>
          )}
        </div>
        <span style={styles.sub}>Sessions where the LLM was stuck in a loop</span>
      </div>

      {data.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: 24 }}>✓</span>
          <span>No loops detected in the last 24 hours</span>
        </div>
      ) : (
        <div style={styles.list}>
          {data.map((row, i) => (
            <div key={i} style={styles.row}>
              <div style={styles.rowLeft}>
                <div style={styles.alertDot} />
                <div>
                  <div style={styles.reqId} className="mono">{row.request_id.slice(0, 18)}…</div>
                  <div style={styles.meta}>
                    User: {row.user_id ?? '—'} &nbsp;·&nbsp; Model: {shortModel(row.model)}
                  </div>
                </div>
              </div>
              <div style={styles.rowRight}>
                {row.remediation_applied ? (
                  <span style={styles.badgeFixed}>CoVe Applied</span>
                ) : (
                  <span style={styles.badgeDetected}>Detected</span>
                )}
                <span style={styles.time}>{timeAgo(row.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '2px solid var(--amber)',
    borderRadius: 'var(--radius)',
    padding: '18px 20px',
  },
  header: { marginBottom: 16 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  alertIcon: { fontSize: 16, color: 'var(--amber)' },
  title: { fontSize: 14, fontWeight: 600 },
  count: {
    fontSize: 11, fontWeight: 700,
    background: 'rgba(245,158,11,0.15)',
    color: 'var(--amber)',
    padding: '1px 7px',
    borderRadius: 20,
    border: '1px solid rgba(245,158,11,0.3)',
  },
  sub: { fontSize: 12, color: 'var(--text-muted)' },
  empty: {
    display: 'flex', alignItems: 'center', gap: 10,
    color: 'var(--green)', fontSize: 13,
    padding: '12px 0',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  alertDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: 'var(--amber)',
    boxShadow: '0 0 6px var(--amber)',
  },
  reqId: { fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 },
  meta: { fontSize: 11, color: 'var(--text-muted)' },
  rowRight: { display: 'flex', alignItems: 'center', gap: 10 },
  badgeFixed: {
    fontSize: 11, fontWeight: 600,
    background: 'rgba(34,197,94,0.12)',
    color: 'var(--green)',
    padding: '2px 9px',
    borderRadius: 20,
    border: '1px solid rgba(34,197,94,0.25)',
  },
  badgeDetected: {
    fontSize: 11, fontWeight: 600,
    background: 'rgba(245,158,11,0.12)',
    color: 'var(--amber)',
    padding: '2px 9px',
    borderRadius: 20,
    border: '1px solid rgba(245,158,11,0.25)',
  },
  time: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
}