import { useCallback, useEffect, useState } from 'react';
import { usePopper } from 'react-popper';

import TimetableCell from './Cell';
import MetaPopup from './MetaPopup';
import { Schedule, ScheduleType, SelectedScheduleMeta } from './types';

type Props = {
  idx: number;
  heading: React.ReactNode;
  schedules: Schedule[];
  selectedMeta?: SelectedScheduleMeta;
  onTimeSelectUpdate?(data: { idx: number; from: number; to: number }): void;
  onTimeSelectDone?(data: { idx: number; from: number; to: number }): void;
  onTimeSelectCancel?(data: { idx: number }): void;
  onMetaChange?(meta: SelectedScheduleMeta): void;
  onConfirm?(): void;
};

function convertDateToIndex(date: Date): number {
  const hour = date.getHours();
  const minute = date.getMinutes();

  const hourIdx = hour - 8;
  const minuteIdx = (minute - minute % 30) / 30;
  return hourIdx * 2 + minuteIdx;
}

export default function TimetableColumn(props: Props) {
  const {
    idx: columnIdx,
    selectedMeta,
    onTimeSelectUpdate,
    onTimeSelectDone,
    onTimeSelectCancel,
    onMetaChange,
    onConfirm,
  } = props;

  const schedules = [...props.schedules];
  schedules.sort((a, b) => Number(a.start) - Number(b.start));

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
        if (onTimeSelectDone != null && dragFrom != null) {
          onTimeSelectDone({ idx: columnIdx, from: dragFrom, to: idx });
        }
        setDragFrom(undefined);
        setDragTo(undefined);
        setDragging(false);
        return true;
      }
      return false;
    },
    [dragging, dragFrom, columnIdx, onTimeSelectDone],
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
    let schedule: Schedule | undefined = schedules[scheduleIdx];
    while (schedule != null && convertDateToIndex(schedule.start) < i) {
      scheduleIdx += 1;
      schedule = schedules[scheduleIdx];
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
          bgColor = 'bg-blue-200';
          break;
        case ScheduleType.Selected:
          bgColor = 'bg-pink-200';
          break;
      }
      column.push(
        <div
          key={`schedule-${i}`}
          ref={ref}
          className={`border-2 border-gray-300 ${bgColor} text-center ${createCell ? 'z-10' : ''} pointer-events-none`}
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
