package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/bacchus-snu/reservation/config"
	"github.com/bacchus-snu/reservation/sql"
	"github.com/bacchus-snu/reservation/types"
	"github.com/sirupsen/logrus"
)

const weekSec int64 = 60 * 60 * 24 * 7

func HandleAddSchedule(w http.ResponseWriter, r *http.Request) {
	var p *JWTPayload
	p, validToken := ParseToken(r)
	if !validToken {
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
			UserIdx:     int64(p.UserIdx),
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
				RoomId:          req.RoomId,
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
	var p *JWTPayload
	p, validToken := ParseToken(r)
	if !validToken {
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
		schedule, err := tx.GetScheduleById(req.ScheduleId)
		if err != nil {
			return err
		}
		scheduleGroup, err := tx.GetScheduleGroupById(schedule.ScheduleGroupId)
		if err != nil {
			return err
		}
		if scheduleGroup.UserIdx != int64(p.UserIdx) && !isAdmin(p.PermissionIdx) {
			return errors.New("you are not the owner of schedule")
		}
		if req.DeleteAllInGroup {
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

func HandleGetSchedule(w http.ResponseWriter, r *http.Request) {
	var req types.GetScheduleReq
	qs := r.URL.Query()
	rid, err := strconv.ParseInt(qs.Get("roomId"), 10, 64)
	if err != nil {
		httpError(w, http.StatusBadRequest, "cannot parse query value", err)
		return
	}
	sts, err := strconv.ParseInt(qs.Get("startTimestamp"), 10, 64)
	if err != nil {
		httpError(w, http.StatusBadRequest, "cannot parse query value", err)
		return
	}
	ets, err := strconv.ParseInt(qs.Get("endTimestamp"), 10, 64)
	if err != nil {
		httpError(w, http.StatusBadRequest, "cannot parse query value", err)
		return
	}
	req.RoomId = rid
	req.StartTimestamp = sts
	req.EndTimestamp = ets

	if req.StartTimestamp >= req.EndTimestamp {
		httpError(w, http.StatusBadRequest, "invalid time range")
		return
	}
	if req.EndTimestamp-req.StartTimestamp > int64(config.Config.ScheduleTimeRangeLimit.Seconds()) {
		httpError(w, http.StatusBadRequest, "time range is too wide")
		return
	}

	var (
		schedules []*types.Schedule
	)
	ctx := context.Background()
	err = sql.WithTx(ctx, func(tx *sql.Tx) error {
		schedules_, err := tx.GetSchedules(req.RoomId, req.StartTimestamp, req.EndTimestamp)
		if err != nil {
			return err
		}
		schedules = schedules_
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to get schedule", err)
		return
	}

	var resp types.GetScheduleResp
	if len(schedules) == 0 {
		resp.Schedules = make([]*types.Schedule, 0)
	} else {
		resp.Schedules = schedules
	}

	if b, err := json.Marshal(&resp); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to marshal response", err)
		return
	} else {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write(b); err != nil {
			logrus.WithError(err).Error("failed to write success response")
		}
	}
}

func HandleGetScheduleInfo(w http.ResponseWriter, r *http.Request) {
	var p *JWTPayload
	p, validToken := ParseToken(r)
	if !validToken {
		httpError(w, http.StatusUnauthorized, "failed to verify token")
		return
	}

	var req types.GetScheduleInfoReq
	qs := r.URL.Query()
	sgid, err := strconv.ParseInt(qs.Get("scheduleGroupId"), 10, 64)
	if err != nil {
		httpError(w, http.StatusBadRequest, "cannot parse query value", err)
		return
	}
	req.ScheduleGroupId = sgid

	var (
		resp *types.ScheduleGroup
	)
	ctx := context.Background()
	err = sql.WithTx(ctx, func(tx *sql.Tx) error {
		scheduleGroup, err := tx.GetScheduleGroupById(req.ScheduleGroupId)
		if err != nil {
			return err
		}
		if scheduleGroup.UserIdx != int64(p.UserIdx) && !isAdmin(p.PermissionIdx) {
			return errors.New("you are not the owner of schedule")
		}
		resp = scheduleGroup
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to read schedule", err)
		return
	}

	if b, err := json.Marshal(&resp); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to marshal response", err)
		return
	} else {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write(b); err != nil {
			logrus.WithError(err).Error("failed to write success response")
		}
	}
}

func HandleGetRoomsAndCategories(w http.ResponseWriter, r *http.Request) {
	var (
		resp *types.GetRoomsAndCategoriesResp
	)
	ctx := context.Background()
	err := sql.WithTx(ctx, func(tx *sql.Tx) error {
		categories, err := tx.GetAllCategories()
		if err != nil {
			return err
		}
		rooms, err := tx.GetAllRooms()
		if err != nil {
			return err
		}

		resp.Categories = categories
		resp.Rooms = rooms
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to get rooms and categories", err)
		return
	}

	if b, err := json.Marshal(&resp); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to marshal response", err)
		return
	} else {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write(b); err != nil {
			logrus.WithError(err).Error("failed to write success response")
		}
	}
}

func HandleAddRoom(w http.ResponseWriter, r *http.Request) {
	var p *JWTPayload
	p, validToken := ParseToken(r)
	if !validToken {
		httpError(w, http.StatusUnauthorized, "failed to verify token")
		return
	}
	if !isAdmin(p.PermissionIdx) {
		httpError(w, http.StatusUnauthorized, "admin only")
	}

	b, err := io.ReadAll(r.Body)
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to read req body", err)
		return
	}

	var req types.AddRoomReq
	if err := json.NewDecoder(bytes.NewReader(b)).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "failed to deserialize req body", err)
		return
	}

	ctx := context.Background()
	err = sql.WithTx(ctx, func(tx *sql.Tx) error {
		room := &types.Room{
			Name:       req.Name,
			Seats:      req.Seats,
			CategoryId: req.CategoryId,
		}
		if err := tx.AddRoom(room); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to add room", err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(b); err != nil {
		logrus.WithError(err).Error("failed to write success response")
	}
}

func HandleAddCategory(w http.ResponseWriter, r *http.Request) {
	var p *JWTPayload
	p, validToken := ParseToken(r)
	if !validToken {
		httpError(w, http.StatusUnauthorized, "failed to verify token")
		return
	}
	if !isAdmin(p.PermissionIdx) {
		httpError(w, http.StatusUnauthorized, "admin only")
	}

	b, err := io.ReadAll(r.Body)
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to read req body", err)
		return
	}

	var req types.AddCategoryReq
	if err := json.NewDecoder(bytes.NewReader(b)).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "failed to deserialize req body", err)
		return
	}

	ctx := context.Background()
	err = sql.WithTx(ctx, func(tx *sql.Tx) error {
		category := &types.Category{
			Name:        req.Name,
			Description: req.Description,
		}
		if err := tx.AddCategory(category); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to add category", err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(b); err != nil {
		logrus.WithError(err).Error("failed to write success response")
	}
}

func HandleDeleteRoom(w http.ResponseWriter, r *http.Request) {
	var p *JWTPayload
	p, validToken := ParseToken(r)
	if !validToken {
		httpError(w, http.StatusUnauthorized, "failed to verify token")
		return
	}
	if !isAdmin(p.PermissionIdx) {
		httpError(w, http.StatusUnauthorized, "admin only")
	}

	b, err := io.ReadAll(r.Body)
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to read req body", err)
		return
	}

	var req types.DeleteRoomReq
	if err := json.NewDecoder(bytes.NewReader(b)).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "failed to deserialize req body", err)
		return
	}

	ctx := context.Background()
	err = sql.WithTx(ctx, func(tx *sql.Tx) error {
		if err := tx.DeleteRoom(req.RoomId); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		httpError(w, http.StatusBadRequest, "failed to delete room", err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(b); err != nil {
		logrus.WithError(err).Error("failed to write success response")
	}
}
