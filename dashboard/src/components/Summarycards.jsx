function Card({ label, value, sub, color, icon }) {
  return (
    <div style={{ ...styles.card, borderTop: `2px solid ${color}` }}>
      <div style={styles.cardTop}>
        <span style={styles.icon}>{icon}</span>
        <span style={{ ...styles.label }}>{label}</span>
      </div>
      <div style={{ ...styles.value, color }}>{value}</div>
      {sub && <div style={styles.sub}>{sub}</div>}
    </div>
  )
}

export default function SummaryCards({ data }) {
  if (!data) return null

  const hitRate = data.cache_hit_rate?.toFixed(1) ?? '0.0'
  const saved   = data.tokens_saved_pruning?.toLocaleString() ?? '0'
  const latency = data.avg_latency_ms?.toLocaleString() ?? '0'

  return (
    <div style={styles.grid}>
      <Card
        label="Total Requests (24h)"
        value={data.total_requests?.toLocaleString() ?? '0'}
        sub={`${data.cache_hits?.toLocaleString()} cache hits`}
        color="var(--indigo-2)"
        icon="⬡"
      />
      <Card
        label="Cache Hit Rate"
        value={`${hitRate}%`}
        sub={`${data.cache_hits} of ${data.total_requests} requests`}
        color="var(--green)"
        icon="⚡"
      />
      <Card
        label="Tokens Saved (pruning)"
        value={saved}
        sub={`${data.total_input_tokens?.toLocaleString()} total input tokens`}
        color="var(--cyan)"
        icon="✂"
      />
      <Card
        label="Cycles Detected"
        value={data.cycles_detected?.toLocaleString() ?? '0'}
        sub={`${data.remediations_applied} remediations applied`}
        color={data.cycles_detected > 0 ? 'var(--amber)' : 'var(--green)'}
        icon="↻"
      />
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16, opacity: 0.7 },
  label: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' },
  value: { fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 },
  sub: { fontSize: 12, color: 'var(--text-muted)' },
}