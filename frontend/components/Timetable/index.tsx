import TimetableColumn from './Column';
import { Schedule, SelectedScheduleMeta } from './types';

export type Props = {
  /** 시간표를 그리기 시작할 날짜 */
  dateStartAt: Date;
  /** 시간표에 그릴 일정 목록 */
  schedules: Schedule[][];
  /** 현재 선택된 일정 */
  selected?: Schedule;
  /** 선택된 일정의 정보 */
  selectedMeta?: SelectedScheduleMeta;
  /** 일정 선택이 업데이트된 경우 발생하는 이벤트 */
  onTimeSelectUpdate?(data: { idx: number; from: number; to: number }): void;
  /** 일정 선택이 완료된 경우 발생하는 이벤트 */
  onTimeSelectDone?(data: { idx: number; from: number; to: number }): void;
  /** 일정 선택이 취소된 경우 발생하는 이벤트 */
  onTimeSelectCancel?(data: { idx: number }): void;
  /** 일정 정보가 업데이트된 경우 발생하는 이벤트 */
  onMetaChange?(meta: SelectedScheduleMeta): void;
  /** 예약하기를 누른 경우 발생하는 이벤트 */
  onConfirm?(): void;
};

const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' });

/**
 * 시간표를 그리는 컴포넌트입니다.
 *
 * 시간표는 `dateStartAt` 날짜부터 시작해 7일간 그려집니다.
 * */
export default function Timetable(props: Props) {
  const {
    selectedMeta,
    onTimeSelectUpdate,
    onTimeSelectDone,
    onTimeSelectCancel,
    onMetaChange,
    onConfirm,
  } = props;

  const timeHeaders = [];
  for (let i = 8; i < 23; i++) {
    const hour = (i % 12) || 12;
    const isPM = i >= 12;
    timeHeaders.push(
      <div key={i} className="px-2 row-span-2 text-sm text-right">{hour}{isPM ? 'PM' : 'AM'}</div>
    );
  }

  const columns = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(props.dateStartAt);
    date.setDate(date.getDate() + i);

    const weekdayStr = weekdayFormatter.format(date);
    const dateStr = date.getFullYear() +
      '-' + (date.getMonth() + 1).toString().padStart(2, '0') +
      '-' + date.getDate().toString().padStart(2, '0');
    const heading = (
      <div className="flex flex-col items-center">
        <span>{weekdayStr}</span>
        <span className="text-sm">{dateStr}</span>
      </div>
    );

    const schedules = props.schedules[i] ?? [];
    columns.push(
      <TimetableColumn
        key={i}
        idx={i}
        heading={heading}
        schedules={schedules}
        selectedMeta={selectedMeta}
        onTimeSelectUpdate={onTimeSelectUpdate}
        onTimeSelectDone={onTimeSelectDone}
        onTimeSelectCancel={onTimeSelectCancel}
        onMetaChange={onMetaChange}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <div className="grid grid-cols-timetable grid-rows-timetable grid-flow-col-dense border border-gray-200">
      <div />
      {timeHeaders}
      {columns}
    </div>
  );
}
