import React from 'react';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { ProviderLogo } from '@/components/ui/ProviderLogo';
import { useConfigStore } from '@/stores/useConfigStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { cn } from '@/lib/utils';
import { Icon } from "@/components/icon/Icon";
import { opencodeClient } from '@/lib/opencode/client';
import { useI18n } from '@/lib/i18n';
import { runtimeFetch } from '@/lib/runtime-fetch';
import { LOCKED_PROVIDER_ID, findLockedProvider } from './lockedProvider';

interface ProviderSourceInfo {
  exists: boolean;
  path?: string | null;
}

interface ProviderSources {
  auth: ProviderSourceInfo;
  user: ProviderSourceInfo;
  project: ProviderSourceInfo;
  custom?: ProviderSourceInfo;
}

const getCurrentDirectory = (): string | null => {
  const dir = opencodeClient.getDirectory();
  if (typeof dir === 'string' && dir.trim().length > 0) {
    return dir.trim();
  }
  return null;
};

interface ProvidersSidebarProps {
  onItemSelect?: () => void;
}

export const ProvidersSidebar: React.FC<ProvidersSidebarProps> = ({ onItemSelect }) => {
  const { t } = useI18n();
  const allProviders = useConfigStore((state) => state.providers);
  // Policy: only the single locked vendor is ever shown / selectable.
  const providers = React.useMemo(() => {
    const locked = findLockedProvider(allProviders);
    if (locked) {
      return [locked];
    }
    return [{ id: LOCKED_PROVIDER_ID, name: LOCKED_PROVIDER_ID, models: [] }];
  }, [allProviders]);
  const selectedProviderId = useConfigStore((state) => state.selectedProviderId);
  const setSelectedProvider = useConfigStore((state) => state.setSelectedProvider);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const [sourcesByProvider, setSourcesByProvider] = React.useState<Record<string, ProviderSources>>({});
  const directory = React.useMemo(() => {
    // tie refresh to active project changes (directory is stored in the client)
    void activeProjectId;
    return getCurrentDirectory();
  }, [activeProjectId]);

  React.useEffect(() => {
    if (providers.length === 0) {
      setSourcesByProvider({});
      return;
    }

    let cancelled = false;

    const loadAllSources = async () => {
      const tasks = providers.map(async (provider) => {
        try {
          const query = directory ? `?directory=${encodeURIComponent(directory)}` : '';
          // CodeCaptain-only metadata endpoint: the SDK exposes provider data but
          // not local auth/source-file provenance used by this settings sidebar.
          const response = await runtimeFetch(`/api/provider/${encodeURIComponent(provider.id)}/source${query}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) {
            return;
          }
          const payload = await response.json().catch(() => null);
          const sources = (payload?.sources ?? payload?.data?.sources) as ProviderSources | undefined;
          if (!sources) {
            return;
          }
          if (cancelled) {
            return;
          }
          setSourcesByProvider((prev) => ({
            ...prev,
            [provider.id]: sources,
          }));
        } catch {
          // ignore
        }
      });

      await Promise.all(tasks);
    };

    void loadAllSources();

    return () => {
      cancelled = true;
    };
  }, [directory, providers]);

  const bgClass = 'bg-background';

  return (
    <div className={cn('flex h-full flex-col', bgClass)}>
      <div className="border-b px-3 pt-4 pb-3">
        <h2 className="text-base font-semibold text-foreground mb-3">{t('settings.providers.sidebar.title')}</h2>
      </div>
      <div className="shrink-0 p-3 pt-0">
        <div className="flex items-center justify-between gap-2">
          <span className="typography-meta text-muted-foreground">{t('settings.providers.sidebar.total', { count: providers.length })}</span>
        </div>
      </div>

      <ScrollableOverlay outerClassName="flex-1 min-h-0" className="space-y-1 px-3 py-2 overflow-x-hidden">
        {providers.length === 0 ? (
          <div className="py-12 px-4 text-center text-muted-foreground">
            <Icon name="stack" className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="typography-ui-label font-medium">{t('settings.providers.sidebar.empty.title')}</p>
            <p className="typography-meta mt-1 opacity-75">{t('settings.providers.sidebar.empty.description')}</p>
          </div>
        ) : (
          <>
            {providers.map((provider) => (
              <ProviderListItem
                key={provider.id}
                provider={provider}
                selectedProviderId={selectedProviderId}
                onSelect={() => {
                  setSelectedProvider(provider.id);
                  onItemSelect?.();
                }}
              />
            ))}
          </>
        )}
      </ScrollableOverlay>
    </div>
  );
};

const ProviderListItem: React.FC<{
  provider: { id: string; name?: string; models?: unknown[] };
  selectedProviderId: string;
  onSelect: () => void;
}> = ({ provider, selectedProviderId, onSelect }) => {
  const modelCount = Array.isArray(provider.models) ? provider.models.length : 0;
  const isSelected = provider.id === selectedProviderId;

  return (
    <div
      key={provider.id}
      className={cn(
        'group relative flex items-center rounded-md px-1.5 py-1 transition-all duration-200',
        isSelected ? 'bg-interactive-selection' : 'hover:bg-interactive-hover'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        tabIndex={0}
      >
        <ProviderLogo providerId={provider.id} className="h-4 w-4 flex-shrink-0" />
        <span className="typography-ui-label font-normal truncate flex-1 min-w-0 text-foreground">
          {provider.name || provider.id}
        </span>
        <span className="typography-micro text-muted-foreground/60 flex-shrink-0">
          {modelCount}
        </span>
      </button>
    </div>
  );
};
