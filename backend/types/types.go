package types

type Room struct {
	Id          int64  `json:"id"`
	Name        string `json:"name"`
	Seats       int    `json:"seats"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

type ScheduleGroup struct {
	Id          int64  `json:"id"`
	RoomId      int64  `json:"roomId"`
	Reservee    string `json:"reservee"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phoneNumber"`
	Reason      string `json:"reason"`
}

type Schedule struct {
	Id              int64 `json:"id"`
	ScheduleGroupId int64 `json:"scheduleGroupId"`
	StartTimestamp  int64 `json:"startTimestamp"`
	EndTimestamp    int64 `json:"endTimestamp"`
}
