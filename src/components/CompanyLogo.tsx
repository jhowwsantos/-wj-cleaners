import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Company } from '../types';
import logoImg from '../assets/logo.png';

interface CompanyLogoProps {
  company: Partial<Company> & { name: string };
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  company,
  className = 'w-9 h-9 rounded-xl',
  iconClassName = 'w-5 h-5 text-white',
  textClassName = 'text-xs font-black text-white tracking-wider',
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state if logoUrl changes
  useEffect(() => {
    setImageError(false);
  }, [company.logoUrl]);

  // Check if company is W&J Cleaners or another company with a logo
  const isWJ = !company.id || company.id === 'comp_wj_london' || company.name?.toLowerCase().includes('w & j');
  const customUrl = company.logoUrl?.trim();
  const effectiveLogoUrl = customUrl || (isWJ ? logoImg || '/logo.png' : '');

  const hasCustomLogo = Boolean(effectiveLogoUrl);

  if (hasCustomLogo && !imageError && effectiveLogoUrl) {
    return (
      <img
        src={effectiveLogoUrl}
        alt={company.name || 'W & J Cleaners'}
        className={`${className} object-contain p-0.5 shrink-0 border border-slate-200 dark:border-slate-700/80 shadow-xs bg-white dark:bg-slate-800`}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback: Neutral company badge with primary color & initials / building icon
  const cleanName = (company.name || 'Company').replace(/\([^)]*\)/g, '').trim();
  const words = cleanName.split(' ').filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : cleanName.slice(0, 2).toUpperCase();

  const bgStyle = company.primaryColor
    ? { backgroundColor: company.primaryColor }
    : { backgroundColor: '#1e3a8a' };

  return (
    <div
      className={`${className} shrink-0 flex items-center justify-center font-bold shadow-xs select-none border border-black/10 dark:border-white/10`}
      style={bgStyle}
      title={company.name}
    >
      {initials ? (
        <span className={textClassName}>{initials}</span>
      ) : (
        <Building2 className={iconClassName} />
      )}
    </div>
  );
};
