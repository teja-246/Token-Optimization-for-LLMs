// Analytics.jsx — the existing dashboard, now a routable page.
//
// Moved from the old App.jsx. The only addition is a "← Back to Chat"
// button in the header so users can return to the chat UI.

import { useState, useEffect, useCallback } from 'react'
import { api }               from '../api/client.js'
import SummaryCards          from '../components/SummaryCards.jsx'
import CacheHitChart         from '../components/CacheHitChart.jsx'
import ModelUsageChart       from '../components/ModelUsageChart.jsx'
import TokenSavingsChart     from '../components/TokenSavingsChart.jsx'
import LatencyChart          from '../components/LatencyChart.jsx'
import CycleAlerts           from '../components/CycleAlerts.jsx'
import RecentRequests        from '../components/RecentRequests.jsx'

const REFRESH_MS = 10_000

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function Analytics() {
  const [summary,    setSummary]    = useState(null)
  const [timeseries, setTimeseries] = useState([])
  const [models,     setModels]     = useState([])
  const [requests,   setRequests]   = useState([])
  const [cycles,     setCycles]     = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error,      setError]      = useState(null)
  const [loading,    setLoading]    = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [s, ts, m, r, c] = await Promise.all([
        api.summary(), api.timeseries(), api.models(), api.requests(), api.cycles(),
      ])
      setSummary(s)
      setTimeseries(ts.data ?? [])
      setModels(m.data ?? [])
      setRequests(r.data ?? [])
      setCycles(c.data ?? [])
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchAll])

  return (
    <div style={styles.root}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          {/* back to chat button */}
          <button style={styles.backBtn} onClick={() => { window.location.hash = '#chat' }}>
            ← Chat
          </button>
          <div style={styles.divider} />
          <div style={styles.logoRow}>
            <span style={styles.logoIcon}>⬡</span>
            <span style={styles.logoText}>Aether</span>
          </div>
          <span style={styles.headerSub}>Analytics Dashboard</span>
        </div>
        <div style={styles.headerRight}>
          {error && <span style={styles.errorBadge}>⚠ {error}</span>}
          <span style={styles.updateTime}>
            {lastUpdate ? `Updated ${formatTime(lastUpdate)}` : 'Loading…'}
          </span>
          <div style={{
            ...styles.dot,
            background: error ? 'var(--red)' : 'var(--green)',
            boxShadow: `0 0 6px ${error ? 'var(--red)' : 'var(--green)'}`,
          }} />
        </div>
      </header>

      {/* ── Body ── */}
      <main style={styles.main}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <span style={{ color: 'var(--text-secondary)' }}>Connecting to gateway…</span>
          </div>
        ) : (
          <>
            <SummaryCards data={summary} />
            <div style={styles.grid2}>
              <CacheHitChart   data={timeseries} />
              <ModelUsageChart data={models} />
            </div>
            <div style={styles.grid2}>
              <TokenSavingsChart data={timeseries} />
              <LatencyChart      data={timeseries} />
            </div>
            <CycleAlerts    data={cycles} />
            <RecentRequests data={requests} />
          </>
        )}
      </main>
    </div>
  )
}

const styles = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', height: 58,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 14 },
  backBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text-secondary)',
    fontSize: 13, cursor: 'pointer', padding: '4px 12px',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  divider: { width: 1, height: 20, background: 'var(--border)' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: { fontSize: 20, color: 'var(--indigo-2)' },
  logoText: { fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' },
  headerSub: { fontSize: 13, color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 14 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  errorBadge: { fontSize: 12, color: 'var(--red)', background: 'rgba(239,68,68,0.12)', padding: '3px 10px', borderRadius: 20 },
  updateTime: { fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  main: {
    flex: 1, padding: '24px 28px',
    display: 'flex', flexDirection: 'column', gap: 20,
    maxWidth: 1400, margin: '0 auto', width: '100%',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  loadingWrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 16, flex: 1, minHeight: 300,
  },
  spinner: {
    width: 36, height: 36,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--indigo)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}

// inject spinner keyframe once
const _style = document.createElement('style')
_style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
document.head.appendChild(_style)