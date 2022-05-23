import { addWeeks, fromUnixTime, getUnixTime } from 'date-fns';
import fetch from 'isomorphic-fetch';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

import InteractiveTimetable from 'components/InteractiveTimetable';
import RoomList from 'components/RoomList';
import { ScheduleType } from 'components/Timetable/types';
import type { Schedule, SelectedScheduleMeta } from 'components/Timetable/types';
import { getPayloadFromToken, useTokenStore } from 'components/Token';

async function fetcher(key: string): Promise<Schedule[]> {
  if (key === '') return [];

  const resp = await fetch(key);
  if (resp.status !== 200) {
    throw new Error(`${key} returned status ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const schedules: Schedule[] = data.schedules.map((schedule: any) => ({
    id: schedule.id,
    scheduleGroupId: schedule.scheduleGroupId,
    name: schedule.reservee,
    start: fromUnixTime(schedule.startTimestamp),
    end: fromUnixTime(schedule.endTimestamp),
    type: ScheduleType.Upcoming,
  }));
  return schedules;
}

export default function Room() {
  const router = useRouter();
  const roomId = parseInt(String(router.query.id), 10);

  const [selection, setSelection] = useState<{ start: Date, end: Date }>();
  const [selectionMeta, setSelectionMeta] = useState<SelectedScheduleMeta>();
  const [dateStartAt, setDateStartAt] = useState<Date>();
  const [today, setToday] = useState<Date>();

  const [tokenState] = useTokenStore();
  const {
    data: schedules = [],
    mutate: mutateSchedules,
  } = useSWR(dateStartAt == null ? '' : `/api/schedule/get?roomId=${roomId}&startTimestamp=${getUnixTime(dateStartAt)}&endTimestamp=${getUnixTime(addWeeks(dateStartAt, 1))}`, fetcher);

  useEffect(
    () => {
      setToday(new Date());
    },
    [],
  );

  const handleTimeSelectCancel = useCallback(
    () => {
      setSelectionMeta(undefined);
      setSelection(undefined);
    },
    [],
  );

  const handleConfirm = useCallback(
    async () => {
      if (selection == null || selectionMeta == null) return;

      const { start, end } = selection;
      const schedule: Schedule = {
        name: selectionMeta.name,
        start: start,
        end: end,
        type: ScheduleType.Upcoming,
      };
      mutateSchedules((schedules = []) => [...schedules, schedule], false);
      const { token } = tokenState;
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
          roomId,
          reservee: selectionMeta.name,
          email: selectionMeta.email,
          phoneNumber: selectionMeta.phoneNumber,
          reason: selectionMeta.comment,
          repeats: selectionMeta.repeatCount,
          startTimestamp: getUnixTime(start),
          endTimestamp: getUnixTime(end),
        }),
      });
      if (resp.ok) {
        setSelection(undefined);
        setSelectionMeta(undefined);
      } else {
        console.error(`/api/schedule/add returned status ${resp.status} ${resp.statusText}`);
      }
      console.log(await resp.text());
      mutateSchedules();
    },
    [roomId, selection, selectionMeta, tokenState, mutateSchedules],
  );

  const handleScheduleClick = useCallback(
    async (schedule: Schedule) => {
      if (schedule.scheduleGroupId == null) {
        return;
      }

      const { token } = tokenState;
      if (token == null) {
        console.error(`Token is null`);
      }

      const resp = await fetch(
        `/api/schedule/info/get?scheduleGroupId=${schedule.scheduleGroupId}`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await resp.json();
      console.log(data);
    },
    [tokenState],
  );

  const payload = tokenState.token == null ? null : getPayloadFromToken(tokenState.token);

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

      <main className="px-8 py-16 space-y-4">
        <div>{loginState}</div>
        <div className="flex flex-col-reverse lg:flex-row">
          <InteractiveTimetable
            className="flex-none lg:flex-1"
            schedules={schedules}
            today={today}
            dateStartAt={dateStartAt}
            disabled={!(tokenState.token != null && tokenState.error == null)}
            selection={selection}
            selectionMeta={selectionMeta}
            onDateUpdate={setDateStartAt}
            onSelectionUpdate={setSelection}
            onSelectionMetaUpdate={setSelectionMeta}
            onSelectionCancel={handleTimeSelectCancel}
            onAddSchedule={handleConfirm}
            onScheduleClick={handleScheduleClick}
          />
          <RoomList
            className="mb-4 lg:mb-0 lg:ml-8 lg:w-1/4 flex-none"
            selected={{ type: 'room', id: roomId }}
          />
        </div>
      </main>
    </div>
  );
}
