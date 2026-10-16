import { CalendarIcon } from "lucide-react";
import { HOURS, MINUTES, type ScheduleValue } from "../utils/schedule";

interface DateTimeFieldsProps {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

const selectClass =
  "w-full py-2.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none cursor-pointer text-center";

const DateTimeFields = ({ value, onChange }: DateTimeFieldsProps) => {
  const update = (patch: Partial<ScheduleValue>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-slate-500 uppercase mb-2">Date</label>
        <div className="relative">
          <CalendarIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="date"
            required
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none cursor-pointer"
            value={value.date}
            onChange={(e) => update({ date: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 uppercase mb-2">Time</label>
        <div className="grid grid-cols-3 gap-1.5">
          <select
            aria-label="Hour"
            value={value.hour}
            onChange={(e) => update({ hour: e.target.value })}
            className={selectClass}
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <select
            aria-label="Minute"
            value={value.minute}
            onChange={(e) => update({ minute: e.target.value })}
            className={selectClass}
          >
            {MINUTES.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
          <select
            aria-label="AM or PM"
            value={value.period}
            onChange={(e) => update({ period: e.target.value as ScheduleValue["period"] })}
            className={selectClass}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default DateTimeFields;
