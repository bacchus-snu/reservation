package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/bacchus-snu/reservation/config"
	"github.com/bacchus-snu/reservation/types"
	goerrors "github.com/go-errors/errors"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
)

const (
	maxIdleConns    = 5
	maxOpenConns    = 10
	maxConnLifetime = time.Minute * 5
)

var db *sql.DB

func Connect() error {
	if db != nil {
		panic("db already initialized")
	}

	connStr := fmt.Sprintf(
		"user=%s password=%s dbname=%s host=%s port=%d",
		config.Config.SQLUser,
		config.Config.SQLPassword,
		config.Config.SQLDBName,
		config.Config.SQLHost,
		config.Config.SQLPort,
	)
	db_, err := sql.Open("postgres", connStr)
	if err != nil {
		return err
	}

	db = db_
	return nil
}

type Tx struct {
	tx *sql.Tx
}

func WithTx(ctx context.Context, f func(*Tx) error) (retErr error) {
	var shouldRollback bool
	tx, err := db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		recovered := recover()
		if recovered != nil {
			panicErr := goerrors.Wrap(recovered, 1)
			logrus.WithField("stack_trace", panicErr.ErrorStack()).WithError(panicErr).Errorln("panicked at WithTx")
			shouldRollback = true
			retErr = panicErr
		}

		if shouldRollback {
			if err := tx.Rollback(); err != nil {
				logrus.WithError(err).Errorln("failed to rollback")
				retErr = err
			}
		} else {
			if err := tx.Commit(); err != nil {
				logrus.WithError(err).Errorln("failed to commit")
				retErr = err
			}
		}
	}()
	txWrap := &Tx{tx: tx}
	if err := f(txWrap); err != nil {
		shouldRollback = true
		return err
	}

	return
}

func (tx *Tx) GetAllCategories() ([]*types.Category, error) {
	query := "select id, name, description from categories"
	rows, err := tx.tx.Query(query)
	if err != nil {
		return nil, err
	}

	var categories []*types.Category
	for rows.Next() {
		var (
			id          int64
			name        string
			description string
		)
		if err := rows.Scan(&id, &name, &description); err != nil {
			if err := rows.Close(); err != nil {
				return nil, err
			}
			return nil, err
		}
		category := &types.Category{
			Id:          id,
			Name:        name,
			Description: description,
		}
		categories = append(categories, category)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}

	return categories, nil
}

func (tx *Tx) AddCategory(category *types.Category) error {
	if category == nil {
		return errors.New("category is nil")
	}
	query := "insert into categories (name, description) values ($1, $2) returning id"
	row := tx.tx.QueryRow(query, category.Name, category.Description)
	var id int64
	if err := row.Scan(&id); err != nil {
		return err
	}
	category.Id = id
	return nil
}

func (tx *Tx) DeleteCategory(categoryId int64) error {
	query := "delete from categories where id = $1"
	_, err := tx.tx.Exec(query, categoryId)
	if err != nil {
		return err
	}
	return nil
}

func (tx *Tx) GetAllRooms() ([]*types.Room, error) {
	query := "select id, name, seats, category_id from rooms"
	rows, err := tx.tx.Query(query)
	if err != nil {
		return nil, err
	}

	var rooms []*types.Room
	for rows.Next() {
		var (
			id         int64
			name       string
			seats      int
			categoryId sql.NullInt64
		)
		if err := rows.Scan(&id, &name, &seats, &categoryId); err != nil {
			if err := rows.Close(); err != nil {
				return nil, err
			}
			return nil, err
		}
		var c int64
		if categoryId.Valid {
			c = categoryId.Int64
		} else {
			c = -1
		}
		room := &types.Room{
			Id:         id,
			Name:       name,
			Seats:      seats,
			CategoryId: c,
		}
		rooms = append(rooms, room)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}

	return rooms, nil
}

func (tx *Tx) AddRoom(room *types.Room) error {
	if room == nil {
		return errors.New("room is nil")
	}
	query := "insert into rooms (name, seats, category_id) values ($1, $2, $3) returning id"
	row := tx.tx.QueryRow(query, room.Name, room.Seats, room.CategoryId)
	var id int64
	if err := row.Scan(&id); err != nil {
		return err
	}
	room.Id = id
	return nil
}

func (tx *Tx) DeleteRoom(roomId int64) error {
	query := "delete from rooms where id = $1"
	_, err := tx.tx.Exec(query, roomId)
	if err != nil {
		return err
	}
	return nil
}

func (tx *Tx) AddScheduleGroup(group *types.ScheduleGroup) error {
	if group == nil {
		return errors.New("group is nil")
	}
	query := "insert into schedule_groups (room_id, reservee, email, phone_number, reason) values ($1, $2, $3, $4, $5) returning id"
	row := tx.tx.QueryRow(query, group.RoomId, group.Reservee, group.Email, group.PhoneNumber, group.Reason)
	var id int64
	if err := row.Scan(&id); err != nil {
		return err
	}
	group.Id = id
	return nil
}

func (tx *Tx) DeleteScheduleGroup(groupId int64) error {
	query := "delete from groups where id = $1"
	_, err := tx.tx.Exec(query, groupId)
	if err != nil {
		return err
	}
	return nil
}

func (tx *Tx) GetSchedules(startTimestamp int64, endTimestamp int64) ([]*types.Schedule, error) {
	if endTimestamp <= startTimestamp {
		return nil, errors.New("invalid time range")
	}
	query := "select id, schedule_group_id, extract(epoch from lower(during)), extract(epoch from upper(during)) from schedules where during <@ tstzrange(to_timestamp($1), to_timestamp($2), '[)')"
	rows, err := tx.tx.Query(query)
	if err != nil {
		return nil, err
	}

	var schedules []*types.Schedule
	for rows.Next() {
		var (
			id              int64
			scheduleGroupId int64
			startTimestamp  int64
			endTimestamp    int64
		)
		if err := rows.Scan(&id, &scheduleGroupId, &startTimestamp, &endTimestamp); err != nil {
			if err := rows.Close(); err != nil {
				return nil, err
			}
			return nil, err
		}
		schedule := &types.Schedule{
			Id:              id,
			ScheduleGroupId: scheduleGroupId,
			StartTimestamp:  startTimestamp,
			EndTimestamp:    endTimestamp,
		}
		schedules = append(schedules, schedule)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}

	return schedules, nil
}

func (tx *Tx) AddSchedule(schedule *types.Schedule) error {
	if schedule == nil {
		return errors.New("schedule is nil")
	}
	query := "insert into schedules (schedule_group_id, during) values ($1, tstzrange(to_timestamp($2), to_timestamp($3), '[)')) returning id"
	row := tx.tx.QueryRow(query, schedule.ScheduleGroupId, schedule.StartTimestamp, schedule.EndTimestamp)
	var id int64
	if err := row.Scan(&id); err != nil {
		return err
	}
	schedule.Id = id
	return nil
}

func (tx *Tx) DeleteSchedule(id int64) error {
	query := "delete from schedules where id = $1"
	_, err := tx.tx.Exec(query, id)
	if err != nil {
		return err
	}
	return nil
}
