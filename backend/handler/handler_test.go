package handler_test

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"
	mathrand "math/rand"
	"os"

	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bacchus-snu/reservation/config"
	"github.com/bacchus-snu/reservation/handler"
	"github.com/bacchus-snu/reservation/sql"
	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var jwtPrivateKey *ecdsa.PrivateKey

func TestMain(m *testing.M) {
	initTest()
	code := m.Run()
	os.Exit(code)
}

func initTest() {
	mathrand.Seed(time.Now().UTC().UnixNano())
	os.Setenv("IS_TEST", "true")
	if err := config.Parse(); err != nil {
		panic(err)
	}
	if err := sql.Connect(); err != nil {
		panic(err)
	}

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}
	config.Config.JWTPublicKey = &priv.PublicKey
	jwtPrivateKey = priv
}

func setJWTToken(t *testing.T, r *http.Request, userIdx int, username string, permissionIdx int) {
	token, err := generateToken(userIdx, username, permissionIdx)
	require.Nil(t, err)
	r.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
}

func generateToken(userIdx int, username string, permissionIdx int) (string, error) {
	payload := handler.Payload{
		Issuer:        config.Config.JWTIssuer,
		Audience:      config.Config.JWTAudience,
		Expire:        time.Now().Add(time.Second * 100).Unix(),
		UserIdx:       userIdx,
		Username:      username,
		PermissionIdx: permissionIdx,
	}
	return generateTokenWithPayload(&payload)
}

func generateTokenWithPayload(payload *handler.Payload) (string, error) {
	if jwtPrivateKey == nil {
		panic("private key is not provided")
	}
	signingKey := jose.SigningKey{Algorithm: jose.ES256, Key: jwtPrivateKey}
	signer, err := jose.NewSigner(signingKey, nil)
	if err != nil {
		return "", err
	}
	builder := jwt.Signed(signer)
	builder = builder.Claims(payload)
	return builder.CompactSerialize()
}

func TestJWT(t *testing.T) {
	{
		// no authorization header
		req := httptest.NewRequest("POST", "/api", nil)
		assert.False(t, handler.VerifyToken(req))
	}
	{
		// malformed token
		token, err := generateToken(1, "foo", 1)
		assert.Nil(t, err)

		req := httptest.NewRequest("POST", "/api", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token[:len(token)-3]))
		assert.False(t, handler.VerifyToken(req))
	}
	{
		// invalid issuer
		payload := &handler.Payload{
			Issuer:        "doge",
			Audience:      config.Config.JWTAudience,
			Expire:        time.Now().Add(time.Second * 100).Unix(),
			UserIdx:       1,
			Username:      "foo",
			PermissionIdx: 1,
		}
		token, err := generateTokenWithPayload(payload)
		assert.Nil(t, err)

		req := httptest.NewRequest("POST", "/api", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token[:len(token)-3]))
		assert.False(t, handler.VerifyToken(req))
	}
	{
		// invalid audience
		payload := &handler.Payload{
			Issuer:        config.Config.JWTIssuer,
			Audience:      "doge",
			Expire:        time.Now().Add(time.Second * 100).Unix(),
			UserIdx:       1,
			Username:      "foo",
			PermissionIdx: 1,
		}
		token, err := generateTokenWithPayload(payload)
		assert.Nil(t, err)

		req := httptest.NewRequest("POST", "/api", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token[:len(token)-3]))
		assert.False(t, handler.VerifyToken(req))
	}
	{
		// expired token
		payload := &handler.Payload{
			Issuer:        config.Config.JWTIssuer,
			Audience:      config.Config.JWTAudience,
			Expire:        time.Now().Add(-time.Second * 100).Unix(),
			UserIdx:       1,
			Username:      "foo",
			PermissionIdx: 1,
		}
		token, err := generateTokenWithPayload(payload)
		assert.Nil(t, err)

		req := httptest.NewRequest("POST", "/api", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token[:len(token)-3]))
		assert.False(t, handler.VerifyToken(req))
	}
	{
		// good token
		token, err := generateToken(1, "foo", 1)
		assert.Nil(t, err)

		req := httptest.NewRequest("POST", "/api", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		assert.True(t, handler.VerifyToken(req))
	}
}
