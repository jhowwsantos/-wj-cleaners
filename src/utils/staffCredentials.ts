import { User } from '../types';

/**
 * Generates an automated email address in the format 'nome.sobrenome@wjcleaners.co.uk'
 * - Removes accents (NFD normalization)
 * - Converts to lowercase
 * - Removes non-alphanumeric characters
 * - Uses first name and last name (or single word if only one)
 * - Checks for duplicates against existing users and appends numbers (2, 3, 4...) if needed.
 */
export function generateStaffEmail(fullName: string, existingUsers: User[], companyDomain?: string): string {
  if (!fullName || !fullName.trim()) return '';

  // 1. Remove accents and convert to lowercase
  const normalized = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // 2. Keep only letters, numbers, and spaces
  const cleaned = normalized.replace(/[^a-z0-9\s]/g, '').trim();
  if (!cleaned) return '';

  const words = cleaned.split(/\s+/).filter(Boolean);
  let basePrefix = '';

  if (words.length === 1) {
    basePrefix = words[0];
  } else {
    // First name and last name
    const firstName = words[0];
    const lastName = words[words.length - 1];
    basePrefix = `${firstName}.${lastName}`;
  }

  let domain = 'wjcleaners.co.uk';
  if (companyDomain) {
    const cleanDomain = companyDomain.includes('@') ? companyDomain.split('@')[1] : companyDomain;
    if (cleanDomain && cleanDomain.trim()) {
      domain = cleanDomain.trim().toLowerCase();
    }
  }

  const existingEmails = new Set(
    existingUsers.map((u) => u.email.toLowerCase().trim())
  );

  let candidate = `${basePrefix}@${domain}`;
  let count = 2;

  while (existingEmails.has(candidate)) {
    candidate = `${basePrefix}${count}@${domain}`;
    count++;
  }

  return candidate;
}

/**
 * Generates an automatic secure password with at least 12 characters,
 * containing uppercase, lowercase, numbers, and special characters.
 */
export function generateSecurePassword(length = 12): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*';

  const all = uppers + lowers + numbers + symbols;

  // Guarantee at least 1 character from each group
  const pwd = [
    uppers[Math.floor(Math.random() * uppers.length)],
    lowers[Math.floor(Math.random() * lowers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join('');
}
