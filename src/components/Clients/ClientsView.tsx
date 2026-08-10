import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  PoundSterling,
  Clock,
  Key,
  ShieldAlert,
  Dog,
  Edit,
  Trash2,
  History,
  CheckCircle2,
  X,
  FileSpreadsheet,
  User,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Client, Language } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { exportClientsCSV } from '../../utils/exportUtils';
import { geocodeUKAddress } from '../../utils/postcodeLookup';

interface ClientsViewProps {
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
}

const ClientsViewComponent: React.FC<ClientsViewProps> = ({
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
}) => {
  const {
    clients,
    addClient,
    updateClient,
    deleteClient,
    jobs,
    currentCompany,
    language,
    userRole,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedHistoryClient, setSelectedHistoryClient] = useState<Client | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    postcode: 'SW1A 1AA',
    city: 'London',
    phone: '+44 7700 900000',
    whatsapp: '447700900000',
    email: '',
    hourlyRate: 15,
    estimatedDuration: 3,
    defaultPrice: 45, // Auto-calculated: 15 * 3
    frequency: 'WEEKLY' as Client['frequency'],
    customIntervalDays: 20,
    customStartDate: new Date().toISOString().split('T')[0],
    preferredDayOfWeek: 1, // 1=Segunda
    preferredTime: '09:00',
    hasKey: true,
    keyDetails: 'Keybox code 1234',
    alarmCode: '9988',
    hasPets: false,
    petNotes: '',
    specialPreferences: '',
  });

  // Reset form when add modal is triggered
  React.useEffect(() => {
    if (isAddModalOpen && !editingClient) {
      setFormData({
        name: '',
        address: '',
        postcode: 'SW1A 1AA',
        city: 'London',
        phone: '+44 7700 900000',
        whatsapp: '447700900000',
        email: '',
        hourlyRate: 15,
        estimatedDuration: 3,
        defaultPrice: 45,
        frequency: 'WEEKLY',
        customIntervalDays: 20,
        customStartDate: new Date().toISOString().split('T')[0],
        preferredDayOfWeek: 1,
        preferredTime: '09:00',
        hasKey: true,
        keyDetails: 'Keybox code 1234',
        alarmCode: '9988',
        hasPets: false,
        petNotes: '',
        specialPreferences: '',
      });
    }
  }, [isAddModalOpen, editingClient]);

  // Auto-calculate default price when duration or hourly rate changes
  const handleDurationChange = (dur: number) => {
    const calculatedPrice = Math.round(dur * formData.hourlyRate * 100) / 100;
    setFormData((prev) => ({
      ...prev,
      estimatedDuration: dur,
      defaultPrice: calculatedPrice,
    }));
  };

  const handleHourlyRateChange = (rate: number) => {
    const calculatedPrice = Math.round(formData.estimatedDuration * rate * 100) / 100;
    setFormData((prev) => ({
      ...prev,
      hourlyRate: rate,
      defaultPrice: calculatedPrice,
    }));
  };

  // Helper for Day Names
  const getDayName = (dayNum: number, lang: Language) => {
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return lang === 'pt' ? daysPt[dayNum] || 'Segunda-feira' : daysEn[dayNum] || 'Monday';
  };

  // Filter clients by search query (memoized)
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.postcode.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (userRole !== 'CLEANER' && c.phone && c.phone.toLowerCase().includes(q)) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [clients, searchQuery, userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let lat: number | undefined = editingClient?.latitude;
    let lng: number | undefined = editingClient?.longitude;

    const addressOrPostcodeChanged = !editingClient || (
      editingClient.postcode !== formData.postcode ||
      editingClient.address !== formData.address ||
      editingClient.city !== formData.city
    );

    if (!lat || !lng || addressOrPostcodeChanged) {
      const geocoded = await geocodeUKAddress(formData.postcode, formData.address, formData.city);
      if (geocoded) {
        lat = geocoded.latitude;
        lng = geocoded.longitude;
      }
    }

    const payload = {
      ...formData,
      latitude: lat,
      longitude: lng,
    };

    if (editingClient) {
      updateClient(editingClient.id, payload);
      setEditingClient(null);
    } else {
      addClient(payload);
      onCloseAddModal();
    }
  };

  const handleEditClick = (c: Client) => {
    setEditingClient(c);
    setFormData({
      name: c.name,
      address: c.address,
      postcode: c.postcode,
      city: c.city,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      hourlyRate: c.hourlyRate || 15,
      defaultPrice: c.defaultPrice,
      estimatedDuration: c.estimatedDuration,
      frequency: c.frequency,
      customIntervalDays: c.customIntervalDays || 20,
      customStartDate: c.customStartDate || (c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      preferredDayOfWeek: c.preferredDayOfWeek,
      preferredTime: c.preferredTime,
      hasKey: c.hasKey,
      keyDetails: c.keyDetails || '',
      alarmCode: c.alarmCode || '',
      hasPets: c.hasPets,
      petNotes: c.petNotes || '',
      specialPreferences: c.specialPreferences || '',
    });
  };

  // Client history calculations
  const clientJobs = selectedHistoryClient
    ? jobs.filter((j) => j.clientId === selectedHistoryClient.id)
    : [];
  const clientTotalSpent = clientJobs
    .filter((j) => j.status === 'COMPLETED')
    .reduce((acc, j) => acc + j.price, 0);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {getTranslation(language, 'clientsTitle')} ({clients.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {getTranslation(language, 'clientsSub')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportClientsCSV(currentCompany, clients)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> {getTranslation(language, 'exportCsv')}
          </button>
          {userRole !== 'CLEANER' && (
            <button
              onClick={() => {
                setEditingClient(null);
                onOpenAddModal();
              }}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {getTranslation(language, 'btnNewClient')}
            </button>
          )}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={getTranslation(language, 'searchClientsPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>

      {/* Client List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full p-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center text-slate-400 text-sm">
            {getTranslation(language, 'noClientsFound')} "{searchQuery}".
          </div>
        ) : (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs hover:border-blue-300 dark:hover:border-blue-600 transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                {/* Header Name & Frequency */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {client.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{client.address}{client.city ? `, ${client.city}` : ''} (<strong className="text-slate-700 dark:text-slate-300 font-bold">{client.postcode}</strong>)</span>
                    </div>
                  </div>
                </div>

                {/* Price & Duration */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs">
                  {userRole !== 'CLEANER' ? (
                    <>
                      <div className="flex items-center gap-1 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        <PoundSterling className="w-4 h-4" />
                        <span>£{client.defaultPrice?.toFixed(2) || (client.estimatedDuration * (client.hourlyRate || 15)).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 font-normal">/ {getTranslation(language, 'cleanUnit')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span>£{client.hourlyRate || 15}/h • {client.estimatedDuration}h</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{getTranslation(language, 'durationHours')}: {client.estimatedDuration}h</span>
                    </div>
                  )}
                </div>

                {/* Contact Links - Restricted to Owner & Admin */}
                {userRole !== 'CLEANER' && (client.phone || client.whatsapp) && (
                  <div className="flex items-center gap-3 mt-3 text-xs">
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600"
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-500" /> {client.phone}
                      </a>
                    )}
                    {client.whatsapp && (
                      <a
                        href={`https://wa.me/${client.whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 font-semibold hover:underline"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                )}

                {/* Security details and preferences badges */}
                <div className="mt-3 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl space-y-1 text-[11px] border border-slate-100 dark:border-slate-800">
                  {client.preferredCleanerName && (
                    <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <span>{getTranslation(language, 'assignedCleanerLabel')} {client.preferredCleanerName}</span>
                    </div>
                  )}
                  {client.hasKey && (
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                      <Key className="w-3.5 h-3.5" />
                      <span>{getTranslation(language, 'keyDetails')}: {client.keyDetails || getTranslation(language, 'keyHeld')}</span>
                    </div>
                  )}
                  {client.alarmCode && (
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{getTranslation(language, 'alarmCode')}: {client.alarmCode}</span>
                    </div>
                  )}
                  {client.hasPets && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Dog className="w-3.5 h-3.5" />
                      <span>{getTranslation(language, 'petsInfo')}: {client.petNotes || 'Yes'}</span>
                    </div>
                  )}
                  {(client.notes || client.specialPreferences) && (
                    <div className="text-slate-600 dark:text-slate-300 italic pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      " {client.notes || client.specialPreferences} "
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setSelectedHistoryClient(client)}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" /> {getTranslation(language, 'history')}
                </button>

                {userRole !== 'CLEANER' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditClick(client)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(getTranslation(language, 'confirmDelete'))) {
                          deleteClient(client.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Client Modal */}
      {(isAddModalOpen || editingClient) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {editingClient
                  ? getTranslation(language, 'editClientModalTitle')
                  : getTranslation(language, 'addClientModalTitle')}
              </h3>
              <button
                onClick={() => {
                  setEditingClient(null);
                  onCloseAddModal();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getTranslation(language, 'clientName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getTranslation(language, 'fullAddress')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getTranslation(language, 'postcode')} (UK)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SW1A 1AA"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value.toUpperCase() })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getTranslation(language, 'city')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Pricing & Duration Block with Auto-Calculation */}
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <PoundSterling className="w-4 h-4 text-emerald-600" />
                    {getTranslation(language, 'autoPriceCalc')}
                  </h4>
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                    {getTranslation(language, 'autoCalculated')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {getTranslation(language, 'durationHours')}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={formData.estimatedDuration}
                      onChange={(e) => handleDurationChange(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {getTranslation(language, 'hourlyRateLabel')}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={formData.hourlyRate}
                      onChange={(e) => handleHourlyRateChange(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {getTranslation(language, 'totalPriceLabel')}
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.defaultPrice}
                      onChange={(e) => setFormData({ ...formData, defaultPrice: Number(e.target.value) })}
                      className="w-full mt-1 p-2.5 bg-white dark:bg-slate-900 border border-emerald-400 dark:border-emerald-600 rounded-xl text-xs font-black text-emerald-700 dark:text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
                  <span>
                    💡 {formData.estimatedDuration} hrs × £{formData.hourlyRate}/hr
                  </span>
                  <span className="font-extrabold text-xs">
                    = £{formData.defaultPrice.toFixed(2)} / {getTranslation(language, 'cleanUnit')}
                  </span>
                </div>
              </div>

              {/* Contact Info */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getTranslation(language, 'phone')}
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getTranslation(language, 'whatsapp')}
                  </label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Security & Access Section */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {getTranslation(language, 'accessSecurityControls')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400">{getTranslation(language, 'holdsKey')}</label>
                    <select
                      value={formData.hasKey ? 'YES' : 'NO'}
                      onChange={(e) => setFormData({ ...formData, hasKey: e.target.value === 'YES' })}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    >
                      <option value="YES">{getTranslation(language, 'keyHeld')}</option>
                      <option value="NO">{getTranslation(language, 'noKey')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400">{getTranslation(language, 'keyDetails')}</label>
                    <input
                      type="text"
                      placeholder="e.g. Keybox #4 code 4821"
                      value={formData.keyDetails}
                      onChange={(e) => setFormData({ ...formData, keyDetails: e.target.value })}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400">{getTranslation(language, 'alarmCode')}</label>
                    <input
                      type="text"
                      placeholder="e.g. 1234#"
                      value={formData.alarmCode}
                      onChange={(e) => setFormData({ ...formData, alarmCode: e.target.value })}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400">{getTranslation(language, 'petsInfo')}</label>
                    <input
                      type="text"
                      placeholder="e.g. Friendly Corgi dogs"
                      value={formData.petNotes}
                      onChange={(e) => setFormData({ ...formData, petNotes: e.target.value, hasPets: Boolean(e.target.value) })}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    onCloseAddModal();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                >
                  {getTranslation(language, 'cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer"
                >
                  {getTranslation(language, 'save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client History Drawer */}
      {selectedHistoryClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {selectedHistoryClient.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedHistoryClient.address}, {selectedHistoryClient.postcode}</p>
              </div>
              <button
                onClick={() => setSelectedHistoryClient(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userRole !== 'CLEANER' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-200 dark:border-blue-900 text-center">
                  <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">{getTranslation(language, 'totalSpent')}</div>
                  <div className="text-xl font-black text-blue-900 dark:text-blue-100 mt-0.5">
                    £{clientTotalSpent}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-900 text-center">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">{getTranslation(language, 'totalCleans')}</div>
                  <div className="text-xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
                    {clientJobs.length}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-900 text-center">
                <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">{getTranslation(language, 'totalCleans')}</div>
                <div className="text-xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
                  {clientJobs.length}
                </div>
              </div>
            )}

            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
              {getTranslation(language, 'pastHistory')}
            </h4>

            <div className="space-y-3">
              {clientJobs.length === 0 ? (
                <div className="text-xs text-slate-400 text-center p-6 border border-dashed rounded-xl">
                  {getTranslation(language, 'noCompletedJobsRecorded')}
                </div>
              ) : (
                clientJobs.map((j) => (
                  <div key={j.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100">
                      <span>{j.date}</span>
                      {userRole !== 'CLEANER' ? (
                        <span className="text-emerald-600 font-extrabold">£{j.price}</span>
                      ) : (
                        <span className="text-slate-500 font-medium">{j.estimatedDuration}h</span>
                      )}
                    </div>
                    <div className="text-slate-500">{getTranslation(language, 'assignedCleanerLabel')} {j.cleanerName || 'Team'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{j.invoiceNumber}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ClientsView = React.memo(ClientsViewComponent);
