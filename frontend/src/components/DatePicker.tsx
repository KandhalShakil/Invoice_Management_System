import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'Select Date',
  required = false,
  disabled = false,
  minDate,
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Set current month/year view based on the selected date value, or default to today
  const initialDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(isNaN(initialDate.getTime()) ? new Date() : initialDate);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize view state when external value changes
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setViewDate(parsed);
      }
    }
  }, [value]);

  // Click outside handler to close calendar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  // Format Helper: YYYY-MM-DD
  const formatISO = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Month navigation
  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Handle day click
  const handleDaySelect = (d: number, isCurrentMonth: boolean) => {
    let targetYear = year;
    let targetMonth = month;
    if (!isCurrentMonth) {
      if (d > 20) {
        // Prev month date clicked
        targetMonth = month - 1;
      } else {
        // Next month date clicked
        targetMonth = month + 1;
      }
      const newViewDate = new Date(targetYear, targetMonth, 1);
      targetYear = newViewDate.getFullYear();
      targetMonth = newViewDate.getMonth();
    }
    const formatted = formatISO(targetYear, targetMonth, d);
    onChange(formatted);
    setIsOpen(false);
  };

  // Generate calendar days
  const getDaysArray = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month days overflow
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        dateString: formatISO(year, month - 1, daysInPrevMonth - i),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        dateString: formatISO(year, month, i),
      });
    }

    // Next month days overflow to fill 42 cells (6 rows * 7 days)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        dateString: formatISO(year, month + 1, i),
      });
    }

    return days;
  };

  // Check if date is today
  const isTodayDate = (dateString: string) => {
    const today = new Date();
    return formatISO(today.getFullYear(), today.getMonth(), today.getDate()) === dateString;
  };

  // Human-friendly display label (e.g. Jun 6, 2026)
  const getDisplayValue = () => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Range validation checks
  const isDateDisabled = (dateString: string) => {
    if (minDate && dateString < minDate) return true;
    if (maxDate && dateString > maxDate) return true;
    return false;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Date Picker Trigger Input Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-950/60 border border-slate-800 text-slate-200 py-2.5 px-3.5 rounded-xl text-left focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all font-sans text-sm ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-700'
        } ${className}`}
      >
        <span className={value ? 'text-slate-100' : 'text-slate-500'}>
          {getDisplayValue() || placeholder}
        </span>
        <CalendarIcon className="w-4 h-4 text-slate-500" />
      </button>

      {/* Popover Calendar Modal */}
      {isOpen && (
        <div className="absolute left-0 mt-2 z-50 w-72 bg-[#0b0e17]/95 border border-slate-800 rounded-2xl p-4 shadow-2xl shadow-black/80 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header Month/Year & Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-white tracking-tight">
              {monthNames[month]} {year}
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-colors"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-colors"
                aria-label="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {daysOfWeek.map((day) => (
              <span key={day} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1">
            {getDaysArray().map(({ day, isCurrentMonth, dateString }, index) => {
              const isSelected = value === dateString;
              const isToday = isTodayDate(dateString);
              const isDisabled = isDateDisabled(dateString);

              return (
                <button
                  key={index}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDaySelect(day, isCurrentMonth)}
                  className={`aspect-square w-full rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                    isDisabled
                      ? 'text-slate-700 cursor-not-allowed hover:bg-transparent'
                      : isSelected
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : isToday
                      ? 'border border-emerald-500/60 text-emerald-400 hover:bg-slate-800'
                      : isCurrentMonth
                      ? 'text-slate-200 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-800/40'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today Button Shortcut */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const formatted = formatISO(today.getFullYear(), today.getMonth(), today.getDate());
                onChange(formatted);
                setIsOpen(false);
              }}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors uppercase tracking-wider"
              >
                Clear
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default DatePicker;
