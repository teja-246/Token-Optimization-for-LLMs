import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const MODEL_COLORS = {
  'llama-3.1-8b-instant':   'var(--indigo-2)',
  'llama-3.3-70b-versatile': 'var(--cyan)',
  'cache':                   'var(--green)',
}

function shortModel(name) {
  if (!name) return name
  if (name === 'cache') return 'Cache'
  if (name.includes('8b'))  return 'Llama 8B'
  if (name.includes('70b')) return 'Llama 70B'
  return name.split('-').slice(-1)[0]
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={tooltipStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.model}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Requests: {d.requests}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Avg latency: {d.avg_latency_ms}ms</div>
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--bg-card-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
}

export default function ModelUsageChart({ data }) {
  const formatted = data.map(d => ({
    ...d,
    label: shortModel(d.model),
    color: MODEL_COLORS[d.model] ?? 'var(--amber)',
  }))

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Model Usage</span>
        <span style={styles.badge}>24h</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={formatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
          <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
            {formatted.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={styles.legend}>
        {formatted.map((d, i) => (
          <div key={i} style={styles.legendItem}>
            <div style={{ ...styles.legendDot, background: d.color }} />
            <span style={styles.legendLabel}>{d.label}</span>
            <span style={styles.legendCount}>{d.requests}</span>
          </div>
        ))}
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
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 14, fontWeight: 600 },
  badge: { fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 },
  legend: { display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  legendLabel: { fontSize: 12, color: 'var(--text-secondary)' },
  legendCount: { fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
}