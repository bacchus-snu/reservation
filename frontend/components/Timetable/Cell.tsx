import { useCallback } from 'react';

type TimetableCellProps = {
  idx: number;
  columnIdx: number;
  onDragStart?(idx: number): void;
  onDragUpdate?(idx: number): void;
  onDragEnd?(idx: number): boolean;
};

export default function TimetableCell(props: TimetableCellProps) {
  const {
    idx,
    columnIdx,
    onDragStart: handleDragStart,
    onDragUpdate: handleDragUpdate,
    onDragEnd: handleDragEnd,
  } = props;
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
      style={{ gridColumn: ((columnIdx + 1) * 2 + 1).toString(), gridRow: (idx + 2).toString() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
}
