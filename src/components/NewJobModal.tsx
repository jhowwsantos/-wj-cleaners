import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, PoundSterling, User, CheckCircle2, FileText, Repeat } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../utils/i18n';
import { StaffMultiSelect } from './StaffMultiSelect';
import { CleaningFrequency } from '../types';

interface NewJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

export const NewJobModal: React.FC<NewJobModalProps> = ({
  isOpen,
  onClose,
  initialDate,
}) => {
  const { clients, users, addJob, language } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    date: initialDate || todayStr,
    startTime: '09:00',
    estimatedDuration: clients[0]?.estimatedDuration || 3,
    price: clients[0]?.defaultPrice || 45,
    frequency: (clients[0]?.frequency || 'ONE_OFF') as CleaningFrequency,
    customIntervalDays: clients[0]?.customIntervalDays || 20,
    repeatCount: 8,
    notes: '',
  });

  const defaultCleaner = users.find((u) => u.id === 'usr_waylla' || u.name.toLowerCase().includes('waylla')) || users.find((u) => u.role === 'CLEANER') || users[0];

  const [selectedCleanerIds, setSelectedCleanerIds] = useState<string[]>(
    defaultCleaner?.id ? [defaultCleaner.id] : []
  );

  // Sync initial clientId and values when modal opens or clients load
  useEffect(() => {
    if (clients.length > 0 && !formData.clientId) {
      const first = clients[0];
      setFormData((prev) => ({
        ...prev,
        clientId: first.id,
        price: first.defaultPrice,
        estimatedDuration: first.estimatedDuration,
        frequency: first.frequency || 'ONE_OFF',
        customIntervalDays: first.customIntervalDays || 20,
      }));
    }
  }, [clients]);

  useEffect(() => {
    if (initialDate) {
      setFormData((prev) => ({ ...prev, date: initialDate }));
    }
  }, [initialDate]);

  if (!isOpen) return null;

  const handleClientChange = (cId: string) => {
    const client = clients.find((c) => c.id === cId);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        clientId: cId,
        price: client.defaultPrice,
        estimatedDuration: client.estimatedDuration,
        frequency: client.frequency || 'ONE_OFF',
        customIntervalDays: client.customIntervalDays || 20,
      }));
      if (client.preferredCleanerId) {
        setSelectedCleanerIds([client.preferredCleanerId]);
      }
    } else {
      setFormData((prev) => ({ ...prev, clientId: cId }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formData.clientId);
    if (!client) return;

    const assignedUsers = users.filter((u) => selectedCleanerIds.includes(u.id));
    const cleanerIdStr = selectedCleanerIds.join(', ');
    const cleanerNameStr = assignedUsers.map((u) => u.name).join(', ') || 'Nenhum';

    const occurrences = formData.frequency === 'ONE_OFF' ? 1 : Math.max(1, Math.min(52, Number(formData.repeatCount) || 8));

    let intervalDays = 7;
    if (formData.frequency === 'FORTNIGHTLY') intervalDays = 14;
    if (formData.frequency === 'MONTHLY') intervalDays = 28;
    if (formData.frequency === 'CUSTOM_DAYS') intervalDays = Math.max(1, Number(formData.customIntervalDays) || 20);

    const baseDate = new Date(formData.date + 'T00:00:00');

    for (let i = 0; i < occurrences; i++) {
      const targetDate = new Date(baseDate.getTime() + i * intervalDays * 86400000);
      const dateStr = targetDate.toISOString().split('T')[0];

      addJob({
        clientId: client.id,
        clientName: client.name,
        address: client.address,
        postcode: client.postcode,
        city: client.city,
        phone: client.phone,
        whatsapp: client.whatsapp,
        cleanerId: cleanerIdStr,
        cleanerName: cleanerNameStr,
        date: dateStr,
        startTime: formData.startTime,
        estimatedDuration: Number(formData.estimatedDuration),
        price: Number(formData.price),
        status: 'SCHEDULED',
        paymentStatus: 'PENDING',
        notes: formData.notes,
        keyDetails: client.keyDetails,
        alarmCode: client.alarmCode,
        hasPets: client.hasPets,
        petNotes: client.petNotes,
        frequency: formData.frequency,
        customIntervalDays: formData.frequency === 'CUSTOM_DAYS' ? Number(formData.customIntervalDays) : undefined,
        customStartDate: formData.date,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {getTranslation(language, 'btnNewJob')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'pt' ? 'Criar novo agendamento de limpeza e sincronizar na agenda.' : 'Schedule a new cleaning service for your clients.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Client Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {getTranslation(language, 'selectClient')} *
            </label>
            {clients.length === 0 ? (
              <p className="text-xs text-amber-600 mt-1 font-semibold">
                {language === 'pt' ? 'Nenhum cliente cadastrado ainda. Cadastre um cliente primeiro!' : 'No clients registered yet. Please add a client first!'}
              </p>
            ) : (
              <select
                required
                value={formData.clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full mt-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.postcode} (£{c.defaultPrice})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date and Start Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'date')} *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'startTime')} *
              </label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          {/* Price and Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'price')} (£) *
              </label>
              <input
                type="number"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full mt-1 p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-black outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'estHours')} *
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: Number(e.target.value) })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          {/* Frequency & Repetition Settings */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {language === 'pt' ? 'Frequência de Repetição' : 'Repeat Frequency'}
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={formData.frequency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      frequency: e.target.value as CleaningFrequency,
                    })
                  }
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ONE_OFF">
                    {language === 'pt' ? 'Apenas este serviço (Sem repetição)' : 'One-off (No repeat)'}
                  </option>
                  <option value="WEEKLY">
                    {language === 'pt' ? 'Semanal (A cada 7 dias)' : 'Weekly (Every 7 days)'}
                  </option>
                  <option value="FORTNIGHTLY">
                    {language === 'pt' ? 'Quinzenal (A cada 14 dias)' : 'Fortnightly (Every 14 days)'}
                  </option>
                  <option value="MONTHLY">
                    {language === 'pt' ? 'Mensal (A cada 28 dias)' : 'Monthly (Every 28 days)'}
                  </option>
                  <option value="CUSTOM_DAYS">
                    {language === 'pt' ? 'Dias editáveis (Personalizado)' : 'Custom Interval (Days)'}
                  </option>
                </select>
              </div>

              {formData.frequency === 'CUSTOM_DAYS' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {language === 'pt' ? 'Intervalo (em dias)' : 'Interval (in days)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={formData.customIntervalDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customIntervalDays: Math.max(1, Number(e.target.value)),
                      })
                    }
                    placeholder="Ex: 20"
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              )}

              {formData.frequency !== 'ONE_OFF' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {language === 'pt' ? 'Ocorrências no Firestore' : 'Occurrences in Firestore'}
                  </label>
                  <select
                    value={formData.repeatCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        repeatCount: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                  >
                    <option value={4}>{language === 'pt' ? 'Próximas 4 ocorrências' : 'Next 4 occurrences'}</option>
                    <option value={8}>{language === 'pt' ? 'Próximas 8 ocorrências (Padrão)' : 'Next 8 occurrences (Default)'}</option>
                    <option value={12}>{language === 'pt' ? 'Próximas 12 ocorrências' : 'Next 12 occurrences'}</option>
                    <option value={24}>{language === 'pt' ? 'Próximas 24 ocorrências' : 'Next 24 occurrences'}</option>
                    <option value={52}>{language === 'pt' ? 'Próximas 52 ocorrências (1 ano)' : 'Next 52 occurrences (1 year)'}</option>
                  </select>
                </div>
              )}
            </div>

            {formData.frequency !== 'ONE_OFF' && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-950/60 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900">
                {language === 'pt'
                  ? `💡 Serão gerados e salvos ${formData.repeatCount} agendamentos recorrentes no Firestore a partir de ${formData.date}.`
                  : `💡 ${formData.repeatCount} recurring appointments will be created and persisted in Firestore starting from ${formData.date}.`}
              </p>
            )}
          </div>

          {/* Assigned Staff (Multi-Select) */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
              {getTranslation(language, 'assignCleaner')}
            </label>
            <StaffMultiSelect
              users={users}
              selectedIds={selectedCleanerIds}
              onChange={setSelectedCleanerIds}
              language={language}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {language === 'pt' ? 'Observações / Instruções' : 'Notes / Instructions'}
            </label>
            <textarea
              rows={2}
              placeholder={language === 'pt' ? 'Ex: Focar na limpeza da cozinha e banheiros' : 'e.g. Focus on kitchen and upstairs bathroom'}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              {getTranslation(language, 'cancel')}
            </button>
            <button
              type="submit"
              disabled={clients.length === 0}
              className="px-5 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {getTranslation(language, 'scheduleClean')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
