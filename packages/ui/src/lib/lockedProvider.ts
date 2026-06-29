// Company API-data security policy: the provider connection is locked down.
// Only a single, hardcoded vendor ("MedGateway") is allowed to connect to this
// software. Users may configure its API key and rely on the auto-queried model
// list, but cannot add other providers/models or use any other model anywhere
// in the app (settings, chat model picker, agents, multi-run, etc.).
//
// To re-point the lock at a different vendor, change LOCKED_PROVIDER_ID below.
export const LOCKED_PROVIDER_ID = 'MedGateway';

// Normalize an id/name for tolerant matching: lowercase and strip anything that
// is not a letter or digit. So "MedGateway", "med-gateway", "med_gateway" and
// "Med Gateway" all match, while "github-models" does not.
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const LOCKED_NORMALIZED = normalize(LOCKED_PROVIDER_ID);

/**
 * Whether the given provider is the single allowed (locked) vendor.
 * Matches the locked id or display name case/separator-insensitively.
 */
export const isLockedProvider = (provider: { id?: string; name?: string } | null | undefined): boolean => {
  if (!provider) {
    return false;
  }
  const id = typeof provider.id === 'string' ? normalize(provider.id) : '';
  const name = typeof provider.name === 'string' ? normalize(provider.name) : '';
  return id === LOCKED_NORMALIZED || name === LOCKED_NORMALIZED;
};

/**
 * Keep only the locked vendor from a list of providers. Strict: no fallback to
 * other providers, so if the locked vendor is not configured the result is empty.
 */
export const filterLockedProviders = <T extends { id?: string; name?: string }>(providers: T[]): T[] =>
  providers.filter((provider) => isLockedProvider(provider));

/**
 * Resolve the single allowed provider from the backend-reported provider list.
 * Strict: returns undefined if the locked vendor is not present.
 */
export const findLockedProvider = <T extends { id?: string; name?: string }>(
  providers: T[],
): T | undefined => providers.find((provider) => isLockedProvider(provider));
