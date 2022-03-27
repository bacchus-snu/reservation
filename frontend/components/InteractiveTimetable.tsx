import { addWeeks, subWeeks } from 'date-fns';
import { useCallback, useEffect } from 'react';

import Timetable from './Timetable';
import { ScheduleType } from './Timetable/types';
import type { Schedule, SelectedScheduleMeta } from './Timetable/types';

function getStartOfWeek(now: Date): Date {
  const ret = new Date(now);
  // make UTC+9
  ret.setUTCHours(ret.getUTCHours() + 9);

  let weekday = now.getUTCDay();
  if (weekday === 0) weekday = 7;
  ret.setUTCDate(now.getUTCDate() - (weekday - 1));

  // reset timezone, 00:00:00
  ret.setUTCMilliseconds(0);
  ret.setUTCSeconds(0);
  ret.setUTCMinutes(0);
  ret.setUTCHours(-9);
  return ret;
}

type Props = {
  schedules: Schedule[];
  today?: Date;
  dateStartAt?: Date;
  disabled?: boolean;
  selection?: { start: Date, end: Date };
  selectionMeta?: SelectedScheduleMeta;

  onDateUpdate?(date: Date): void;

  onSelectionUpdate?(selection: { start: Date, end: Date }): void;
  onSelectionMetaUpdate?(selectionMeta: SelectedScheduleMeta): void;
  onSelectionCancel?(): void;
  onAddSchedule?(): void;

  onScheduleClick?(schedule: Schedule): void;
};

export default function InteractiveTimetable(props: Props) {
  const {
    schedules,
    today,
    dateStartAt,
    disabled,
    selection,
    selectionMeta,
    onDateUpdate,
    onSelectionUpdate,
    onSelectionMetaUpdate,
    onSelectionCancel,
    onAddSchedule,
    onScheduleClick,
  } = props;

  const handleResetWeek = useCallback(
    () => today && onDateUpdate?.(getStartOfWeek(today)),
    [today, onDateUpdate],
  );
  const handleNextWeek = useCallback(
    () => dateStartAt && onDateUpdate?.(addWeeks(dateStartAt, 1)),
    [dateStartAt, onDateUpdate],
  );
  const handlePrevWeek = useCallback(
    () => dateStartAt && onDateUpdate?.(subWeeks(dateStartAt, 1)),
    [dateStartAt, onDateUpdate],
  );

  useEffect(() => {
    if (dateStartAt == null) {
      today && onDateUpdate?.(getStartOfWeek(today));
    }
  }, [today, dateStartAt]);

  const handleTimeSelectDone = useCallback(
    data => {
      if (Number(data.start) > Date.now()) {
        onSelectionMetaUpdate?.({
          name: '',
          repeatCount: 1,
          email: '',
          phoneNumber: '',
          comment: '',
        });
        onSelectionUpdate?.(data);
      } else {
        onSelectionCancel?.();
      }
    },
    [onSelectionMetaUpdate, onSelectionUpdate, onSelectionCancel],
  );

  const schedulesWithSel = [...schedules];
  if (selection != null) {
    const selectInProgress = selectionMeta == null;
    const type = selectInProgress ? ScheduleType.Selecting : ScheduleType.Selected;
    const { start, end } = selection;
    schedulesWithSel.push({ name: '', start, end, type });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-row justify-between items-baseline">
        <div className="flex flex-row space-x-2">
          <button className="px-2 py-0.5 border rounded" onClick={handleResetWeek}>오늘</button>
          <button className="px-2 py-0.5 border rounded" onClick={handlePrevWeek}>{'<'}</button>
          <button className="px-2 py-0.5 border rounded" onClick={handleNextWeek}>{'>'}</button>
        </div>
      </div>
      <Timetable
        disabled={disabled}
        dateStartAt={dateStartAt}
        today={today}
        schedules={schedulesWithSel}
        selectedMeta={selectionMeta}
        onTimeSelectUpdate={onSelectionUpdate}
        onTimeSelectDone={handleTimeSelectDone}
        onTimeSelectCancel={onSelectionCancel}
        onMetaChange={onSelectionMetaUpdate}
        onConfirm={onAddSchedule}
        onScheduleClick={onScheduleClick}
      />
    </div>
  );
}
