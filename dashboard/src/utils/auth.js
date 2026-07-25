// ─────────────────────────────────────────────────────────────────────────────
// auth.js — JWT helpers for Aether
//
// Token lifecycle:
//   Phase 2 (OAuth) writes the token via setToken().
//   Every other module reads it via getToken() / isAuthenticated().
//
// Storage keys
const TOKEN_KEY = 'aether_token'
const USER_KEY  = 'aether_user'

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Persist a JWT and decode + cache the user payload.
 * Called after OAuth callback in Phase 2.
 */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)

  // decode the payload (middle segment of JWT) to extract user info
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const user = {
      id:      payload.user_id ?? payload.sub ?? 'unknown',
      email:   payload.email   ?? '',
      name:    payload.name    ?? payload.email ?? 'User',
      picture: payload.picture ?? null,
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch (_) {
    // malformed token — store a minimal placeholder
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'unknown', email: '', name: 'User', picture: null }))
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Return the raw JWT string, or null if not present. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Return the cached user object: { id, email, name, picture }
 * Returns null if not logged in.
 */
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch (_) {
    return null
  }
}

// ── Auth check ────────────────────────────────────────────────────────────────

/**
 * Returns true if a non-expired JWT is present in localStorage.
 *
 * Expiry is read from the `exp` claim (Unix seconds). If the token has no
 * `exp` claim (e.g. a dev token), it is treated as valid indefinitely.
 */
export function isAuthenticated() {
  const token = getToken()
  if (!token) return false

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      // token expired — clean up
      clearAuth()
      return false
    }
    return true
  } catch (_) {
    return false
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

/** Remove all auth data and navigate to the login screen. */
export function logout() {
  clearAuth()
  // clear the hash so the router lands on the login page
  window.location.hash = ''
  // force a page reload so all component state is reset
  window.location.reload()
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ── Dev helper ────────────────────────────────────────────────────────────────

/**
 * Inject a fake JWT for local development WITHOUT going through OAuth.
 * Run in the browser console:
 *   import('/src/utils/auth.js').then(m => m.devLogin())
 *
 * The token payload is { user_id, email, name } with no expiry.
 * Phase 2 replaces this with a real Google OAuth flow.
 */
export function devLogin() {
  // header.payload.signature — signature is ignored by our decode, only the
  // Go gateway verifies it, so this only works if JWT_SECRET signs it.
  // For quick UI dev, temporarily disable auth middleware or use this to
  // understand the shape of a valid token.
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    user_id: 'dev-user-001',
    email:   'dev@aether.local',
    name:    'Dev User',
    exp:     Math.floor(Date.now() / 1000) + 86400, // 24h
  }))
  const fakeToken = `${header}.${payload}.dev-signature`
  setToken(fakeToken)
  console.info('[auth] devLogin() — fake token set. Reload the page.')
}