import Head from 'next/head';
import { useCallback, useReducer, useState } from 'react';

import Timetable from '../components/Timetable';
import { ScheduleType } from '../components/Timetable/types';
import type { Schedule, SelectedScheduleMeta } from '../components/Timetable/types';

function getStartOfWeek(now: Date): Date {
  const ret = new Date(now);
  let weekday = now.getDay();
  if (weekday === 0) weekday = 7;
  ret.setDate(now.getDate() - (weekday - 1));
  return ret;
}

export default function Home() {
  const [selectInProgress, setSelectInProgress] = useState<boolean>(false);
  const [selection, setSelection] = useState<{ idx: number, from: number, to: number }>();
  const [selectionMeta, setSelectionMeta] = useState<SelectedScheduleMeta>();
  const [schedules, dispatchSchedules] = useReducer(
    (schedules: Schedule[][], action: { type: 'add'; idx: number; schedule: Schedule }) => {
      switch (action.type) {
        case 'add': {
          const ret = [...schedules];
          ret[action.idx] = [
            ...schedules[action.idx],
            action.schedule,
          ];
          return ret;
        }
        default:
          return schedules;
      }
    },
    [],
    () => Array(7).fill('').map(() => []),
  );
  const [dateStartAt, dispatchDate] = useReducer(
    (date: Date, action: { type: 'next' } | { type: 'prev' }) => {
      const ret = new Date(date);
      switch (action.type) {
        case 'next':
          ret.setDate(ret.getDate() + 7);
          return ret;
        case 'prev':
          ret.setDate(ret.getDate() - 7);
          return ret;
        default:
          return date;
      }
    },
    new Date(),
    getStartOfWeek,
  );
  const [today, setToday] = useState(() => new Date());

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

      console.log(selection, selectionMeta);
      const idx = selection.idx;
      let start = selection.from, end = selection.to;
      if (start > end) {
        const t = start;
        start = end;
        end = t;
      }
      end += 1;

      dispatchSchedules({ type: 'add', idx, schedule: { name: selectionMeta.name, start, end, type: ScheduleType.Past } });
    },
    [selection, selectionMeta],
  );

  const handleNextWeek = useCallback(() => dispatchDate({ type: 'next' }), []);
  const handlePrevWeek = useCallback(() => dispatchDate({ type: 'prev' }), []);

  const schedulesWithSel = [...schedules];
  if (selection != null) {
    const type = selectInProgress ? ScheduleType.Selecting : ScheduleType.Selected;
    const idx = selection.idx;
    let start = selection.from, end = selection.to;
    if (start > end) {
      const t = start;
      start = end;
      end = t;
    }
    end += 1;

    schedulesWithSel[idx] = [...schedules[idx], { name: '선택중', start, end, type }];
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
