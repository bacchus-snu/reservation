package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/bacchus-snu/reservation/config"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/sirupsen/logrus"
)

type Payload struct {
	Issuer   string `json:"iss"`
	Audience string `json:"aud"`
	Expire   int64  `json:"exp"`

	UserIdx       int    `json:"userIdx"`
	Username      string `json:"username"`
	PermissionIdx int    `json:"permission"`
}

func verifyToken(r *http.Request) bool {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return false
	}
	tokenStr := h[7:]

	token, err := jwt.ParseSigned(tokenStr)
	if err != nil {
		logrus.WithError(err).Error("failed to parse token")
		return false
	}

	payload := new(Payload)
	if err := token.Claims(config.Config.JWTPublicKey, payload); err != nil {
		logrus.WithError(err).Error("failed to verify signature")
		return false
	}

	if payload.Audience != config.Config.JWTAudience {
		return false
	}

	if payload.Issuer != config.Config.JWTIssuer {
		return false
	}

	now := time.Now().Unix()
	if payload.Expire <= now {
		return false
	}

	return true
}
