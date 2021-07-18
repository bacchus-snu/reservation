package handler_test

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
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
	"github.com/bacchus-snu/reservation/types"
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

func TestHandleAddSchedule(t *testing.T) {
	require.Nil(t, sql.TruncateForTest("categories", "rooms", "schedule_groups", "schedules"))
	{
		// no jwt token
		req := httptest.NewRequest("POST", "/api/schedule/add", nil)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	}
	var (
		userIdx       = 1
		username      = "doge"
		permissionIdx = 1
	)
	{
		// empty body
		req := httptest.NewRequest("POST", "/api/schedule/add", nil)
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}
	config.Config.ScheduleRepeatLimit = 10
	{
		// less than one repeats
		body := types.AddScheduleReq{
			RoomId:         1,
			Reservee:       "doge",
			Email:          "doge@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 10000,
			EndTimestamp:   11000,
			Repeats:        0,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}
	{
		// too many repeats
		body := types.AddScheduleReq{
			RoomId:         1,
			Reservee:       "doge",
			Email:          "doge@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 10000,
			EndTimestamp:   11000,
			Repeats:        config.Config.ScheduleRepeatLimit + 100,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}
	{
		// invalid time range
		body := types.AddScheduleReq{
			RoomId:         1,
			Reservee:       "doge",
			Email:          "doge@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 11000,
			EndTimestamp:   10000,
			Repeats:        1,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}
	{
		// invalid room
		body := types.AddScheduleReq{
			RoomId:         123,
			Reservee:       "doge",
			Email:          "doge@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 10000,
			EndTimestamp:   11000,
			Repeats:        1,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}
	category := &types.Category{
		Name:        "test category",
		Description: "test category description",
	}
	err := sql.WithTx(context.Background(), func(tx *sql.Tx) error {
		if err := tx.AddCategory(category); err != nil {
			return err
		}
		return nil
	})
	require.Nil(t, err)
	room := &types.Room{
		Name:       "test room",
		Seats:      10,
		CategoryId: category.Id,
	}
	err = sql.WithTx(context.Background(), func(tx *sql.Tx) error {
		if err := tx.AddRoom(room); err != nil {
			return err
		}
		return nil
	})
	require.Nil(t, err)

	{
		// ok
		body := types.AddScheduleReq{
			RoomId:         room.Id,
			Reservee:       "doge",
			Email:          "doge@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 10000,
			EndTimestamp:   11000,
			Repeats:        1,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	}
	{
		// overlapping time range
		body := types.AddScheduleReq{
			RoomId:         room.Id,
			Reservee:       "doge",
			Email:          "doge@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 10500,
			EndTimestamp:   11500,
			Repeats:        1,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}
	{
		// repeat
		body := types.AddScheduleReq{
			RoomId:         room.Id,
			Reservee:       "doge",
			Email:          "doge@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 11000,
			EndTimestamp:   12000,
			Repeats:        config.Config.ScheduleRepeatLimit,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	}
}
