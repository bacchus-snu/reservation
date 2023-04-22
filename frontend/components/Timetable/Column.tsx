import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePopper } from 'react-popper';

import TimetableCell from './Cell';
import MetaPopup from './MetaPopup';
import { Schedule, ScheduleType, SelectedScheduleMeta } from './types';

type Props = {
  idx: number;
  disabled?: boolean;
  heading: React.ReactNode;
  schedules: Schedule[];
  selectedMeta?: SelectedScheduleMeta;
  onTimeSelectUpdate?(data: { idx: number; from: number; to: number }): void;
  onTimeSelectDone?(data: { idx: number; from: number; to: number }): void;
  onTimeSelectCancel?(data: { idx: number }): void;
  onMetaChange?(meta: SelectedScheduleMeta): void;
  onConfirm?(): void;
  onScheduleClick?(schedule: Schedule): void;
};

function convertDateToIndex(date: Date): number {
  const hour = date.getHours();
  const minute = date.getMinutes();

  const hourIdx = hour - 8;
  const minuteIdx = (minute - minute % 30) / 30;
  return hourIdx * 2 + minuteIdx;
}

function checkValid(sortedSchedules: Schedule[], from: number, to: number): boolean {
  const indices = sortedSchedules
    .filter(schedule => schedule.type !== ScheduleType.Selecting)
    .flatMap(
      schedule => [
        { type: 'start', idx: convertDateToIndex(schedule.start) },
        { type: 'end', idx: convertDateToIndex(schedule.end) },
      ]
    );
  // (from, +Infinity) 중에서 첫 번째 인덱스
  const firstIndex = indices.find(index => index.idx > from);

  // 없으면 겹치는 일정이 없음
  if (firstIndex == null) {
    return true;
  }
  // 그게 끝점이면 from이 일정에 겹친 상황
  if (firstIndex.type === 'end') {
    return false;
  }
  // 찾은 인덱스가 [from, to) 사이에 있는 경우
  // schedule         *------O
  // range    from *--O to     <== OK
  // schedule         *------O
  // range    from *-----O to  <== NG
  if (firstIndex.idx < to) {
    return false;
  }
  // 아니면 가능함
  return true;
}

