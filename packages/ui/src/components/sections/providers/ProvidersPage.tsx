import React from 'react';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { ProviderLogo } from '@/components/ui/ProviderLogo';
import { useConfigStore } from '@/stores/useConfigStore';
import { useUIStore } from '@/stores/useUIStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons";
import { reloadOpenCodeConfiguration } from '@/stores/useAgentsStore';
import { cn } from '@/lib/utils';
import type { ModelMetadata } from '@/types';
import { getCurrentIntlLocale, useI18n } from '@/lib/i18n';
import { opencodeClient } from '@/lib/opencode/client';
import { runtimeFetch } from '@/lib/runtime-fetch';

import { LOCKED_PROVIDER_ID, findLockedProvider } from './lockedProvider';

const formatCompactNumber = (value: number) => new Intl.NumberFormat(getCurrentIntlLocale(), {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
}).format(value);

const formatTokens = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  if (value === 0) {
    return '0';
  }
  const formatted = formatCompactNumber(value);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
};



export const ProvidersPage: React.FC = () => {
  const { t } = useI18n();
  const allProviders = useConfigStore((state) => state.providers);
  const providers = React.useMemo(() => {
    const locked = findLockedProvider(allProviders);
    if (locked) {
      return [locked];
    }
    return [{ id: LOCKED_PROVIDER_ID, name: LOCKED_PROVIDER_ID, models: [] }];
  }, [allProviders]);
  const selectedProviderId = useConfigStore((state) => state.selectedProviderId);
  const setSelectedProvider = useConfigStore((state) => state.setSelectedProvider);
  const getModelMetadata = useConfigStore((state) => state.getModelMetadata);
  const hiddenModels = useUIStore((state) => state.hiddenModels);
  const toggleHiddenModel = useUIStore((state) => state.toggleHiddenModel);
  const hideAllModels = useUIStore((state) => state.hideAllModels);
  const showAllModels = useUIStore((state) => state.showAllModels);

  const [modelQuery, setModelQuery] = React.useState('');
  const [apiKeyInputs, setApiKeyInputs] = React.useState<Record<string, string>>({});
  const [baseURLInputs, setBaseURLInputs] = React.useState<Record<string, string>>({});
  const [customModelInputs, setCustomModelInputs] = React.useState<Record<string, string>>({});
  const [authBusyKey, setAuthBusyKey] = React.useState<string | null>(null);
  const [showAuthPanel, setShowAuthPanel] = React.useState(false);

  React.useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      setSelectedProvider(providers[0].id);
    }
  }, [providers, selectedProviderId, setSelectedProvider]);


  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);

  const handleSaveConfig = async (providerId: string) => {
    const apiKey = apiKeyInputs[providerId]?.trim() ?? '';
    const baseURL = baseURLInputs[providerId]?.trim();
    if (!apiKey && !baseURL) {
      toast.error(t('settings.providers.page.toast.apiKeyRequired'));
      return;
    }

    const busyKey = `api:${providerId}`;
    setAuthBusyKey(busyKey);

    try {
      if (apiKey) {
        const result = await opencodeClient.getSdkClient().auth.set({
          providerID: providerId,
          auth: { type: 'api', key: apiKey },
        });
        if (result.error) {
          throw new Error(t('settings.providers.page.toast.apiKeySaveFailed'));
        }
      }

      if (baseURL) {
        const response = await runtimeFetch(`/api/provider/${encodeURIComponent(providerId)}/configure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseURL, apiKey: apiKey || undefined }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to configure provider');
        }
      }

      toast.success(t('settings.providers.page.toast.apiKeySaved'));
      setApiKeyInputs((prev) => ({ ...prev, [providerId]: '' }));
      setBaseURLInputs((prev) => ({ ...prev, [providerId]: '' }));
      await reloadOpenCodeConfiguration({ scopes: ["providers"], mode: "active" });
      setSelectedProvider(providerId);
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error(error instanceof Error ? error.message : t('settings.providers.page.toast.apiKeySaveFailed'));
    } finally {
      setAuthBusyKey(null);
    }
  };

  const handleAddCustomModel = async (providerId: string) => {
    const input = customModelInputs[providerId]?.trim();
    if (!input) return;
    
    const customModels = input.split(',').map(s => s.trim()).filter(Boolean);
    if (customModels.length === 0) return;

    try {
      const response = await runtimeFetch(`/api/provider/${encodeURIComponent(providerId)}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customModels }),
      });
      if (!response.ok) {
        throw new Error('Failed to add custom models');
      }
      setCustomModelInputs((prev) => ({ ...prev, [providerId]: '' }));
      await reloadOpenCodeConfiguration({ scopes: ["providers"], mode: "active" });
    } catch (error) {
      console.error('Failed to add custom model:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add custom model');
    }
  };

  if (providers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Icon name="stack" className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p className="typography-body">{t('settings.providers.page.empty.noProvidersDetected')}</p>
          <p className="typography-meta mt-1 opacity-75">{t('settings.providers.page.empty.checkOpenCodeConfiguration')}</p>
        </div>
      </div>
    );
  }
  if (!selectedProvider) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Icon name="stack" className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p className="typography-body">{t('settings.providers.page.empty.selectProviderFromSidebar')}</p>
          <p className="typography-meta mt-1 opacity-75">{t('settings.providers.page.empty.reviewDetailsAndConfigureAuth')}</p>
        </div>
      </div>
    );
  }

  const providerModels = Array.isArray(selectedProvider.models) ? selectedProvider.models : [];

  const filteredModels = providerModels.filter((model) => {
    const name = typeof model?.name === 'string' ? model.name : '';
    const id = typeof model?.id === 'string' ? model.id : '';
    const query = modelQuery.trim().toLowerCase();
    if (!query) return true;
    return name.toLowerCase().includes(query) || id.toLowerCase().includes(query);
  });

  return (
    <ScrollableOverlay outerClassName="h-full" className="w-full">
      <div className="mx-auto w-full max-w-3xl p-3 sm:p-6 sm:pt-8">

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <ProviderLogo providerId={selectedProvider.id} className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h2 className="typography-ui-header font-semibold text-foreground truncate">
              {selectedProvider.name || selectedProvider.id}
            </h2>
            <p className="typography-meta text-muted-foreground truncate">
              <span className="font-mono">{selectedProvider.id}</span>
            </p>
          </div>
        </div>

        {/* Authentication */}
        <div data-settings-item="providers.auth" className="mb-8">
          <div className="mb-1 px-1 flex items-center justify-between gap-2">
            <h3 className="typography-ui-header font-medium text-foreground">{t('settings.providers.page.auth.title')}</h3>
            <Button
              variant="outline"
              size="xs"
              className="!font-normal"
              onClick={() => setShowAuthPanel((prev) => !prev)}
            >
              {showAuthPanel ? t('settings.providers.page.actions.hide') : t('settings.providers.page.actions.reconnect')}
            </Button>
          </div>

          <section className="px-2 pb-2 pt-0">
            {!showAuthPanel ? (
              <div className="flex items-center gap-1.5 py-1.5">
                <Icon name="check" className="w-4 h-4 text-[var(--status-success)] shrink-0" />
                <span className="typography-ui-label text-foreground">{t('settings.providers.page.auth.connected')}</span>
                <span className="typography-meta text-muted-foreground ml-1">{t('settings.providers.page.auth.useReconnectHint')}</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="py-1.5 mb-2">
                  <label className="typography-ui-label text-foreground flex items-center gap-1.5">
                    {t('settings.providers.page.auth.baseUrlLabel')}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Icon name="information" className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} className="max-w-xs">
                        {t('settings.providers.page.auth.baseUrlTooltip')}
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1.5">
                    <Input
                      type="text"
                      value={baseURLInputs[selectedProvider.id] ?? ''}
                      onChange={(event) =>
                        setBaseURLInputs((prev) => ({
                          ...prev,
                          [selectedProvider.id]: event.target.value,
                        }))
                      }
                      placeholder={t('settings.providers.page.auth.baseUrlPlaceholder')}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="py-1.5">
                  <label className="typography-ui-label text-foreground flex items-center gap-1.5">
                    {t('settings.providers.page.auth.apiKeyLabel')}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Icon name="information" className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} className="max-w-xs">
                        {t('settings.providers.page.auth.apiKeyTooltip')}
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1.5">
                    <Input
                      type="password"
                      value={apiKeyInputs[selectedProvider.id] ?? ''}
                      onChange={(event) =>
                        setApiKeyInputs((prev) => ({
                          ...prev,
                          [selectedProvider.id]: event.target.value,
                        }))
                      }
                      placeholder={t('settings.providers.page.auth.apiKeyPlaceholder')}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      size="xs"
                      className="!font-normal shrink-0"
                      onClick={() => handleSaveConfig(selectedProvider.id)}
                      disabled={authBusyKey === `api:${selectedProvider.id}`}
                    >
                      {authBusyKey === `api:${selectedProvider.id}` ? t('settings.providers.page.actions.saving') : t('settings.providers.page.actions.saveConfig')}
                    </Button>
                  </div>
                </div>

              </div>
            )}
          </section>
        </div>

        {/* Models */}
        <div data-settings-item="providers.models" className="mb-8">
          <div className="mb-1 px-1 flex items-center justify-between gap-2">
            <h3 className="typography-ui-header font-medium text-foreground">
              {t('settings.providers.page.models.title')}
              {providerModels.length > 0 && (
                <span className="ml-1.5 typography-micro text-muted-foreground font-normal">
                  ({providerModels.length})
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="xs"
                className="!font-normal"
                onClick={() => {
                  const allIds = providerModels
                    .map((model) => (typeof model?.id === 'string' ? model.id : ''))
                    .filter((id) => id.length > 0);
                  hideAllModels(selectedProvider.id, allIds);
                }}
              >
                {t('settings.providers.page.actions.hideAll')}
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="!font-normal"
                onClick={() => showAllModels(selectedProvider.id)}
              >
                {t('settings.providers.page.actions.showAll')}
              </Button>
            </div>
          </div>

          <section className="px-2 pb-2 pt-0">
            <div className="relative mb-2">
              <Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={modelQuery}
                onChange={(event) => setModelQuery(event.target.value)}
                placeholder={t('settings.providers.page.models.filterPlaceholder')}
                className="h-7 pl-8 w-full"
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Input
                value={customModelInputs[selectedProvider.id] ?? ''}
                onChange={(e) => setCustomModelInputs(prev => ({ ...prev, [selectedProvider.id]: e.target.value }))}
                placeholder={t('settings.providers.page.models.addCustomModelPlaceholder')}
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomModel(selectedProvider.id);
                }}
              />
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleAddCustomModel(selectedProvider.id)}
              >
                {t('settings.providers.page.models.actions.addCustomModel')}
              </Button>
            </div>

            {filteredModels.length === 0 ? (
              <p className="typography-meta text-muted-foreground py-4 text-center">{t('settings.providers.page.models.noModelsMatchFilter')}</p>
            ) : (
              <div className="divide-y divide-[var(--surface-subtle)]">
                {filteredModels.map((model) => {
                  const modelId = typeof model?.id === 'string' ? model.id : '';
                  const modelName = typeof model?.name === 'string' ? model.name : modelId;
                  const metadata = modelId ? getModelMetadata(selectedProvider.id, modelId) as ModelMetadata | undefined : undefined;
                  const isHidden = hiddenModels.some(
                    (item) => item.providerID === selectedProvider.id && item.modelID === modelId
                  );

                  const contextTokens = formatTokens(metadata?.limit?.context);
                  const outputTokens = formatTokens(metadata?.limit?.output);

                  const capabilityIcons: Array<{ key: string; icon: IconName; label: string }> = [];
                  if (metadata?.tool_call) capabilityIcons.push({ key: 'tools', icon: "tools", label: t('settings.providers.page.models.capability.toolCalling') });
                  if (metadata?.reasoning) capabilityIcons.push({ key: 'reasoning', icon: "brain-ai-3", label: t('settings.providers.page.models.capability.reasoning') });
                  if (metadata?.attachment) capabilityIcons.push({ key: 'image', icon: "file-image", label: t('settings.providers.page.models.capability.imageInput') });

                  return (
                    <div key={modelId} className="py-1.5">
                      <div
                        className={cn(
                          "flex items-center gap-3",
                          isHidden && 'opacity-50',
                        )}
                      >
                      <span className="typography-meta font-medium text-foreground truncate flex-1 min-w-0">
                        {modelName}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(contextTokens || outputTokens) && (
                          <span className="typography-micro text-muted-foreground flex-shrink-0 bg-[var(--surface-muted)] px-1.5 py-0.5 rounded">
                            {contextTokens ? `${contextTokens} ${t('settings.providers.page.models.tokenBadge.context')}` : ''}
                            {contextTokens && outputTokens ? ' · ' : ''}
                            {outputTokens ? `${outputTokens} ${t('settings.providers.page.models.tokenBadge.output')}` : ''}
                          </span>
                        )}
                        {capabilityIcons.length > 0 && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {capabilityIcons.map(({ key, icon: iconName, label }) => (
                              <span
                                key={key}
                                className="flex h-5 w-5 rounded items-center justify-center text-muted-foreground bg-[var(--surface-muted)]"
                                title={label}
                                aria-label={label}
                              >
                                <Icon name={iconName} className="h-3 w-3" />
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleHiddenModel(selectedProvider.id, modelId)}
                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-[var(--interactive-hover)]/50"
                          title={isHidden ? t('settings.providers.page.models.actions.showModelInSelectors') : t('settings.providers.page.models.actions.hideModelFromSelectors')}
                          aria-label={isHidden ? t('settings.providers.page.models.actions.showModel') : t('settings.providers.page.models.actions.hideModel')}
                        >
                          {isHidden ? <Icon name="eye-off" className="h-3.5 w-3.5" /> : <Icon name="eye" className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </ScrollableOverlay>
  );
};
