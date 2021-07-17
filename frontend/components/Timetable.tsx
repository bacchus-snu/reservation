type Props = {
};

function TimetableColumn(props: { heading: string }) {
  const column = [];
  for (let i = 8; i < 23; i++) {
    column.push(
      <div key={`${i}-0`} className="border-t border-gray-200" />,
      <div key={`${i}-1`} className="border-t border-dotted border-gray-200" />,
    );
  }

  return (
    <>
      <div className="row-span-full bg-gray-200" />
      <div className="text-center">{props.heading}</div>
      {column}
    </>
  );
}

export default function Timetable(_props: Props) {
  const timeHeaders = [];
  for (let i = 8; i < 23; i++) {
    const hour = (i % 12) || 12;
    const isPM = i >= 12;
    timeHeaders.push(
      <div key={i} className="px-2 row-span-2 text-sm text-right">{hour}{isPM ? 'PM' : 'AM'}</div>
    );
  }

  return (
    <div className="grid grid-cols-timetable grid-rows-31 grid-flow-col border border-gray-200">
      <div />
      {timeHeaders}

      <TimetableColumn heading="월요일" />
      <TimetableColumn heading="화요일" />
      <TimetableColumn heading="수요일" />
      <TimetableColumn heading="목요일" />
      <TimetableColumn heading="금요일" />
      <TimetableColumn heading="토요일" />
      <TimetableColumn heading="일요일" />
    </div>
  );
}
