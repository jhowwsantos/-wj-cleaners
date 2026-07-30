import React from 'react';
import logoImg from '../assets/logo.png';
import { X, Printer, MessageCircle, FileText, CheckCircle2 } from 'lucide-react';
import { CleaningJob } from '../types';
import { useApp } from '../context/AppContext';
import { printReceipt } from '../utils/exportUtils';
import { getTranslation } from '../utils/i18n';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: CleaningJob | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, job }) => {
  const { currentCompany, language, userRole } = useApp();

  if (!isOpen || !job) return null;

  const handlePrint = () => {
    printReceipt(job, currentCompany);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `*CLEANING RECEIPT - ${currentCompany.name}*\n` +
        `Invoice: ${job.invoiceNumber || 'INV-' + job.id.slice(0, 8)}\n` +
        `Client: ${job.clientName}\n` +
        `Address: ${job.address}, ${job.postcode}\n` +
        `Date: ${job.date}\n` +
        `Amount Paid: £${job.price.toFixed(2)}\n` +
        `Status: COMPLETED & PAID\n\n` +
        `Thank you for trusting ${currentCompany.name}!`
    );
    window.open(`https://wa.me/${job.whatsapp}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
              {getTranslation(language, 'digitalReceipt')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Company Branding */}
          <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-700">
            <img
              src={currentCompany.logoUrl && currentCompany.logoUrl !== '/logo.png' ? currentCompany.logoUrl : logoImg}
              alt={currentCompany.name}
              className="w-16 h-16 object-contain mx-auto mb-2 rounded-xl shadow-sm"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = logoImg;
              }}
            />
            <h2 className="text-2xl font-black text-blue-900 dark:text-blue-400 tracking-tight">
              {currentCompany.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentCompany.address}, {currentCompany.postcode} | Tel: {currentCompany.phone}
            </p>
          </div>

          {/* Receipt Status Badge */}
          <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              {getTranslation(language, 'serviceCompletedPaid')}
            </div>
            <div className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-200">
              {job.invoiceNumber || 'INV-' + job.id.slice(0, 8)}
            </div>
          </div>

          {/* Itemized Info */}
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">{getTranslation(language, 'clientNameLabel')}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{job.clientName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">{getTranslation(language, 'addressPostcodeLabel')}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {job.address}, {job.postcode}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">{getTranslation(language, 'dateDurationLabel')}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {job.date} ({job.estimatedDuration} {getTranslation(language, 'hours')})
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-500 dark:text-slate-400">{getTranslation(language, 'assignedCleanerLabel')}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {job.cleanerName || 'W & J Cleaners Team'}
              </span>
            </div>
          </div>

          {/* Signature Preview */}
          {job.clientSignature && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                {getTranslation(language, 'clientSignatureLabel')}
              </span>
              <img
                src={job.clientSignature}
                alt="Client Signature"
                className="h-12 object-contain bg-white rounded p-1 border border-slate-200"
              />
            </div>
          )}

          {/* Total Amount / Execution Proof */}
          {userRole !== 'CLEANER' ? (
            <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-200 dark:border-blue-900">
              <span className="text-sm font-bold text-blue-900 dark:text-blue-200">{getTranslation(language, 'totalAmountPaid')}</span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                £{job.price.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Serviço Executado</span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                {job.estimatedDuration} {getTranslation(language, 'hours')}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          {userRole !== 'CLEANER' ? (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleWhatsAppShare}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" /> {getTranslation(language, 'sendWhatsApp')}
              </button>
              <button
                onClick={handlePrint}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" /> {getTranslation(language, 'printPdfReceipt')}
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                onClick={handlePrint}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" /> {getTranslation(language, 'printPdfReceipt')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
