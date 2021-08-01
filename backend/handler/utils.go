package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/bacchus-snu/reservation/config"
	"github.com/bacchus-snu/reservation/types"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/sirupsen/logrus"
)

type JWTPayload struct {
	Issuer   string `json:"iss"`
	Audience string `json:"aud"`
	Expire   int64  `json:"exp"`

	UserIdx       int    `json:"userIdx"`
	Username      string `json:"username"`
	PermissionIdx int    `json:"permission"`
}

func ParseToken(r *http.Request) (*JWTPayload, bool) {
	if config.Config.DevMode {
		return &JWTPayload{}, true
	}

	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return nil, false
	}
	tokenStr := h[7:]

	token, err := jwt.ParseSigned(tokenStr)
	if err != nil {
		logrus.WithError(err).Error("failed to parse token")
		return nil, false
	}

	payload := new(JWTPayload)
	if err := token.Claims(config.Config.JWTPublicKey, payload); err != nil {
		logrus.WithError(err).Error("failed to verify signature")
		return nil, false
	}

	if payload.Audience != config.Config.JWTAudience {
		return nil, false
	}

	if payload.Issuer != config.Config.JWTIssuer {
		return nil, false
	}

	now := time.Now().Unix()
	if payload.Expire <= now {
		return nil, false
	}

	return payload, true
}

func isAdmin(permissionIdx int) bool {
	return config.Config.AdminPermissionIdx == permissionIdx
}

func httpError(w http.ResponseWriter, statusCode int, msg string, errs ...error) {
	for _, err := range errs {
		logrus.WithError(err).Error(msg)
	}
	errResp := types.ErrorResp{
		Msg: msg,
	}
	w.WriteHeader(statusCode)
	b, _ := json.Marshal(errResp)
	w.Write(b)
}
