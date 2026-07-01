const fs = require('fs');
const path = require('path');

const files = [
  'es.settings.ts',
  'fr.settings.ts',
  'ko.settings.ts',
  'pl.settings.ts',
  'pt-BR.settings.ts',
  'uk.settings.ts',
  'zh-TW.settings.ts'
];

const dir = 'packages/ui/src/lib/i18n/messages';

files.forEach(filename => {
  const file = path.join(dir, filename);
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('baseUrlLabel')) {
    content = content.replace(
      /([\"']settings\.providers\.page\.auth\.apiKeyPlaceholder[\"']: [^]+?,)/,
      "$1\n  \"settings.providers.page.auth.baseUrlLabel\": \"Base URL\",\n  \"settings.providers.page.auth.baseUrlTooltip\": \"Optional. Custom endpoint for the provider. Auto-fetches models when saved.\",\n  \"settings.providers.page.auth.baseUrlPlaceholder\": \"https://api.openai.com\","
    );
  }

  if (!content.includes('saveConfig')) {
    content = content.replace(
      /([\"']settings\.providers\.page\.actions\.saveKey[\"']: [^]+?,)/,
      "$1\n  \"settings.providers.page.actions.saveConfig\": \"Save Config\","
    );
  }

  fs.writeFileSync(file, content, 'utf8');
});
