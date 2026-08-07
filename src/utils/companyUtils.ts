export interface CompanyLike {
  id?: string;
  name?: string;
}

/**
 * Checks if a company is W&J Cleaners (main SaaS owner company)
 * or a multi-tenant client branch.
 */
export const isWJCompany = (company?: CompanyLike | null): boolean => {
  if (!company) return true; // Safe default: treat uninitialized as W&J Cleaners
  const id = (company.id || '').toLowerCase();
  const name = (company.name || '').toLowerCase();

  if (
    !id ||
    id === 'comp_wj_london' ||
    id === 'comp_wj_mcr' ||
    id.includes('wj') ||
    name.includes('w & j') ||
    name.includes('w&j') ||
    name.includes('wj cleaners')
  ) {
    return true;
  }

  return false;
};
