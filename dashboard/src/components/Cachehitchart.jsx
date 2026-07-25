import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function formatHour(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: 11 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontSize: 13, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          {p.name === 'Hit Rate' ? '%' : ''}
        </div>
      ))}
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--bg-card-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
}

export default function CacheHitChart({ data }) {
  const formatted = data.map(d => ({
    ...d,
    label: formatHour(d.hour),
    hit_rate: parseFloat((d.hit_rate ?? 0).toFixed(1)),
  }))

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Cache Hit Rate</span>
        <span style={styles.badge}>24h</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={formatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="hit_rate"
            name="Hit Rate"
            stroke="var(--green)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--green)' }}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Requests"
            stroke="var(--indigo-2)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
            activeDot={{ r: 4, fill: 'var(--indigo-2)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  badge: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border)',
    padding: '2px 8px',
    borderRadius: 20,
  },
}