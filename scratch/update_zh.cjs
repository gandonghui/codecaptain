const fs = require('fs');
const file = 'packages/ui/src/lib/i18n/messages/zh-CN.settings.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('baseUrlLabel')) {
  content = content.replace(
    /('settings\.providers\.page\.auth\.apiKeyPlaceholder': 'sk-\.\.\.',)/,
    "$1\n  'settings.providers.page.auth.baseUrlLabel': 'Base URL',\n  'settings.providers.page.auth.baseUrlTooltip': '可选。提供商的自定义端点。保存时自动获取模型。',\n  'settings.providers.page.auth.baseUrlPlaceholder': 'https://api.openai.com',"
  );
}

if (!content.includes('saveConfig')) {
  content = content.replace(
    /('settings\.providers\.page\.actions\.saveKey': '[^]+?',)/,
    "$1\n  'settings.providers.page.actions.saveConfig': '保存配置',"
  );
}

fs.writeFileSync(file, content, 'utf8');
