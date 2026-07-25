const BASE = '/analytics'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

export const api = {
  summary:    () => get('/summary'),
  timeseries: () => get('/timeseries'),
  models:     () => get('/models'),
  requests:   () => get('/requests'),
  cycles:     () => get('/cycles'),
}