type Props = {
  dateStartAt: Date;
  schedules: Schedule[][];
};

type TimetableColumnProps = {
  heading: React.ReactNode;
  schedules: Schedule[];
};

type Schedule = {
  name: string;
  start: number;
  end: number;
};

function TimetableColumn(props: TimetableColumnProps) {
  const schedules = [...props.schedules];
  schedules.sort((a, b) => a.start - b.start);

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
      const dotted = i % 2 === 1;
      column.push(
        <div key={i} className={`border-t border-gray-200 ${dotted ? 'border-dotted' : ''}`} />
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

export default function Timetable(props: Props) {
  const timeHeaders = [];
  for (let i = 8; i < 23; i++) {
    const hour = (i % 12) || 12;
    const isPM = i >= 12;
    timeHeaders.push(
      <div key={i} className="px-2 row-span-2 text-sm text-right">{hour}{isPM ? 'PM' : 'AM'}</div>
    );
  }

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
    columns.push(<TimetableColumn key={i} heading={heading} schedules={schedules} />);
  }

  return (
    <div className="grid grid-cols-timetable grid-rows-timetable grid-flow-col border border-gray-200">
      <div />
      {timeHeaders}

      {columns}
    </div>
  );
}
