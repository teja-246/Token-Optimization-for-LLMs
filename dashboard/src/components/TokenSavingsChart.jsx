import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function formatHour(str) {
  if (!str) return ''
  return new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: 11 }}>{label}</div>
      <div style={{ color: 'var(--cyan)', fontWeight: 600 }}>
        Tokens saved: {payload[0]?.value?.toLocaleString() ?? 0}
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--bg-card-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
}

export default function TokenSavingsChart({ data }) {
  const formatted = data.map(d => ({
    label: formatHour(d.hour),
    saved: Math.max(0, d.tokens_saved ?? 0),
  }))

  const totalSaved = formatted.reduce((s, d) => s + d.saved, 0)

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Token Savings from Pruning</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
          {totalSaved.toLocaleString()} saved
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--cyan)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="saved"
            stroke="var(--cyan)"
            strokeWidth={2}
            fill="url(#cyanGrad)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--cyan)' }}
          />
        </AreaChart>
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
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 14, fontWeight: 600 },
}