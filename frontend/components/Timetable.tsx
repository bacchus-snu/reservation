import { useCallback, useEffect, useState } from 'react';

export type Props = {
  /** 시간표를 그리기 시작할 날짜 */
  dateStartAt: Date;
  /** 시간표에 그릴 일정 목록 */
  schedules: Schedule[][];
};

type TimetableColumnProps = {
  idx: number;
  heading: React.ReactNode;
  schedules: Schedule[];
  onTimeSelectUpdate?(data: { idx: number; from: number; to: number }): void;
  onTimeSelectDone?(data: { idx: number; from: number; to: number } | { idx: number; cancelled: true }): void;
};

export type Schedule = {
  /** 일정 이름 */
  name: string;
  /** 일정 시작 시각 (0 이상 30 미만) */
  start: number;
  /** 일정 끝 시각 (0 이상 30 미만) */
  end: number;
};

type TimetableCellProps = {
  idx: number;
  onDragStart?(idx: number): void;
  onDragUpdate?(idx: number): void;
  onDragEnd?(idx: number): boolean;
};

function TimetableCell(props: TimetableCellProps) {
  const { idx, onDragStart: handleDragStart, onDragUpdate: handleDragUpdate, onDragEnd: handleDragEnd } = props;
  const dotted = idx % 2 === 1;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (handleDragStart && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        handleDragStart(idx);
      }
    },
    [idx, handleDragStart],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (handleDragUpdate && (e.buttons & 1) === 1) {
        e.preventDefault();
        e.stopPropagation();
        handleDragUpdate(idx);
      }
    },
    [idx, handleDragUpdate],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (handleDragEnd && e.button === 0) {
        e.preventDefault();
        if (handleDragEnd(idx)) {
          e.stopPropagation();
        }
      }
    },
    [idx, handleDragEnd],
  );

  return (
    <div
      className={`border-t border-gray-200 ${dotted ? 'border-dotted' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
}

function TimetableColumn(props: TimetableColumnProps) {
  const { idx: columnIdx, onTimeSelectUpdate, onTimeSelectDone } = props;

  const schedules = [...props.schedules];
  schedules.sort((a, b) => a.start - b.start);

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
          onTimeSelectDone?.({ idx: columnIdx, cancelled: true });
        }
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    },
    [columnIdx, dragging, onTimeSelectDone],
  );

  const column = [];
  let i = 0;
  let scheduleIdx = 0;
  while (i < 30) {
    if (schedules.length > scheduleIdx && schedules[scheduleIdx].start === i) {
      const schedule = schedules[scheduleIdx];
      const span = schedule.end - schedule.start;
      column.push(
        <div
          key={`schedule-${i}`}
          className="border-2 border-gray-300 bg-gray-100 text-center"
          style={{ gridRow: `span ${span}` }}
        >
          {schedule.name}
        </div>
      );
      i += span;
    } else {
      column.push(
        <TimetableCell
          key={i}
          idx={i}
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

const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' });

/**
 * 시간표를 그리는 컴포넌트입니다.
 *
 * 시간표는 `dateStartAt` 날짜부터 시작해 7일간 그려집니다.
 * */
export default function Timetable(props: Props) {
  const timeHeaders = [];
  for (let i = 8; i < 23; i++) {
    const hour = (i % 12) || 12;
    const isPM = i >= 12;
    timeHeaders.push(
      <div key={i} className="px-2 row-span-2 text-sm text-right">{hour}{isPM ? 'PM' : 'AM'}</div>
    );
  }

  const handleUpdate = useCallback(
    data => {
      console.log(`update to column ${data.idx}: ${data.from}..=${data.to}`);
    },
    [],
  );

  const handleDone = useCallback(
    data => {
      if (data.cancelled) {
        console.log('selection cancelled');
      } else {
        console.log(`selected column ${data.idx}: ${data.from}..=${data.to}`);
      }
    },
    [],
  );

  const columns = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(props.dateStartAt);
    date.setDate(date.getDate() + i);

    const weekdayStr = weekdayFormatter.format(date);
    const dateStr = date.getFullYear() +
      '-' + (date.getMonth() + 1).toString().padStart(2, '0') +
      '-' + date.getDate().toString().padStart(2, '0');
    const heading = (
      <div className="flex flex-col items-center">
        <span>{weekdayStr}</span>
        <span className="text-sm">{dateStr}</span>
      </div>
    );

    const schedules = props.schedules[i] ?? [];
    columns.push(
      <TimetableColumn
        key={i}
        idx={i}
        heading={heading}
        schedules={schedules}
        onTimeSelectUpdate={handleUpdate}
        onTimeSelectDone={handleDone}
      />
    );
  }

  return (
    <div className="grid grid-cols-timetable grid-rows-timetable grid-flow-col border border-gray-200">
      <div />
      {timeHeaders}
      {columns}
    </div>
  );
}
