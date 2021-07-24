import Head from 'next/head';
import { useCallback, useEffect, useReducer, useState } from 'react';

import Timetable from '../components/Timetable';
import { ScheduleType } from '../components/Timetable/types';
import type { Schedule, SelectedScheduleMeta } from '../components/Timetable/types';
import { getPayloadFromToken, useTokenStore } from '../components/Token';

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
  const [tokenState, refreshToken] = useTokenStore();

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

  const handleResetWeek = useCallback(() => dispatchDate({ type: 'reset' }), []);
  const handleNextWeek = useCallback(() => dispatchDate({ type: 'next' }), []);
  const handlePrevWeek = useCallback(() => dispatchDate({ type: 'prev' }), []);

  const payload = tokenState.token == null ? null : getPayloadFromToken(tokenState.token);

  const schedulesWithSel = [...schedules];
  if (selection != null) {
    const type = selectInProgress ? ScheduleType.Selecting : ScheduleType.Selected;
    const { start, end } = selection;
    schedulesWithSel.push({ name: '', start, end, type });
  }

  let loginState: React.ReactNode = null;
  if (tokenState.loading) {
    loginState = '...';
  } else if (tokenState.error) {
    loginState = '에러가 발생했습니다.';
  } else if (payload == null) {
    loginState = (
      <a href="https://id.snucse.org" target="_blank" rel="noopener noreferrer" className="text-blue-500">
        통합계정으로 로그인하세요
      </a>
    );
  } else {
    loginState = `${payload.username}님, 환영합니다.`;
  }

  return (
    <div className="container mx-auto">
      <Head>
        <title>강의실 예약 시스템</title>
        <meta name="description" content="Room reservation system" />
      </Head>

      <main className="py-20 space-y-2">
        <div className="flex flex-row justify-between items-baseline">
          <div className="flex flex-row space-x-2">
            <button className="px-2 py-0.5 border rounded" onClick={handleResetWeek}>오늘</button>
            <button className="px-2 py-0.5 border rounded" onClick={handlePrevWeek}>{'<'}</button>
            <button className="px-2 py-0.5 border rounded" onClick={handleNextWeek}>{'>'}</button>
          </div>
          <div>{loginState}</div>
        </div>
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
      </main>
    </div>
  );
}
