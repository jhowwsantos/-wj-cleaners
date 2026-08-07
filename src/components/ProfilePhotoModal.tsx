import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Check, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { getTranslation } from '../utils/i18n';
import { processAndUploadAvatar, AVATAR_PRESETS } from '../utils/avatarUpload';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: User | null;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  targetUser,
}) => {
  const { currentUser, updateUser, language } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeUser = targetUser || currentUser;

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [hasNewSelection, setHasNewSelection] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const defaultAvatar = AVATAR_PRESETS[0];

  useEffect(() => {
    if (activeUser && isOpen) {
      const current = activeUser.avatarUrl || defaultAvatar;
      setPreviewUrl(current);
      setHasNewSelection(false);
      setSuccessMsg('');
      setErrorMsg('');
      setIsUploading(false);
    }
  }, [activeUser, isOpen]);

  if (!isOpen || !activeUser) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    setIsUploading(true);

    try {
      const finalUrl = await processAndUploadAvatar(
        file,
        activeUser.id,
        (tempPreview) => {
          setPreviewUrl(tempPreview);
        }
      );
      setPreviewUrl(finalUrl);
      setHasNewSelection(true);
      setSuccessMsg(
        language === 'pt'
          ? 'Imagem pronta! Clique em Salvar para aplicar.'
          : 'Image ready! Click Save to apply.'
      );
    } catch (err: any) {
      setErrorMsg(
        err?.message || (language === 'pt' ? 'Erro ao carregar imagem.' : 'Error loading image.')
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    const finalAvatar = previewUrl.trim() || activeUser.avatarUrl || defaultAvatar;
    if (!finalAvatar) return;

    updateUser(activeUser.id, { avatarUrl: finalAvatar });
    setSuccessMsg(
      language === 'pt' ? 'Foto de perfil salva com sucesso!' : 'Profile photo saved successfully!'
    );

    setTimeout(() => {
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {language === 'pt' ? 'Foto de Perfil' : 'Profile Photo'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeUser.name} • {activeUser.role}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Native Mobile / Desktop File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="p-6 space-y-6 overflow-y-auto flex-1 overscroll-contain touch-pan-y">
          {/* Main Centered Profile Avatar */}
          <div className="flex flex-col items-center justify-center text-center">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title={
                language === 'pt'
                  ? 'Toque para escolher da galeria ou tirar foto'
                  : 'Tap to choose from gallery or take photo'
              }
            >
              <img
                src={previewUrl || defaultAvatar}
                alt={activeUser.name}
                className="w-32 h-32 rounded-full object-cover ring-4 ring-blue-500/30 shadow-xl transition-all group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.src = defaultAvatar;
                }}
              />
              <div className="absolute inset-0 rounded-full bg-slate-900/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white drop-shadow-md" />
                <span className="text-[10px] text-white font-extrabold mt-1">
                  {language === 'pt' ? 'Alterar' : 'Change'}
                </span>
              </div>
              <button
                type="button"
                className="absolute bottom-1 right-1 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg border-2 border-white dark:border-slate-800 transition-all cursor-pointer"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 font-medium">
              {language === 'pt'
                ? 'Toque na foto para abrir a Câmera ou Galeria'
                : 'Tap photo to open Camera or Gallery'}
            </p>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-2xl text-center">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-2xl flex items-center justify-center gap-1.5 text-center">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Single Big Upload Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-60 active:scale-98"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{language === 'pt' ? 'Processando Imagem...' : 'Processing Image...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>
                    {language === 'pt'
                      ? 'Escolher foto da Galeria ou Câmera'
                      : 'Choose photo from Gallery or Camera'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              {getTranslation(language, 'cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{getTranslation(language, 'saveChangesBtn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

