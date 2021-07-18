package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/bacchus-snu/reservation/config"
	"github.com/bacchus-snu/reservation/sql"
	"github.com/bacchus-snu/reservation/types"
	"github.com/sirupsen/logrus"
)

const weekSec int64 = 60 * 60 * 24 * 7

func HandleAddSchedule(w http.ResponseWriter, r *http.Request) {
	if !VerifyToken(r) {
		httpError(w, http.StatusUnauthorized, "failed to verify token")
		return
	}

	b, err := io.ReadAll(r.Body)
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to read req body", err)
		return
	}

	var req types.AddScheduleReq
	if err := json.NewDecoder(bytes.NewReader(b)).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "failed to deserialize req body", err)
		return
	}

	if req.Repeats <= 0 {
		httpError(w, http.StatusBadRequest, "repeats is less than 1")
		return
	}
	if config.Config.ScheduleRepeatLimit < req.Repeats {
		httpError(w, http.StatusBadRequest, "too many repeats")
		return
	}
	if req.StartTimestamp >= req.EndTimestamp {
		httpError(w, http.StatusBadRequest, "invalid time range")
		return
	}

	ctx := context.Background()
	err = sql.WithTx(ctx, func(tx *sql.Tx) error {
		g := &types.ScheduleGroup{
			RoomId:      req.RoomId,
			Reservee:    req.Reservee,
			Email:       req.Email,
			PhoneNumber: req.PhoneNumber,
			Reason:      req.Reason,
		}
		if err := tx.AddScheduleGroup(g); err != nil {
			return err
		}

		for i := 0; i < req.Repeats; i++ {
			startTs := req.StartTimestamp + (int64(i) * weekSec)
			endTs := req.EndTimestamp + (int64(i) * weekSec)
			s := &types.Schedule{
				ScheduleGroupId: g.Id,
				StartTimestamp:  startTs,
				EndTimestamp:    endTs,
			}

			if err := tx.AddSchedule(s); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to add schedule", err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte("ok")); err != nil {
		logrus.WithError(err).Error("failed to write success response")
	}
}

func HandleDeleteSchedule(w http.ResponseWriter, r *http.Request) {
	if !VerifyToken(r) {
		httpError(w, http.StatusUnauthorized, "failed to verify token")
		return
	}

	b, err := io.ReadAll(r.Body)
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to read req body", err)
		return
	}

	var req types.DeleteScheduleReq
	if err := json.NewDecoder(bytes.NewReader(b)).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "failed to deserialize req body", err)
		return
	}

	ctx := context.Background()
	err = sql.WithTx(ctx, func(tx *sql.Tx) error {
		if req.DeleteAllInGroup {
			schedule, err := tx.GetScheduleById(req.ScheduleId)
			if err != nil {
				return err
			}
			if err := tx.DeleteScheduleGroup(schedule.ScheduleGroupId); err != nil {
				return err
			}
		} else {
			if err := tx.DeleteSchedule(req.ScheduleId); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to add schedule", err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte("ok")); err != nil {
		logrus.WithError(err).Error("failed to write success response")
	}
}
