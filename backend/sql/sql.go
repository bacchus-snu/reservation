package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
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

var (
	ErrNoRowAffected = errors.New("no rows affected")
)

var db *sql.DB

func Connect() error {
	if db != nil {
		panic("db already initialized")
	}

	connStr := fmt.Sprintf(
		"user=%s password=%s dbname=%s host=%s port=%d sslmode=disable",
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

func TruncateForTest(tableName ...string) error {
	if !config.Config.IsTest {
		panic("this function should be called only in test")
	}
	_, err := db.Exec(fmt.Sprintf("truncate %s", strings.Join(tableName, ",")))
	if err != nil {
		return err
	}
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
	res, err := tx.tx.Exec(query, categoryId)
	if err != nil {
		return err
	}
	if affected, err := res.RowsAffected(); err != nil {
		return err
	} else if affected <= 0 {
		return ErrNoRowAffected
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
	res, err := tx.tx.Exec(query, roomId)
	if err != nil {
		return err
	}
	if affected, err := res.RowsAffected(); err != nil {
		return err
	} else if affected <= 0 {
		return ErrNoRowAffected
	}
	return nil
}

func (tx *Tx) GetScheduleGroupById(id int64) (*types.ScheduleGroup, error) {
	query := "select room_id, user_idx, reservee, email, phone_number, reason from schedules where id = $1"
	row := tx.tx.QueryRow(query, id)

	var (
		roomId      int64
		userIdx     int64
		reservee    string
		email       string
		phoneNumber string
		reason      string
	)
	if err := row.Scan(&roomId, &userIdx, &reservee, &email, &phoneNumber, &reason); err != nil {
		return nil, err
	}
	sg := &types.ScheduleGroup{
		Id:          id,
		RoomId:      roomId,
		UserIdx:     userIdx,
		Reservee:    reservee,
		Email:       email,
		PhoneNumber: phoneNumber,
		Reason:      reason,
	}
	return sg, nil
}

func (tx *Tx) AddScheduleGroup(group *types.ScheduleGroup) error {
	if group == nil {
		return errors.New("group is nil")
	}
	query := "insert into schedule_groups (room_id, user_idx, reservee, email, phone_number, reason) values ($1, $2, $3, $4, $5, $6) returning id"
	row := tx.tx.QueryRow(query, group.RoomId, group.UserIdx, group.Reservee, group.Email, group.PhoneNumber, group.Reason)
	var id int64
	if err := row.Scan(&id); err != nil {
		return err
	}
	group.Id = id
	return nil
}

func (tx *Tx) DeleteScheduleGroup(groupId int64) error {
	query := "delete from groups where id = $1"
	res, err := tx.tx.Exec(query, groupId)
	if err != nil {
		return err
	}
	if affected, err := res.RowsAffected(); err != nil {
		return err
	} else if affected <= 0 {
		return ErrNoRowAffected
	}
	return nil
}

func (tx *Tx) GetSchedules(roomId int64, startTimestamp int64, endTimestamp int64) ([]*types.Schedule, error) {
	if endTimestamp <= startTimestamp {
		return nil, errors.New("invalid time range")
	}
	query := `
select s.id, s.room_id, s.schedule_group_id, sg.reservee, extract(epoch from lower(s.during))::bigint, extract(epoch from upper(s.during))::bigint
from schedules s
inner join schedule_groups sg on (s.schedule_group_id = sg.id)
where s.room_id = $1 and s.during <@ tstzrange(to_timestamp($2), to_timestamp($3), '[)')
`
	rows, err := tx.tx.Query(query, roomId, startTimestamp, endTimestamp)
	if err != nil {
		return nil, err
	}

	var schedules []*types.Schedule
	for rows.Next() {
		var (
			id              int64
			roomId          int64
			scheduleGroupId int64
			reservee        string
			startTimestamp  int64
			endTimestamp    int64
		)
		if err := rows.Scan(&id, &roomId, &scheduleGroupId, &reservee, &startTimestamp, &endTimestamp); err != nil {
			if err := rows.Close(); err != nil {
				return nil, err
			}
			return nil, err
		}
		schedule := &types.Schedule{
			Id:              id,
			RoomId:          roomId,
			ScheduleGroupId: scheduleGroupId,
			Reservee:        reservee,
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

func (tx *Tx) GetScheduleById(id int64) (*types.Schedule, error) {
	query := "select room_id, schedule_group_id, extract(epoch from lower(during))::bigint, extract(epoch from upper(during))::bigint from schedules where id = $1"
	row := tx.tx.QueryRow(query, id)

	var (
		roomId          int64
		scheduleGroupId int64
		startTimestamp  int64
		endTimestamp    int64
	)
	if err := row.Scan(&roomId, &scheduleGroupId, &startTimestamp, &endTimestamp); err != nil {
		return nil, err
	}
	schedule := &types.Schedule{
		Id:              id,
		RoomId:          roomId,
		ScheduleGroupId: scheduleGroupId,
		StartTimestamp:  startTimestamp,
		EndTimestamp:    endTimestamp,
	}
	return schedule, nil
}

func (tx *Tx) AddSchedule(schedule *types.Schedule) error {
	if schedule == nil {
		return errors.New("schedule is nil")
	}
	query := "insert into schedules (room_id, schedule_group_id, during) values ($1, $2, tstzrange(to_timestamp($3), to_timestamp($4), '[)')) returning id"
	row := tx.tx.QueryRow(query, schedule.RoomId, schedule.ScheduleGroupId, schedule.StartTimestamp, schedule.EndTimestamp)
	var id int64
	if err := row.Scan(&id); err != nil {
		return err
	}
	schedule.Id = id
	return nil
}

func (tx *Tx) DeleteSchedule(id int64) error {
	query := "delete from schedules where id = $1"
	res, err := tx.tx.Exec(query, id)
	if err != nil {
		return err
	}
	if affected, err := res.RowsAffected(); err != nil {
		return err
	} else if affected <= 0 {
		return ErrNoRowAffected
	}
	return nil
}
