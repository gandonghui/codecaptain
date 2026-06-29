// Re-export from the shared source of truth so the providers UI and the global
// config store enforce the same single-vendor lock. See lib/lockedProvider.ts.
export {
  LOCKED_PROVIDER_ID,
  isLockedProvider,
  filterLockedProviders,
  findLockedProvider,
} from '@/lib/lockedProvider';
