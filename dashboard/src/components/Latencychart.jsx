import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function formatHour(str) {
  if (!str) return ''
  return new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  const color = val > 2000 ? 'var(--red)' : val > 1000 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: 11 }}>{label}</div>
      <div style={{ color, fontWeight: 600 }}>Avg latency: {val.toLocaleString()}ms</div>
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--bg-card-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
}

export default function LatencyChart({ data }) {
  const formatted = data.map(d => ({
    label: formatHour(d.hour),
    latency: d.avg_latency_ms ?? 0,
  }))

  const avg = formatted.length
    ? Math.round(formatted.reduce((s, d) => s + d.latency, 0) / formatted.length)
    : 0

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Average Latency</span>
        <span style={{
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
          color: avg > 2000 ? 'var(--red)' : avg > 1000 ? 'var(--amber)' : 'var(--green)',
        }}>
          {avg.toLocaleString()}ms avg
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--indigo)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--indigo)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} unit="ms" />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={1000} stroke="var(--amber)" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="var(--indigo-2)"
            strokeWidth={2}
            fill="url(#latencyGrad)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--indigo-2)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.dot, background: 'var(--amber)' }} />
          <span style={styles.legendText}>1000ms threshold</span>
        </div>
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
  legend: { display: 'flex', gap: 16, marginTop: 8 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 2, borderRadius: 1, flexShrink: 0 },
  legendText: { fontSize: 11, color: 'var(--text-muted)' },
}