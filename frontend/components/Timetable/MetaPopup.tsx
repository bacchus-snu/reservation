import formatDate from 'date-fns/format';
import { forwardRef, useCallback } from 'react';

import { Schedule, SelectedScheduleMeta } from './types';

type MetaPopupProps = {
  schedule: Schedule;
  meta: SelectedScheduleMeta;
  onChange?(meta: SelectedScheduleMeta): void;
  onConfirm?(): void;
  onCancel?(): void;
  popperStyles: React.CSSProperties,
  popperAttributes: { [key: string]: string } | undefined,
};

function MetaPopup(props: MetaPopupProps, ref: React.Ref<HTMLFormElement>) {
  const { schedule, meta, onChange, onConfirm, onCancel, popperStyles, popperAttributes } = props;

  const handleChange = useCallback(
    <F extends keyof MetaPopupProps['meta']>(field: F, value: MetaPopupProps['meta'][F]) => {
      if (meta[field] !== value) {
        onChange?.({ ...meta, [field]: value });
      }
    },
    [meta, onChange],
  );

  const handleRepeatCountChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => handleChange('repeatCount', parseInt(e.target.value, 10)),
    [handleChange],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value),
    [handleChange],
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('email', e.target.value),
    [handleChange],
  );

  const handlePhoneNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('phoneNumber', e.target.value),
    [handleChange],
  );

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('comment', e.target.value),
    [handleChange],
  );

  const { start, end } = schedule;
  const scheduleDate = formatDate(start, 'yyyy-MM-dd');

  return (
    <form
      ref={ref}
      className="p-2 w-60 flex flex-col space-y-2 border-2 border-gray-400 bg-white"
      onSubmit={onConfirm}
      style={popperStyles}
      {...popperAttributes}
    >
      <div>
        <div>예약 날짜: {scheduleDate}</div>
        <div>시작 시각: {formatDate(start, 'HH:mm')}</div>
        <div>종료 시각: {formatDate(end, 'HH:mm')}</div>
        <label className="flex flex-row items-baseline space-x-1.5">
          <span>반복 횟수:</span>
          <select
            className="border"
            value={meta.repeatCount.toString()}
            onChange={handleRepeatCountChange}
          >
            {Array(15).fill('').map((_, idx) => (
              <option key={idx} value={(idx + 1).toString()}>{idx + 1}</option>
            ))}
          </select>
          주
        </label>
      </div>
      <label className="block space-y-1">
        <div>단체 이름</div>
        <input
          className="block w-full p-1 border border-gray-400 rounded"
          autoFocus
          required
          value={meta.name}
          onChange={handleNameChange}
        />
      </label>
      <label className="block space-y-1">
        <div>연락 가능한 이메일</div>
        <input
          className="block w-full p-1 border border-gray-400 rounded"
          type="email"
          required
          value={meta.email}
          onChange={handleEmailChange}
        />
      </label>
      <label className="block space-y-1">
        <div>연락 가능한 전화번호</div>
        <input
          className="block w-full p-1 border border-gray-400 rounded"
          type="tel"
          value={meta.phoneNumber}
          onChange={handlePhoneNumberChange}
        />
      </label>
      <label className="block space-y-1">
        <div>사용 목적</div>
        <textarea
          className="block w-full p-1 border border-gray-400 rounded"
          required
          value={meta.comment}
          onChange={handleCommentChange}
        />
      </label>
      <hr />
      <div className="flex flex-row justify-end space-x-2">
        <button
          className="px-2 py-0.5 border border-gray-600 rounded-md"
          onClick={onCancel}
        >
          취소
        </button>
        <button
          className="px-2 py-0.5 border border-blue-600 rounded-md bg-blue-500 font-bold text-white"
          type="submit"
        >
          예약하기
        </button>
      </div>
    </form>
  );
}

export default forwardRef(MetaPopup);
