import Head from 'next/head';
import { useCallback, useReducer, useState } from 'react';

import Timetable, { ScheduleType, SelectedScheduleMeta } from '../components/Timetable';
import type { Schedule } from '../components/Timetable';

export default function Home() {
  const [selectInProgress, setSelectInProgress] = useState<boolean>(false);
  const [selection, setSelection] = useState<{ idx: number, from: number, to: number }>();
  const [selectionMeta, setSelectionMeta] = useState<SelectedScheduleMeta>();
  const [schedules, dispatch] = useReducer(
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

      dispatch({ type: 'add', idx, schedule: { name: selectionMeta.name, start, end, type: ScheduleType.Past } });
    },
    [selection, selectionMeta],
  );

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

      <main className="py-20">
        <Timetable
          dateStartAt={new Date('2021-07-12')}
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
