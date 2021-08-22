import { addWeeks, getUnixTime } from 'date-fns';
import fetch from 'isomorphic-fetch';
import Head from 'next/head';
import { useCallback, useEffect, useReducer, useState } from 'react';
import useSWR from 'swr';

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

async function fetcher(key: string): Promise<Schedule[]> {
  if (key === '') return [];

  const resp = await fetch(key);
  if (resp.status !== 200) {
    throw new Error(`${key} returned status ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  return data.schedules;
}

export default function Home() {
  const [selectInProgress, setSelectInProgress] = useState<boolean>(false);
  const [selection, setSelection] = useState<{ start: Date, end: Date }>();
  const [selectionMeta, setSelectionMeta] = useState<SelectedScheduleMeta>();
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
  const {
    data: schedules = [],
    mutate: mutateSchedules,
  } = useSWR(dateStartAt == null ? '' : `/api/schedule/get?startTimestamp=${getUnixTime(dateStartAt)}&endTimestamp=${getUnixTime(addWeeks(dateStartAt, 1))}`, fetcher);
  const addSchedule = useCallback(
    async ({ start, end, selectionMeta }: { start: Date; end: Date; selectionMeta: SelectedScheduleMeta }) => {
      const schedule = {
        name: selectionMeta.name,
        start,
        end,
        type: ScheduleType.Upcoming,
      };
      mutateSchedules((schedules = []) => [...schedules, schedule], false);
      const { token } = await refreshToken();
      if (token == null) {
        console.error(`Token is null`);
      }
      const resp = await fetch('/api/schedule/add', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: 1,
          reservee: selectionMeta.name,
          email: selectionMeta.email,
          phoneNumber: selectionMeta.phoneNumber,
          reason: selectionMeta.comment,
          repeats: selectionMeta.repeatCount,
          startTimestamp: getUnixTime(start),
          endTimestamp: getUnixTime(end),
        }),
      });
      if (!resp.ok) {
        console.error(`/api/schedule/add returned status ${resp.status} ${resp.statusText}`);
      }
      console.log(await resp.json());
      mutateSchedules();
    },
    [mutateSchedules],
  );

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
      if (Number(data.start) > Date.now()) {
        setSelectionMeta({
          name: '',
          repeatCount: 1,
          email: '',
          phoneNumber: '',
          comment: '',
        });
        setSelection(data);
      } else {
        setSelectionMeta(undefined);
        setSelection(undefined);
      }
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
      addSchedule({ start, end, selectionMeta });
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
          disabled={!(tokenState.token != null && tokenState.error == null)}
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
