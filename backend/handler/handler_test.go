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
	payload := handler.JWTPayload{
		Issuer:        config.Config.JWTIssuer,
		Audience:      config.Config.JWTAudience,
		Expire:        time.Now().Add(time.Second * 100).Unix(),
		UserIdx:       userIdx,
		Username:      username,
		PermissionIdx: permissionIdx,
	}
	return generateTokenWithPayload(&payload)
}

func generateTokenWithPayload(payload *handler.JWTPayload) (string, error) {
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
		_, validToken := handler.ParseToken(req)
		assert.False(t, validToken)
	}
	{
		// malformed token
		token, err := generateToken(1, "foo", 1)
		assert.Nil(t, err)

		req := httptest.NewRequest("POST", "/api", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token[:len(token)-3]))
		_, validToken := handler.ParseToken(req)
		assert.False(t, validToken)
	}
	{
		// invalid issuer
		payload := &handler.JWTPayload{
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
		_, validToken := handler.ParseToken(req)
		assert.False(t, validToken)
	}
	{
		// invalid audience
		payload := &handler.JWTPayload{
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
		_, validToken := handler.ParseToken(req)
		assert.False(t, validToken)
	}
	{
		// expired token
		payload := &handler.JWTPayload{
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
		_, validToken := handler.ParseToken(req)
		assert.False(t, validToken)
	}
	{
		// good token
		token, err := generateToken(1, "foo", 1)
		assert.Nil(t, err)

		req := httptest.NewRequest("POST", "/api", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		_, validToken := handler.ParseToken(req)
		assert.True(t, validToken)
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

	var tests = []struct {
		body types.AddScheduleReq
		want int
	}{
		// less than one repeats
		{
			types.AddScheduleReq{
				RoomId:         1,
				Reservee:       "doge",
				Email:          "doge@foo.com",
				PhoneNumber:    "010",
				Reason:         "bacchus",
				StartTimestamp: 10000,
				EndTimestamp:   11000,
				Repeats:        0,
			},
			http.StatusBadRequest,
		},

		// too many repeats
		{
			types.AddScheduleReq{
				RoomId:         1,
				Reservee:       "doge",
				Email:          "doge@foo.com",
				PhoneNumber:    "010",
				Reason:         "bacchus",
				StartTimestamp: 10000,
				EndTimestamp:   11000,
				Repeats:        config.Config.ScheduleRepeatLimit + 100,
			},
			http.StatusBadRequest,
		},

		// invalid time range
		{
			types.AddScheduleReq{
				RoomId:         1,
				Reservee:       "doge",
				Email:          "doge@foo.com",
				PhoneNumber:    "010",
				Reason:         "bacchus",
				StartTimestamp: 11000,
				EndTimestamp:   10000,
				Repeats:        1,
			},
			http.StatusBadRequest,
		},

		// invalid room
		{
			types.AddScheduleReq{
				RoomId:         123,
				Reservee:       "doge",
				Email:          "doge@foo.com",
				PhoneNumber:    "010",
				Reason:         "bacchus",
				StartTimestamp: 10000,
				EndTimestamp:   11000,
				Repeats:        1,
			},
			http.StatusBadRequest,
		},

		// ok
		{
			types.AddScheduleReq{
				RoomId:         room.Id,
				Reservee:       "doge",
				Email:          "doge@foo.com",
				PhoneNumber:    "010",
				Reason:         "bacchus",
				StartTimestamp: 10000,
				EndTimestamp:   11000,
				Repeats:        1,
			},
			http.StatusOK,
		},

		// overlapping time range
		{
			types.AddScheduleReq{
				RoomId:         room.Id,
				Reservee:       "doge",
				Email:          "doge@foo.com",
				PhoneNumber:    "010",
				Reason:         "bacchus",
				StartTimestamp: 10500,
				EndTimestamp:   11500,
				Repeats:        1,
			},
			http.StatusBadRequest,
		},

		// repeat
		{
			types.AddScheduleReq{
				RoomId:         room.Id,
				Reservee:       "doge",
				Email:          "doge@foo.com",
				PhoneNumber:    "010",
				Reason:         "bacchus",
				StartTimestamp: 11000,
				EndTimestamp:   12000,
				Repeats:        config.Config.ScheduleRepeatLimit,
			},
			http.StatusOK,
		},
	}

	for _, tc := range tests {
		b, err := json.Marshal(tc.body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, userIdx, username, permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, tc.want, resp.StatusCode)
	}
}

func TestHandleDeleteSchedule(t *testing.T) {
	require.Nil(t, sql.TruncateForTest("categories", "rooms", "schedule_groups", "schedules"))

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

	config.Config.AdminPermissionIdx = 9
	var users = []struct {
		userIdx       int
		username      string
		permissionIdx int
	}{
		{1, "doge", 1},
		{2, "foo", 1},
		{1000, "admin", config.Config.AdminPermissionIdx},
	}
	{
		body := types.AddScheduleReq{
			RoomId:         room.Id,
			Reservee:       "doge",
			Email:          "doge@doge.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 10000,
			EndTimestamp:   10500,
			Repeats:        1,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, users[0].userIdx, users[0].username, users[0].permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		require.Equal(t, resp.StatusCode, http.StatusOK)
	}
	{
		body := types.AddScheduleReq{
			RoomId:         room.Id,
			Reservee:       "foo",
			Email:          "foo@foo.com",
			PhoneNumber:    "010",
			Reason:         "bacchus2",
			StartTimestamp: 10500,
			EndTimestamp:   11000,
			Repeats:        1,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, users[1].userIdx, users[1].username, users[1].permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		require.Equal(t, resp.StatusCode, http.StatusOK)
	}
	{
		body := types.AddScheduleReq{
			RoomId:         room.Id,
			Reservee:       "doge",
			Email:          "doge@doge.com",
			PhoneNumber:    "010",
			Reason:         "bacchus",
			StartTimestamp: 11000,
			EndTimestamp:   11500,
			Repeats:        1,
		}
		b, err := json.Marshal(body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/add", bytes.NewReader(b))
		setJWTToken(t, req, users[0].userIdx, users[0].username, users[0].permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleAddSchedule(w, req)
		resp := w.Result()
		require.Equal(t, resp.StatusCode, http.StatusOK)
	}

	var schedules []*types.Schedule
	err = sql.WithTx(context.Background(), func(tx *sql.Tx) error {
		if schedules, err = tx.GetSchedules(room.Id, 10000, 11500); err != nil {
			return err
		}
		return nil
	})
	require.Nil(t, err)

	{
		// no jwt token
		req := httptest.NewRequest("POST", "/api/schedule/delete", nil)
		w := httptest.NewRecorder()

		handler.HandleDeleteSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	}
	{
		// empty body
		req := httptest.NewRequest("POST", "/api/schedule/delete", nil)
		setJWTToken(t, req, users[0].userIdx, users[0].username, users[0].permissionIdx)
		w := httptest.NewRecorder()

		handler.HandleDeleteSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}

	var tests = []struct {
		user struct {
			userIdx       int
			username      string
			permissionIdx int
		}
		body types.DeleteScheduleReq
		want int
	}{
		// ok
		{
			user: users[0],
			body: types.DeleteScheduleReq{
				ScheduleId:       schedules[2].Id,
				DeleteAllInGroup: false,
			},
			want: http.StatusOK,
		},
		// error - try to delete null schedule
		{
			user: users[0],
			body: types.DeleteScheduleReq{
				ScheduleId:       schedules[2].Id,
				DeleteAllInGroup: false,
			},
			want: http.StatusBadRequest,
		},
		// error - try to delete the schules of other reservee
		{
			user: users[1],
			body: types.DeleteScheduleReq{
				ScheduleId:       schedules[0].Id,
				DeleteAllInGroup: false,
			},
			want: http.StatusBadRequest,
		},
		// ok
		{
			user: users[1],
			body: types.DeleteScheduleReq{
				ScheduleId:       schedules[1].Id,
				DeleteAllInGroup: false,
			},
			want: http.StatusOK,
		},
		// ok - admin can delete any schedules
		{
			user: users[2],
			body: types.DeleteScheduleReq{
				ScheduleId:       schedules[0].Id,
				DeleteAllInGroup: false,
			},
			want: http.StatusOK,
		},
	}

	for num, tc := range tests {
		b, err := json.Marshal(tc.body)
		require.Nil(t, err)
		req := httptest.NewRequest("POST", "/api/schedule/delete", bytes.NewReader(b))
		setJWTToken(t, req, tc.user.userIdx, tc.user.username, tc.user.permissionIdx)
		w := httptest.NewRecorder()

		t.Log(tc)

		handler.HandleDeleteSchedule(w, req)
		resp := w.Result()
		assert.Equal(t, tc.want, resp.StatusCode, num)
	}
}
