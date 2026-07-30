import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, PoundSterling, User, CheckCircle2, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../utils/i18n';

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
    cleanerId: users[0]?.id || '',
    notes: '',
  });

  // Sync initial clientId and values when modal opens or clients load
  useEffect(() => {
    if (clients.length > 0 && !formData.clientId) {
      const first = clients[0];
      setFormData((prev) => ({
        ...prev,
        clientId: first.id,
        price: first.defaultPrice,
        estimatedDuration: first.estimatedDuration,
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
      setFormData({
        ...formData,
        clientId: cId,
        price: client.defaultPrice,
        estimatedDuration: client.estimatedDuration,
      });
    } else {
      setFormData({ ...formData, clientId: cId });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formData.clientId);
    const cleaner = users.find((u) => u.id === formData.cleanerId);

    if (!client) return;

    addJob({
      clientId: client.id,
      clientName: client.name,
      address: client.address,
      postcode: client.postcode,
      city: client.city,
      phone: client.phone,
      whatsapp: client.whatsapp,
      cleanerId: cleaner?.id || 'usr_jhonatan',
      cleanerName: cleaner?.name || 'Jhonatan Santos',
      date: formData.date,
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
    });

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
                Criar novo agendamento de limpeza e sincronizar na agenda do Firestore.
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
                Nenhum cliente cadastrado ainda. Cadastre um cliente primeiro!
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

          {/* Assigned Staff */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {getTranslation(language, 'assignCleaner')}
            </label>
            <select
              value={formData.cleanerId}
              onChange={(e) => setFormData({ ...formData, cleanerId: e.target.value })}
              className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
            >
              <option value="">{getTranslation(language, 'unassigned')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Observações / Instruções
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Focar na limpeza da cozinha e banheiros"
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
