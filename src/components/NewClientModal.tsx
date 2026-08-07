import React, { useState, useEffect } from 'react';
import { X, UserPlus, MapPin, Phone, Mail, PoundSterling, Clock, Key, ShieldAlert, Dog, CheckCircle2, Search, Loader2, Building2, Navigation, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Client } from '../types';
import { getTranslation } from '../utils/i18n';
import { lookupUKPostcodeAddresses, UKAddressOption, formatUKPostcode, geocodeUKAddress } from '../utils/postcodeLookup';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClient?: Client | null;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  editingClient,
}) => {
  const { addClient, updateClient, users, language } = useApp();

  const [formData, setFormData] = useState({
    name: editingClient?.name || '',
    address: editingClient?.address || '',
    postcode: editingClient?.postcode || 'KT19 8AJ',
    city: editingClient?.city || 'Epsom',
    houseNumber: editingClient?.houseNumber || '',
    street: editingClient?.street || '',
    county: editingClient?.county || 'Surrey',
    country: editingClient?.country || 'United Kingdom',
    latitude: editingClient?.latitude || 51.3524,
    longitude: editingClient?.longitude || -0.2721,
    phone: editingClient?.phone || '+44 7700 900000',
    whatsapp: editingClient?.whatsapp || '447700900000',
    email: editingClient?.email || '',
    hourlyRate: editingClient?.hourlyRate || 15,
    estimatedDuration: editingClient?.estimatedDuration || 3,
    defaultPrice: editingClient?.defaultPrice || 45,
    frequency: (editingClient?.frequency || 'WEEKLY') as Client['frequency'],
    customIntervalDays: editingClient?.customIntervalDays || 20,
    customStartDate: editingClient?.customStartDate || new Date().toISOString().split('T')[0],
    preferredDayOfWeek: editingClient?.preferredDayOfWeek || 1,
    preferredTime: editingClient?.preferredTime || '09:00',
    preferredCleanerId: editingClient?.preferredCleanerId || (users.find((u) => u.id === 'usr_waylla' || u.name.toLowerCase().includes('waylla'))?.id || users[0]?.id || 'usr_waylla'),
    preferredCleanerName: editingClient?.preferredCleanerName || (users.find((u) => u.id === 'usr_waylla' || u.name.toLowerCase().includes('waylla'))?.name || users[0]?.name || 'Waylla'),
    notes: editingClient?.notes || '',
    hasKey: editingClient?.hasKey ?? true,
    keyDetails: editingClient?.keyDetails || '',
    alarmCode: editingClient?.alarmCode || '',
    hasPets: editingClient?.hasPets ?? false,
    petNotes: editingClient?.petNotes || '',
    specialPreferences: editingClient?.specialPreferences || '',
  });

  const [isSearchingPostcode, setIsSearchingPostcode] = useState(false);
  const [addressOptions, setAddressOptions] = useState<UKAddressOption[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [addressFilter, setAddressFilter] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchSuccessMessage, setSearchSuccessMessage] = useState('');

  // Sync form state when editingClient or isOpen changes
  useEffect(() => {
    if (editingClient) {
      setFormData({
        name: editingClient.name || '',
        address: editingClient.address || '',
        postcode: editingClient.postcode || 'KT19 8AJ',
        city: editingClient.city || 'Epsom',
        houseNumber: editingClient.houseNumber || '',
        street: editingClient.street || '',
        county: editingClient.county || 'Surrey',
        country: editingClient.country || 'United Kingdom',
        latitude: editingClient.latitude || 51.3524,
        longitude: editingClient.longitude || -0.2721,
        phone: editingClient.phone || '+44 7700 900000',
        whatsapp: editingClient.whatsapp || '447700900000',
        email: editingClient.email || '',
        hourlyRate: editingClient.hourlyRate || 15,
        estimatedDuration: editingClient.estimatedDuration || 3,
        defaultPrice: editingClient.defaultPrice || 45,
        frequency: (editingClient.frequency || 'WEEKLY') as Client['frequency'],
        customIntervalDays: editingClient.customIntervalDays || 20,
        customStartDate: editingClient.customStartDate || new Date().toISOString().split('T')[0],
        preferredDayOfWeek: editingClient.preferredDayOfWeek ?? 1,
        preferredTime: editingClient.preferredTime || '09:00',
        preferredCleanerId: editingClient.preferredCleanerId || (users.find((u) => u.id === 'usr_waylla' || u.name.toLowerCase().includes('waylla'))?.id || users[0]?.id || 'usr_waylla'),
        preferredCleanerName: editingClient.preferredCleanerName || (users.find((u) => u.id === 'usr_waylla' || u.name.toLowerCase().includes('waylla'))?.name || users[0]?.name || 'Waylla'),
        notes: editingClient.notes || '',
        hasKey: editingClient.hasKey ?? true,
        keyDetails: editingClient.keyDetails || '',
        alarmCode: editingClient.alarmCode || '',
        hasPets: editingClient.hasPets ?? false,
        petNotes: editingClient.petNotes || '',
        specialPreferences: editingClient.specialPreferences || '',
      });
      if (editingClient.postcode) {
        handleSearchPostcode(editingClient.postcode, true);
      }
    }
  }, [editingClient, isOpen]);

  const handleSearchPostcode = async (codeToSearch: string, isEditing = false) => {
    const formatted = formatUKPostcode(codeToSearch);
    if (!formatted || formatted.length < 3) {
      setErrorMessage(getTranslation(language, 'validPostcodePrompt') || (language === 'pt' ? 'Por favor, digite um postcode válido do Reino Unido (ex: KT19 8AJ).' : 'Please enter a valid UK postcode (e.g. KT19 8AJ).'));
      setAddressOptions([]);
      return;
    }

    setIsSearchingPostcode(true);
    setErrorMessage('');
    setSearchSuccessMessage('');
    setAddressFilter('');

    const res = await lookupUKPostcodeAddresses(formatted);
    setIsSearchingPostcode(false);

    if (res.success && res.addresses.length > 0) {
      setAddressOptions(res.addresses);
      setSelectedAddressId(''); // Do not auto-select first result
      setSearchSuccessMessage(
        language === 'pt'
          ? `${res.addresses.length} endereço(s) localizado(s) para ${res.postcode}. Selecione o seu na lista abaixo.`
          : `${res.addresses.length} address(es) found for ${res.postcode}. Select yours from the list below.`
      );
      
      if (isEditing && editingClient?.houseNumber) {
        // Find existing matching address if editing
        const existing = res.addresses.find(
          a => a.houseNumber.toLowerCase() === editingClient.houseNumber?.toLowerCase() ||
               a.fullAddress.toLowerCase().includes(editingClient.address.toLowerCase())
        );
        if (existing) {
          setSelectedAddressId(existing.id);
        }
      }
    } else {
      setAddressOptions([]);
      setSelectedAddressId('');
      setErrorMessage(res.message || `${getTranslation(language, 'postcode')} "${formatted}" ${getTranslation(language, 'postcodeNotFoundUk')}`);
    }
  };

  const applyAddress = (selected: UKAddressOption) => {
    setFormData((prev) => ({
      ...prev,
      houseNumber: selected.houseNumber,
      street: selected.street,
      city: selected.city,
      county: selected.county,
      postcode: selected.postcode,
      country: selected.country,
      latitude: selected.latitude,
      longitude: selected.longitude,
      address: selected.fullAddress,
    }));
  };

  const handleSelectAddressChange = (addressId: string) => {
    setSelectedAddressId(addressId);
    if (!addressId) return;
    const found = addressOptions.find((a) => a.id === addressId);
    if (found) {
      applyAddress(found);
    }
  };

  const filteredAddressOptions = addressOptions.filter((opt) => {
    if (!addressFilter.trim()) return true;
    const q = addressFilter.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.houseNumber.toLowerCase().includes(q) ||
      opt.street.toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure full address fallback if house/street specified
    const constructedAddress = formData.address || 
      [formData.houseNumber ? `${formData.houseNumber} ${formData.street}` : formData.street, formData.city, formData.postcode, formData.country]
        .filter(Boolean)
        .join(', ');

    let lat = formData.latitude;
    let lng = formData.longitude;

    // Re-geocode if lat/lng are missing or if address/postcode changed without using address selector
    const addressOrPostcodeChanged = editingClient && (
      editingClient.postcode !== formData.postcode ||
      editingClient.address !== constructedAddress ||
      editingClient.city !== formData.city
    );

    if (!lat || !lng || addressOrPostcodeChanged) {
      const geocoded = await geocodeUKAddress(formData.postcode, constructedAddress, formData.city);
      if (geocoded) {
        lat = geocoded.latitude;
        lng = geocoded.longitude;
      }
    }

    const finalClientData = {
      ...formData,
      latitude: lat,
      longitude: lng,
      address: constructedAddress || getTranslation(language, 'addressNotProvided'),
    };

    if (editingClient) {
      updateClient(editingClient.id, finalClientData);
    } else {
      addClient(finalClientData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {editingClient ? getTranslation(language, 'editClientModalTitle') : getTranslation(language, 'btnNewClient')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getTranslation(language, 'clientFormSub')}
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain touch-pan-y">
          {/* Section 1: Personal Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
              <span>{getTranslation(language, 'clientStep1')}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'fullNameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sarah Jenkins"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'email')}
                </label>
                <input
                  type="email"
                  placeholder="sarah@example.co.uk"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'phone')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+44 7700 900000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'whatsapp')}
                </label>
                <input
                  type="text"
                  placeholder="447700900000"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Professional UK Address Lookup */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{getTranslation(language, 'clientStep2')}</span>
              </h4>
            </div>

            {/* Postcode Search Control */}
            <div className="bg-blue-50/70 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-100 dark:border-blue-900 space-y-3">
              <label className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center justify-between">
                <span>{getTranslation(language, 'postcodeUkLabel')} (ex.: KT19 8AJ)</span>
                {isSearchingPostcode && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {getTranslation(language, 'calculating')}
                  </span>
                )}
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    required
                    placeholder="Ex: KT19 8AJ"
                    value={formData.postcode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setFormData({ ...formData, postcode: val });
                      if (val.replace(/[^A-Z0-9]/g, '').length >= 5) {
                        handleSearchPostcode(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchPostcode(formData.postcode);
                      }
                    }}
                    className="w-full p-2.5 pr-8 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchPostcode(formData.postcode)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  {getTranslation(language, 'searchAddressesBtn')}
                </button>
              </div>

              {/* Error Alert Badge */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Dropdown Options List */}
              {addressOptions.length > 0 && (
                <div className="space-y-2 pt-1 animate-in fade-in duration-150 border-t border-blue-200/60 dark:border-blue-900/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-[11px] font-extrabold text-blue-950 dark:text-blue-200">
                      {getTranslation(language, 'selectAddressFromList')} ({filteredAddressOptions.length} / {addressOptions.length}):
                    </label>
                    {searchSuccessMessage && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        {searchSuccessMessage}
                      </span>
                    )}
                  </div>

                  {/* Filter Search Input inside Dropdown Area */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Flat, Apartment, Number, Street..."
                      value={addressFilter}
                      onChange={(e) => setAddressFilter(e.target.value)}
                      className="w-full p-2 pl-8 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  </div>

                  {/* Address Select Dropdown */}
                  <select
                    value={selectedAddressId}
                    onChange={(e) => handleSelectAddressChange(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                  >
                    <option value="">
                      {getTranslation(language, 'noAddressSelected')}
                    </option>
                    {filteredAddressOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Auto-filled Structured Address Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  House Number / Name
                </label>
                <input
                  type="text"
                  placeholder="Ex: 10 / Flat 2"
                  value={formData.houseNumber}
                  onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Street
                </label>
                <input
                  type="text"
                  placeholder="Ex: Downing Street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {getTranslation(language, 'city')}
                </label>
                <input
                  type="text"
                  placeholder="Ex: London / Epsom"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  County
                </label>
                <input
                  type="text"
                  placeholder="Ex: Surrey / Greater London"
                  value={formData.county}
                  onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {getTranslation(language, 'postcode')}
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.postcode}
                  className="w-full mt-1 p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Country
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.country}
                  className="w-full mt-1 p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
                />
              </div>
            </div>

            {/* GPS Coordinates badge */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-500" />
                <span>GPS: <strong>{formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}</strong></span>
              </div>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md">
                UK Route Ready
              </span>
            </div>
          </div>

          {/* Section 3: Pricing & Frequency */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
              {getTranslation(language, 'clientStep3')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'hourlyRateLabel')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.hourlyRate}
                  onChange={(e) => handleHourlyRateChange(Number(e.target.value))}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'durationHours')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.estimatedDuration}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
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
                  className="w-full mt-1 p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-black outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'frequency')}
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Client['frequency'] })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value="WEEKLY">{getTranslation(language, 'weeklyOpt')}</option>
                  <option value="FORTNIGHTLY">{getTranslation(language, 'fortnightlyOpt')}</option>
                  <option value="MONTHLY">{getTranslation(language, 'monthlyOpt')}</option>
                  <option value="CUSTOM_DAYS">{getTranslation(language, 'customDaysOpt')}</option>
                  <option value="ONE_OFF">{getTranslation(language, 'oneOffOpt')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'pt' ? 'Data Início da Agenda' : 'Schedule Start Date'}
                </label>
                <input
                  type="date"
                  required
                  value={formData.customStartDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    const d = new Date(val + 'T00:00:00');
                    const dayNum = isNaN(d.getTime()) ? formData.preferredDayOfWeek : d.getDay();
                    setFormData({
                      ...formData,
                      customStartDate: val,
                      preferredDayOfWeek: dayNum,
                    });
                  }}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'preferredDay') || (language === 'pt' ? 'Dia da Semana' : 'Preferred Day')}
                </label>
                <select
                  value={formData.preferredDayOfWeek}
                  onChange={(e) => setFormData({ ...formData, preferredDayOfWeek: Number(e.target.value) })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value={1}>{getTranslation(language, 'monday')}</option>
                  <option value={2}>{getTranslation(language, 'tuesday')}</option>
                  <option value={3}>{getTranslation(language, 'wednesday')}</option>
                  <option value={4}>{getTranslation(language, 'thursday')}</option>
                  <option value={5}>{getTranslation(language, 'friday')}</option>
                  <option value={6}>{getTranslation(language, 'saturday')}</option>
                  <option value={0}>{getTranslation(language, 'sunday')}</option>
                </select>
              </div>

              {formData.frequency === 'CUSTOM_DAYS' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getTranslation(language, 'customDaysLabel')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={formData.customIntervalDays}
                    onChange={(e) => setFormData({ ...formData, customIntervalDays: Math.max(1, Number(e.target.value)) })}
                    className="w-full mt-1 p-2.5 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                    placeholder="ex: 20"
                  />
                </div>
              )}

              <div className="col-span-2 sm:col-span-4">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'assignedCleanerOpt')}
                </label>
                <select
                  value={formData.preferredCleanerId}
                  onChange={(e) => {
                    const selected = users.find(u => u.id === e.target.value);
                    setFormData({
                      ...formData,
                      preferredCleanerId: e.target.value,
                      preferredCleanerName: selected?.name || ''
                    });
                  }}
                  className="w-full mt-1 p-2.5 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value="">{getTranslation(language, 'unassignedScheduleOpt')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role === 'CLEANER' ? getTranslation(language, 'cleanerRoleOpt') : u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Access & Security */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
              4. {getTranslation(language, 'accessSecurityControls')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'keyDetails')}
                </label>
                <input
                  type="text"
                  placeholder="Ex: Keybox code 1234"
                  value={formData.keyDetails}
                  onChange={(e) => setFormData({ ...formData, keyDetails: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'alarmCode')}
                </label>
                <input
                  type="text"
                  placeholder="Ex: 9988"
                  value={formData.alarmCode}
                  onChange={(e) => setFormData({ ...formData, alarmCode: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'petsInfo')}
                </label>
                <input
                  type="text"
                  placeholder="Ex: Friendly dog (Golden Retriever)"
                  value={formData.petNotes}
                  onChange={(e) => setFormData({ ...formData, petNotes: e.target.value, hasPets: Boolean(e.target.value) })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Special Notes / Cleaning Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Focus on kitchen and upstairs bathroom..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value, specialPreferences: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Controls */}
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              {getTranslation(language, 'cancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingClient ? getTranslation(language, 'saveClientChanges') : getTranslation(language, 'registerClientBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
