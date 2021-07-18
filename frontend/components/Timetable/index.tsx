import formatDate from 'date-fns/format';
import { useCallback, useMemo } from 'react';

import TimetableColumn from './Column';
import { Schedule, SelectedScheduleMeta } from './types';

export type Props = {
  /** 시간표를 그리기 시작할 날짜 */
  dateStartAt?: Date;
  /** 오늘 날짜 */
  today?: Date;
  /** 시간표에 그릴 일정 목록 */
  schedules: Schedule[];
  /** 현재 선택된 일정 */
  selected?: Schedule;
  /** 선택된 일정의 정보 */
  selectedMeta?: SelectedScheduleMeta;
  /** 일정 선택이 업데이트된 경우 발생하는 이벤트 */
  onTimeSelectUpdate?(data: { start: Date; end: Date }): void;
  /** 일정 선택이 완료된 경우 발생하는 이벤트 */
  onTimeSelectDone?(data: { start: Date; end: Date }): void;
  /** 일정 선택이 취소된 경우 발생하는 이벤트 */
  onTimeSelectCancel?(): void;
  /** 일정 정보가 업데이트된 경우 발생하는 이벤트 */
  onMetaChange?(meta: SelectedScheduleMeta): void;
  /** 예약하기를 누른 경우 발생하는 이벤트 */
  onConfirm?(): void;
};

const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' });

function convertSelection(dateStartAt: Date, data: { idx: number; from: number; to: number }) {
  const baseDate = new Date(dateStartAt);
  baseDate.setDate(baseDate.getDate() + data.idx);
  baseDate.setSeconds(0, 0);

  let { from: start, to: end } = data;
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  end += 1;

  const startMinute = start % 2;
  const startHour = (start - startMinute) / 2;
  const endMinute = end % 2;
  const endHour = (end - endMinute) / 2;

  const startDate = new Date(baseDate);
  startDate.setHours(startHour + 8, startMinute * 30);
  const endDate = new Date(baseDate);
  endDate.setHours(endHour + 8, endMinute * 30);

  return { start: startDate, end: endDate };
}

/**
 * 시간표를 그리는 컴포넌트입니다.
 *
 * 시간표는 `dateStartAt` 날짜부터 시작해 7일간 그려집니다.
 * */
export default function Timetable(props: Props) {
  const {
    dateStartAt,
    today,
    schedules,
    selectedMeta,
    onTimeSelectUpdate,
    onTimeSelectDone,
    onTimeSelectCancel,
    onMetaChange,
    onConfirm,
  } = props;

  const sortedSchedules = useMemo(
    () => {
      const ret = [...schedules];
      ret.sort((a, b) => Number(a.start) - Number(b.start));
      return ret;
    },
    [schedules],
  );

  const handleTimeSelectUpdate = useCallback(
    data => {
      if (dateStartAt == null) return;
      onTimeSelectUpdate?.(convertSelection(dateStartAt, data));
    },
    [dateStartAt, onTimeSelectUpdate],
  );

  const handleTimeSelectDone = useCallback(
    data => {
      if (dateStartAt == null) return;
      onTimeSelectDone?.(convertSelection(dateStartAt, data));
    },
    [dateStartAt, onTimeSelectDone],
  );

  const timeHeaders = [];
  for (let i = 8; i < 23; i++) {
    timeHeaders.push(
      <div key={i} className="px-2 row-span-2 text-sm text-right">{i}</div>
    );
  }

  const columns = [];
  for (let i = 0; i < 7; i++) {
    let headingInner = null;
    let isToday = false;
    let schedules: Schedule[] = [];

    if (dateStartAt != null) {
      const date = new Date(dateStartAt);
      date.setDate(date.getDate() + i);

      isToday =
        today != null &&
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      const weekdayStr = weekdayFormatter.format(date);
      const dateStr = formatDate(date, 'yyyy-MM-dd');
      headingInner = (
        <>
          <span>{weekdayStr}</span>
          <span className="text-sm">{dateStr}</span>
        </>
      );

      const scheduleStartIdx = sortedSchedules.findIndex(
        schedule => {
          const start = schedule.start;
          return start.getFullYear() === date.getFullYear() &&
            start.getMonth() === date.getMonth() &&
            start.getDate() === date.getDate();
        },
      );
      if (scheduleStartIdx !== -1) {
        const scheduleRangeLen = sortedSchedules.slice(scheduleStartIdx)
          .findIndex(
            schedule => {
              const start = schedule.start;
              return !(
                start.getFullYear() === date.getFullYear() &&
                start.getMonth() === date.getMonth() &&
                start.getDate() === date.getDate()
              );
            },
          );
        const scheduleEndIdx = scheduleRangeLen === -1
          ? sortedSchedules.length
          : scheduleStartIdx + scheduleRangeLen;
        schedules = sortedSchedules.slice(scheduleStartIdx, scheduleEndIdx);
      }
    }

    const heading = (
      <div className={`flex flex-col items-center ${isToday ? 'font-bold' : ''}`}>
        {headingInner}
      </div>
    );

    columns.push(
      <TimetableColumn
        key={i}
        idx={i}
        heading={heading}
        schedules={schedules}
        selectedMeta={selectedMeta}
        onTimeSelectUpdate={handleTimeSelectUpdate}
        onTimeSelectDone={handleTimeSelectDone}
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
