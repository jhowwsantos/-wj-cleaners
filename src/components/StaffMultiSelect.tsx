import React, { useState } from 'react';
import { User } from '../types';
import { X, UserPlus, Check, ChevronDown } from 'lucide-react';

interface StaffMultiSelectProps {
  users: User[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  language?: string;
}

export const StaffMultiSelect: React.FC<StaffMultiSelectProps> = ({
  users,
  selectedIds,
  onChange,
  language = 'pt',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const removeUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== userId));
  };

  const selectedUsers = users.filter((u) => selectedIds.includes(u.id));

  return (
    <div className="space-y-2">
      {/* Dropdown Header Trigger */}
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full min-h-[42px] p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-pointer flex items-center justify-between gap-2 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedUsers.length === 0 ? (
              <span className="text-slate-400 dark:text-slate-500 px-1 font-medium">
                {language === 'pt'
                  ? 'Selecione um ou mais colaboradores...'
                  : 'Select one or more team members...'}
              </span>
            ) : (
              <span className="text-slate-600 dark:text-slate-300 font-bold px-1">
                {selectedUsers.length} {language === 'pt' ? 'colaborador(es) selecionado(s)' : 'member(s) selected'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Dropdown Options List */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto p-1.5 space-y-1">
              {users.map((u) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-900 dark:text-blue-200'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>{u.name}</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                        {u.role}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected Chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700/60 text-blue-900 dark:text-blue-200 text-xs font-bold rounded-xl shadow-2xs animate-in fade-in duration-100"
            >
              <span>{u.name}</span>
              <span className="text-[9px] px-1 bg-blue-200 dark:bg-blue-800 rounded font-semibold text-blue-800 dark:text-blue-100">
                {u.role}
              </span>
              <button
                type="button"
                onClick={(e) => removeUser(u.id, e)}
                className="hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
