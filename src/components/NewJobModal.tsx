import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, PoundSterling, User, CheckCircle2, FileText, Repeat, Sparkles } from 'lucide-react';
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
  const { clients, users, addJob, updateClient, language } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || 'GUEST_CLIENT',
    customClientName: '',
    customAddress: '',
    customPostcode: '',
    customPhone: '',
    date: initialDate || todayStr,
    startTime: '09:00',
    estimatedDuration: clients[0]?.estimatedDuration || 3,
    price: clients[0]?.defaultPrice || 45,
    frequency: (clients[0]?.frequency || 'ONE_OFF') as CleaningFrequency,
    customIntervalDays: clients[0]?.customIntervalDays || 20,
    recurrenceMode: 'AUTO_INDEFINITE' as 'AUTO_INDEFINITE' | 'FIXED_COUNT',
    customEndDate: clients[0]?.customEndDate || '',
    repeatCount: 8,
    notes: '',
  });

  const defaultCleaner = users.find((u) => u.id === 'usr_waylla' || u.name.toLowerCase().includes('waylla')) || users.find((u) => u.role === 'CLEANER') || users[0];

  const [selectedCleanerIds, setSelectedCleanerIds] = useState<string[]>(
    defaultCleaner?.id ? [defaultCleaner.id] : []
  );

  // Sync initial clientId and values when modal opens or clients load
  useEffect(() => {
    if (clients.length > 0 && (!formData.clientId || formData.clientId === 'GUEST_CLIENT')) {
      const first = clients[0];
      setFormData((prev) => ({
        ...prev,
        clientId: first.id,
        price: first.defaultPrice,
        estimatedDuration: first.estimatedDuration,
        frequency: first.frequency || 'ONE_OFF',
        customIntervalDays: first.customIntervalDays || 20,
        customEndDate: first.customEndDate || '',
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
    if (cId === 'GUEST_CLIENT') {
      setFormData((prev) => ({
        ...prev,
        clientId: 'GUEST_CLIENT',
        frequency: 'ONE_OFF',
        price: 45,
        estimatedDuration: 3,
      }));
      return;
    }

    const client = clients.find((c) => c.id === cId);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        clientId: cId,
        price: client.defaultPrice,
        estimatedDuration: client.estimatedDuration,
        frequency: client.frequency || 'ONE_OFF',
        customIntervalDays: client.customIntervalDays || 20,
        customEndDate: client.customEndDate || '',
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
    const isGuest = formData.clientId === 'GUEST_CLIENT';
    const client = isGuest ? null : clients.find((c) => c.id === formData.clientId);
    if (!isGuest && !client) return;

    const assignedUsers = users.filter((u) => selectedCleanerIds.includes(u.id));
    const cleanerIdStr = selectedCleanerIds.join(', ');
    const cleanerNameStr = assignedUsers.map((u) => u.name).join(', ') || 'Nenhum';

    const clientName = isGuest
      ? (formData.customClientName.trim() || (language === 'pt' ? 'Cliente Avulso' : 'Guest Client'))
      : client!.name;
    const address = isGuest ? (formData.customAddress.trim() || 'London') : client!.address;
    const postcode = isGuest ? (formData.customPostcode.trim() || 'SW1') : client!.postcode;
    const city = isGuest ? 'London' : client!.city;
    const phone = isGuest ? formData.customPhone.trim() : client!.phone;
    const whatsapp = isGuest ? formData.customPhone.trim() : client!.whatsapp;
    const guestClientId = isGuest ? `guest_${Date.now()}` : client!.id;

    const isAutoIndefinite = formData.frequency !== 'ONE_OFF' && formData.recurrenceMode === 'AUTO_INDEFINITE';
    const occurrences = (formData.frequency === 'ONE_OFF' || isAutoIndefinite)
      ? 1
      : Math.max(1, Math.min(52, Number(formData.repeatCount) || 8));

    let intervalDays = 7;
    if (formData.frequency === 'FORTNIGHTLY') intervalDays = 14;
    if (formData.frequency === 'MONTHLY') intervalDays = 28;
    if (formData.frequency === 'CUSTOM_DAYS') intervalDays = Math.max(1, Number(formData.customIntervalDays) || 20);

    const [year, month, day] = formData.date.split('-').map(Number);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDateObj = new Date(year, month - 1, day);
    const getDayVal = localDateObj.getDay();
    const getUTCDayVal = localDateObj.getUTCDay();

    // Audit console logging as requested before saving the job
    console.log('[Job Creation Audit]:', {
      preferredDayOfWeek: client?.preferredDayOfWeek,
      customStartDate: client?.customStartDate,
      formDateChosen: formData.date,
      dateToSave: formData.date,
      dayOfWeekCalculated: getDayVal,
      timezoneUsed: tz,
      getDayResult: getDayVal,
      getUTCDayResult: getUTCDayVal,
      frequency: formData.frequency,
      recurrenceMode: formData.recurrenceMode,
      occurrences: occurrences
    });

    // If creating a recurring job for an existing registered client, ensure client profile matches
    if (!isGuest && client && formData.frequency !== 'ONE_OFF') {
      updateClient(client.id, {
        frequency: formData.frequency,
        customStartDate: formData.date,
        preferredDayOfWeek: getDayVal,
        customIntervalDays: formData.frequency === 'CUSTOM_DAYS' ? Number(formData.customIntervalDays) : client.customIntervalDays,
        customEndDate: formData.customEndDate.trim() || client.customEndDate,
        active: true,
      });
    }

    for (let i = 0; i < occurrences; i++) {
      const targetUtcDate = new Date(Date.UTC(year, month - 1, day + i * intervalDays));
      const dateStr = targetUtcDate.toISOString().split('T')[0];

      addJob({
        clientId: guestClientId,
        clientName: clientName,
        address: address,
        postcode: postcode,
        city: city,
        phone: phone,
        whatsapp: whatsapp,
        cleanerId: cleanerIdStr,
        cleanerName: cleanerNameStr,
        date: dateStr,
        startTime: formData.startTime,
        estimatedDuration: Number(formData.estimatedDuration),
        price: Number(formData.price),
        status: 'SCHEDULED',
        paymentStatus: 'PENDING',
        notes: formData.notes,
        keyDetails: client?.keyDetails || '',
        alarmCode: client?.alarmCode || '',
        hasPets: client?.hasPets || false,
        petNotes: client?.petNotes || '',
        frequency: isGuest ? 'ONE_OFF' : formData.frequency,
        customIntervalDays: (!isGuest && formData.frequency === 'CUSTOM_DAYS') ? Number(formData.customIntervalDays) : undefined,
        customStartDate: formData.date,
        customEndDate: (!isGuest && formData.customEndDate.trim()) || undefined,
        isRescheduled: true,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain touch-pan-y">
          {/* Client Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {getTranslation(language, 'selectClient')} *
            </label>
            <select
              required
              value={formData.clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full mt-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="GUEST_CLIENT" className="font-bold text-blue-600 dark:text-blue-400">
                ⚡ {language === 'pt' ? 'Agendamento Avulso (Cliente Não Cadastrado)' : 'Guest / One-Off Client (Not Registered)'}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.postcode} (£{c.defaultPrice})
                </option>
              ))}
            </select>

            {formData.clientId === 'GUEST_CLIENT' && (
              <div className="mt-3 p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2.5">
                <div>
                  <label className="text-[11px] font-bold text-blue-900 dark:text-blue-200 block mb-1">
                    {language === 'pt' ? 'Nome do Cliente Avulso *' : 'Guest Client Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customClientName}
                    onChange={(e) => setFormData({ ...formData, customClientName: e.target.value })}
                    placeholder={language === 'pt' ? 'Ex: Sâmia (Limpeza Extra / Avulsa)' : 'Ex: Guest Client'}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {language === 'pt' ? 'Endereço / Local' : 'Address'}
                    </label>
                    <input
                      type="text"
                      value={formData.customAddress}
                      onChange={(e) => setFormData({ ...formData, customAddress: e.target.value })}
                      placeholder="Ex: 123 High Street"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Postcode / Tel
                    </label>
                    <input
                      type="text"
                      value={formData.customPostcode}
                      onChange={(e) => setFormData({ ...formData, customPostcode: e.target.value })}
                      placeholder="Ex: SW1A 1AA"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
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
              <div className={formData.frequency === 'ONE_OFF' ? 'sm:col-span-2' : ''}>
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
            </div>

            {formData.frequency !== 'ONE_OFF' && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                  {language === 'pt' ? 'Modo de Geração da Recorrência' : 'Recurrence Generation Mode'}
                </label>

                {/* Cards for Recurrence Mode selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, recurrenceMode: 'AUTO_INDEFINITE' })}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      formData.recurrenceMode === 'AUTO_INDEFINITE'
                        ? 'bg-blue-50/90 dark:bg-blue-950/70 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        {language === 'pt' ? 'Automático (Indefinido)' : 'Automatic (Indefinite)'}
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 shrink-0">
                        ⭐ Ideal
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                      {language === 'pt'
                        ? 'Geração dinâmica conforme navega pelo calendário (sem limite de datas e sem lotar o banco).'
                        : 'Dynamic calendar projection as you navigate (no limits, zero DB bloat).'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, recurrenceMode: 'FIXED_COUNT' })}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      formData.recurrenceMode === 'FIXED_COUNT'
                        ? 'bg-blue-50/90 dark:bg-blue-950/70 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-black text-slate-900 dark:text-white mb-1">
                      {language === 'pt' ? 'Quantidade definida' : 'Fixed Count'}
                    </span>
                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                      {language === 'pt'
                        ? 'Gera e salva uma quantidade fixa de agendamentos no Firestore.'
                        : 'Creates and saves a set number of fixed job records in Firestore.'}
                    </p>
                  </button>
                </div>

                {formData.recurrenceMode === 'AUTO_INDEFINITE' ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        {language === 'pt' ? 'Data Final da Recorrência (Opcional)' : 'End Date (Optional)'}
                      </label>
                      <input
                        type="date"
                        value={formData.customEndDate}
                        onChange={(e) => setFormData({ ...formData, customEndDate: e.target.value })}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {language === 'pt'
                          ? 'Deixe em branco para manter ativa por tempo indeterminado.'
                          : 'Leave blank to keep active indefinitely.'}
                      </p>
                    </div>

                    <div className="text-[11px] text-amber-900 dark:text-amber-200 font-medium bg-amber-50 dark:bg-amber-950/60 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-800 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>{language === 'pt' ? '⭐ Recomendado para Clientes Fixos' : '⭐ Recommended for Fixed Clients'}</strong>
                        <p className="mt-0.5 text-[10px] text-amber-800 dark:text-amber-300">
                          {language === 'pt'
                            ? 'A regra da recorrência é salva no cliente. Conforme você navega no calendário (meses ou anos futuros/passados), as ocorrências são calculadas e exibidas automaticamente.'
                            : 'The recurrence rule is stored on the client. As you browse the calendar (future or past months/years), occurrences are projected dynamically.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
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

                    <p className="text-[11px] text-indigo-600 dark:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-950/60 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900">
                      {language === 'pt'
                        ? `💡 Serão gerados e salvos ${formData.repeatCount} agendamentos fixos no Firestore a partir de ${formData.date}.`
                        : `💡 ${formData.repeatCount} fixed appointments will be created and persisted in Firestore starting from ${formData.date}.`}
                    </p>
                  </div>
                )}
              </div>
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