export default function TimetableColumn(props: Props) {
  const {
    idx: columnIdx,
    disabled,
    schedules,
    selectedMeta,
    onTimeSelectUpdate,
    onTimeSelectDone,
    onTimeSelectCancel,
    onMetaChange,
    onConfirm,
    onScheduleClick,
  } = props;

  const sortedSchedules = useMemo(
    () => {
      const ret = [...schedules];
      ret.sort((a, b) => Number(a.start) - Number(b.start));
      return ret;
    },
    [schedules],
  );

  const [dragging, setDragging] = useState<boolean>(false);
  const [dragFrom, setDragFrom] = useState<number>();
  const [dragTo, setDragTo] = useState<number>();

  const handleDragStart = useCallback(
    (idx: number) => {
      setDragFrom(idx);
      setDragTo(idx);
      setDragging(true);
    },
    [],
  );

  const handleDragUpdate = useCallback(
    (idx: number) => {
      if (dragging) {
        setDragTo(idx);
      }
    },
    [dragging],
  );

  const handleDragEnd = useCallback(
    (idx: number) => {
      if (dragging) {
        if (dragFrom != null) {
          let from = dragFrom;
          let to = idx;
          if (from > to) {
            const t = from;
            from = to;
            to = t;
          }

          if (checkValid(sortedSchedules, from, to)) {
            onTimeSelectDone?.({ idx: columnIdx, from, to });
          } else {
            onTimeSelectCancel?.({ idx: columnIdx });
          }
        }
        setDragFrom(undefined);
        setDragTo(undefined);
        setDragging(false);
        return true;
      }
      return false;
    },
    [dragging, dragFrom, columnIdx, sortedSchedules, onTimeSelectDone, onTimeSelectCancel],
  );

  const [selectionElement, setSelectionElement] = useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLFormElement | null>(null);
  const { styles: popperStyles, attributes: popperAttributes } = usePopper(
    selectionElement,
    popperElement,
    {
      placement: 'right-start',
      modifiers: [
        { name: 'offset', options: { offset: [0, 8] } },
        { name: 'preventOverflow', options: { padding: 8 } },
        { name: 'flip', options: { padding: 8 } },
      ],
    },
  );

  const handleCancel = useCallback(
    () => {
      onTimeSelectCancel?.({ idx: columnIdx });
    },
    [columnIdx, onTimeSelectCancel],
  );

  useEffect(
    () => {
      if (dragging && dragFrom != null && dragTo != null) {
        onTimeSelectUpdate?.({ idx: columnIdx, from: dragFrom, to: dragTo });
      }
    },
    [dragging, dragFrom, dragTo, columnIdx, onTimeSelectUpdate],
  );

  useEffect(
    () => {
      const handleGlobalMouseUp = (e: MouseEvent) => {
        if (dragging && e.button === 0) {
          setDragFrom(undefined);
          setDragTo(undefined);
          setDragging(false);
          onTimeSelectCancel?.({ idx: columnIdx });
        }
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    },
    [columnIdx, dragging, onTimeSelectCancel],
  );

  const column = [];
  let i = 0;
  let scheduleIdx = 0;
  while (i < 30) {
    let schedule: Schedule | undefined = sortedSchedules[scheduleIdx];
    while (schedule != null && convertDateToIndex(schedule.start) < i) {
      scheduleIdx += 1;
      schedule = sortedSchedules[scheduleIdx];
    }

    let createCell = true;
    if (schedule != null && convertDateToIndex(schedule.start) === i) {
      const endIdx = convertDateToIndex(schedule.end);
      const span = endIdx - i;
      const ref = schedule.type === ScheduleType.Selected ? setSelectionElement : undefined;
      createCell = schedule.type === ScheduleType.Selecting || schedule.type === ScheduleType.Selected;

      let bgColor = 'bg-gray-100';
      switch (schedule.type) {
        case ScheduleType.Selecting:
        case ScheduleType.Upcoming:
          bgColor = 'bg-blue-200';
          break;
        case ScheduleType.Selected:
          bgColor = 'bg-pink-200';
          break;
      }

      const currentSchedule = schedule;
      column.push(
        <div
          key={`schedule-${i}`}
          ref={ref}
          onClick={e => {
            if (disabled) {
              return;
            }
            e.stopPropagation();
            onScheduleClick?.(currentSchedule);
          }}
          className={`border-2 border-gray-300 ${bgColor} text-center ${createCell ? 'z-10' : ''} ${schedule.id == null ? 'pointer-events-none' : ''}`}
          style={{ gridColumn: ((columnIdx + 1) * 2 + 1).toString(), gridRow: `${i + 2} / span ${span}` }}
        >
          {schedule.name}
        </div>
      );
      if (ref != null && selectedMeta != null) {
        column.push(
          <MetaPopup
            key={`schedule-${i}-popper`}
            ref={setPopperElement}
            disabled={disabled}
            schedule={schedule}
            meta={selectedMeta}
            onChange={onMetaChange}
            onConfirm={onConfirm}
            onCancel={handleCancel}
            popperStyles={popperStyles.popper}
            popperAttributes={popperAttributes.popper}
          />
        );
      }
      scheduleIdx += 1;

      if (!createCell) {
        i += span;
      }
    }

    if (createCell) {
      column.push(
        <TimetableCell
          key={i}
          idx={i}
          columnIdx={columnIdx}
          onDragStart={handleDragStart}
          onDragUpdate={handleDragUpdate}
          onDragEnd={handleDragEnd}
        />
      );
      i += 1;
    }
  }

  return (
    <>
      <div className="row-span-full bg-gray-200" />
      <div className="text-center">{props.heading}</div>
      {column}
    </>
  );
}
