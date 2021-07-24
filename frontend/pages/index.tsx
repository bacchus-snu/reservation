import Head from 'next/head';
import { useCallback, useEffect, useReducer, useState } from 'react';

import Timetable from '../components/Timetable';
import { ScheduleType } from '../components/Timetable/types';
import type { Schedule, SelectedScheduleMeta } from '../components/Timetable/types';
import { useTokenStore } from '../components/Token';

function getStartOfWeek(now: Date): Date {
  const ret = new Date(now);
  let weekday = now.getDay();
  if (weekday === 0) weekday = 7;
  ret.setDate(now.getDate() - (weekday - 1));
  return ret;
}

export default function Home() {
  const [selectInProgress, setSelectInProgress] = useState<boolean>(false);
  const [selection, setSelection] = useState<{ start: Date, end: Date }>();
  const [selectionMeta, setSelectionMeta] = useState<SelectedScheduleMeta>();
  const [schedules, dispatchSchedules] = useReducer(
    (schedules: Schedule[], action: { type: 'add'; schedule: Schedule }) => {
      switch (action.type) {
        case 'add': {
          return [...schedules, action.schedule];
        }
        default:
          return schedules;
      }
    },
    [],
  );
  const [dateStartAt, dispatchDate] = useReducer(
    (date: Date | undefined, action: { type: 'reset' } | { type: 'next' } | { type: 'prev' }) => {
      switch (action.type) {
        case 'reset':
          return getStartOfWeek(new Date());
        case 'next': {
          if (date == null) {
            return date;
          }
          const ret = new Date(date);
          ret.setDate(ret.getDate() + 7);
          return ret;
        }
        case 'prev': {
          if (date == null) {
            return date;
          }
          const ret = new Date(date);
          ret.setDate(ret.getDate() - 7);
          return ret;
        }
        default:
          return date;
      }
    },
    undefined,
  );
  const [today, setToday] = useState<Date>();
  const [{ token }, refreshToken] = useTokenStore();

  useEffect(
    () => {
      setToday(new Date());
      dispatchDate({ type: 'reset' });
    },
    [],
  );

  useEffect(
    () => {
      refreshToken().catch(console.error);
    },
    [refreshToken],
  );

  useEffect(
    () => {
      console.log(token);
    },
    [token],
  );

  const handleTimeSelectUpdate = useCallback(
    data => {
      setSelectInProgress(true);
      setSelection(data);
    },
    [],
  );

  const handleTimeSelectDone = useCallback(
    data => {
      setSelectInProgress(false);
      setSelectionMeta({
        name: '',
        repeatCount: 1,
        email: '',
        phoneNumber: '',
        comment: '',
      });
      setSelection(data);
    },
    [],
  );

  const handleTimeSelectCancel = useCallback(
    () => {
      setSelectInProgress(false);
      setSelectionMeta(undefined);
      setSelection(undefined);
    },
    [],
  );

  const handleConfirm = useCallback(
    () => {
      if (selection == null || selectionMeta == null) return;

      const { start, end } = selection;
      dispatchSchedules({ type: 'add', schedule: { name: selectionMeta.name, start, end, type: ScheduleType.Past } });
    },
    [selection, selectionMeta],
  );

  const handleNextWeek = useCallback(() => dispatchDate({ type: 'next' }), []);
  const handlePrevWeek = useCallback(() => dispatchDate({ type: 'prev' }), []);

  const schedulesWithSel = [...schedules];
  if (selection != null) {
    const type = selectInProgress ? ScheduleType.Selecting : ScheduleType.Selected;
    const { start, end } = selection;
    schedulesWithSel.push({ name: '', start, end, type });
  }

  return (
    <div className="container mx-auto">
      <Head>
        <title>강의실 예약 시스템</title>
        <meta name="description" content="Room reservation system" />
      </Head>

      <main className="py-20 space-y-2">
        <Timetable
          dateStartAt={dateStartAt}
          today={today}
          schedules={schedulesWithSel}
          selectedMeta={selectionMeta}
          onTimeSelectUpdate={handleTimeSelectUpdate}
          onTimeSelectDone={handleTimeSelectDone}
          onTimeSelectCancel={handleTimeSelectCancel}
          onMetaChange={setSelectionMeta}
          onConfirm={handleConfirm}
        />
        <div className="flex flex-row justify-between">
          <button className="px-2 py-0.5 border rounded" onClick={handlePrevWeek}>prev</button>
          <button className="px-2 py-0.5 border rounded" onClick={handleNextWeek}>next</button>
        </div>
      </main>
    </div>
  );
}
