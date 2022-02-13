package types

type Category struct {
	Id          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Room struct {
	Id         int64  `json:"id"`
	Name       string `json:"name"`
	Seats      int    `json:"seats"`
	CategoryId int64  `json:"categoryId"`
}

type ScheduleGroup struct {
	Id          int64  `json:"id"`
	RoomId      int64  `json:"roomId"`
	UserIdx     int64  `json:"userIdx"`
	Reservee    string `json:"reservee"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phoneNumber"`
	Reason      string `json:"reason"`
}

type Schedule struct {
	Id              int64  `json:"id"`
	RoomId          int64  `json:"roomId"`
	ScheduleGroupId int64  `json:"scheduleGroupId"`
	Reservee        string `json:"reservee"`
	StartTimestamp  int64  `json:"startTimestamp"`
	EndTimestamp    int64  `json:"endTimestamp"`
}

type ErrorResp struct {
	Msg string `json:"msg"`
}

type AddScheduleReq struct {
	RoomId         int64  `json:"roomId"`
	Reservee       string `json:"reservee"`
	Email          string `json:"email"`
	PhoneNumber    string `json:"phoneNumber"`
	Reason         string `json:"reason"`
	StartTimestamp int64  `json:"startTimestamp"`
	EndTimestamp   int64  `json:"endTimestamp"`
	Repeats        int    `json:"repeats"`
}

type DeleteScheduleReq struct {
	ScheduleId       int64 `json:"scheduleId"`
	DeleteAllInGroup bool  `json:"deleteAllInGroup"`
}

type GetScheduleReq struct {
	RoomId         int64 `json:"roomId"`
	StartTimestamp int64 `json:"startTimestamp"`
	EndTimestamp   int64 `json:"endTimestamp"`
}

type GetScheduleInfoReq struct {
	ScheduleGroupId int64 `json:"schedule_group_id"`
}

type GetScheduleResp struct {
	Schedules []*Schedule `json:"schedules"`
}

type GetRoomsAndCategoriesResp struct {
	Categories []*Category `json:"categories"`
	Rooms      []*Room     `json:"rooms"`
}

type AddRoomReq struct {
	Name       string `json:"name"`
	Seats      int    `json:"seats"`
	CategoryId int64  `json:"categoryId"`
}

type AddCategoryReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type DeleteRoomReq struct {
	RoomId int64 `json:"roomId"`
}
