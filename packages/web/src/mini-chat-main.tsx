import { createConfiguredWebAPIs } from './runtimeConfig';
import type { RuntimeAPIs } from '@codecaptain/ui/lib/api/types';
import '@codecaptain/ui/index.css';
import '@codecaptain/ui/styles/fonts';

declare global {
  interface Window {
    __CODECAPTAIN_RUNTIME_APIS__?: RuntimeAPIs;
  }
}

window.__CODECAPTAIN_RUNTIME_APIS__ = createConfiguredWebAPIs();

void import('@codecaptain/ui/apps/renderElectronMiniChatApp')
  .then(({ renderElectronMiniChatApp }) => {
    renderElectronMiniChatApp(window.__CODECAPTAIN_RUNTIME_APIS__ ?? createConfiguredWebAPIs());
  });
