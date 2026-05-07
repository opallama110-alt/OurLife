import React from 'react';
import { Calendar } from 'lucide-react';
import {
  formatDateForDisplay,
  formatDateForInput,
  getMaxDate,
  getMinDate,
} from '../utils/dateUtils';

interface DateOfBirthPickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  required?: boolean;
}

export const DateOfBirthPicker: React.FC<DateOfBirthPickerProps> = ({
  value,
  onChange,
  label = 'Tanggal Lahir',
  required = false,
}) => {
  const display = formatDateForDisplay(value);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-mono uppercase tracking-widest text-slate-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      <div className="relative">
        <input
          type="date"
          value={formatDateForInput(value)}
          onChange={(e) => onChange(e.target.value)}
          min={getMinDate()}
          max={getMaxDate()}
          required={required}
          className="w-full px-4 py-3 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <Calendar
          size={18}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
      </div>

      {display && (
        <p className="text-xs text-slate-500">{display}</p>
      )}
    </div>
  );
};
