package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// AuthHandler implements Google OAuth2 login.
//
// Flow:
//   GET /auth/google          → redirect to Google consent screen
//   GET /auth/google/callback → exchange code → create JWT → redirect to frontend
type AuthHandler struct {
	cfg         *oauth2.Config
	jwtSecret   string
	frontendURL string // e.g. "http://localhost:5173"
}

func NewAuthHandler(clientID, clientSecret, redirectURL, jwtSecret, frontendURL string) *AuthHandler {
	return &AuthHandler{
		cfg: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL, // must match Google Cloud Console exactly
			Scopes: []string{
				"openid",
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			},
			Endpoint: google.Endpoint,
		},
		jwtSecret:   jwtSecret,
		frontendURL: frontendURL,
	}
}

// ── GET /auth/google ──────────────────────────────────────────────────────────
// Generates a CSRF state token, stores it in a short-lived cookie, then
// redirects the user to Google's OAuth consent page.

func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	state, err := randomState()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate state"})
		return
	}

	// SameSite=Lax is required: the callback arrives as a top-level navigation
	// from Google (cross-site redirect), so Strict would block the cookie.
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		MaxAge:   600, // 10 minutes — more than enough for consent
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	url := h.cfg.AuthCodeURL(state, oauth2.AccessTypeOnline)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

// ── GET /auth/google/callback ─────────────────────────────────────────────────
// Verifies the CSRF state, exchanges the authorization code for an access
// token, fetches the user's Google profile, signs a JWT, and redirects the
// browser to the frontend with the JWT in the query string.

func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	// ── 1. verify CSRF state ──────────────────────────────────────────────────
	cookieState, err := c.Cookie("oauth_state")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing state cookie — OAuth flow may have expired"})
		return
	}
	if cookieState != c.Query("state") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OAuth state mismatch — possible CSRF attack"})
		return
	}

	// clear the state cookie immediately — it is single-use
	http.SetCookie(c.Writer, &http.Cookie{
		Name:   "oauth_state",
		Value:  "",
		MaxAge: -1,
		Path:   "/",
	})

	// ── 2. check for OAuth error from Google ──────────────────────────────────
	if errParam := c.Query("error"); errParam != "" {
		// user declined consent or another error occurred
		c.Redirect(http.StatusTemporaryRedirect, h.frontendURL+"?auth_error="+errParam)
		return
	}

	// ── 3. exchange authorization code for access token ───────────────────────
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing authorization code"})
		return
	}

	oauthToken, err := h.cfg.Exchange(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code exchange failed: " + err.Error()})
		return
	}

	// ── 4. fetch Google user profile ──────────────────────────────────────────
	profile, err := fetchGoogleProfile(c.Request.Context(), h.cfg, oauthToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch profile: " + err.Error()})
		return
	}

	// ── 5. sign JWT ───────────────────────────────────────────────────────────
	signedJWT, err := signJWT(profile, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign JWT"})
		return
	}

	// ── 6. redirect to frontend ───────────────────────────────────────────────
	// The frontend reads ?token= from the URL, saves it to localStorage,
	// then strips it from the URL so it never appears in browser history.
	c.Redirect(http.StatusTemporaryRedirect,
		fmt.Sprintf("%s?token=%s", h.frontendURL, signedJWT),
	)
}

// ── Google profile ────────────────────────────────────────────────────────────

type googleProfile struct {
	Sub     string `json:"sub"`     // stable unique user ID
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"` // profile photo URL
}

func fetchGoogleProfile(ctx context.Context, cfg *oauth2.Config, token *oauth2.Token) (*googleProfile, error) {
	// Use the OAuth client (automatically attaches the bearer token)
	client := cfg.Client(ctx, token)

	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("userinfo returned %d: %s", resp.StatusCode, body)
	}

	var profile googleProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}
	if profile.Sub == "" {
		return nil, fmt.Errorf("userinfo missing sub field")
	}
	return &profile, nil
}

// ── JWT ───────────────────────────────────────────────────────────────────────

func signJWT(profile *googleProfile, secret string) (string, error) {
	claims := jwt.MapClaims{
		// standard claims
		"exp": time.Now().Add(24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
		// aether claims — read by the Go auth middleware + frontend
		"user_id": profile.Sub,
		"email":   profile.Email,
		"name":    profile.Name,
		"picture": profile.Picture,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ── helpers ───────────────────────────────────────────────────────────────────

func randomState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}