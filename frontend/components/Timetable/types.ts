export type Schedule = {
  /** 일정 이름 */
  name: string;
  /** 일정 시작 시각 (0 이상 30 미만) */
  start: Date;
  /** 일정 끝 시각 (0 이상 30 미만) */
  end: Date;
  /** 일정 종류 */
  type: ScheduleType;
};

export type SelectedScheduleMeta = {
  /** 반복 횟수 */
  repeatCount: number;
  /** 단체 이름 */
  name: string;
  /** 연락 가능한 이메일 */
  email: string;
  /** 연락 가능한 전화번호 */
  phoneNumber: string;
  /** 사용 목적 등 */
  comment: string;
};

export enum ScheduleType {
  /** 지나감 */
  Past,
  /** 확인 대기중 */
  Unverified,
  /** Upcoming */
  Upcoming,
  /** 선택 진행 중 */
  Selecting,
  /** 선택됨 */
  Selected,
}
