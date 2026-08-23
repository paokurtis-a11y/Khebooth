import { readFile } from 'node:fs/promises';

const files = [
  'apps/web/app/dashboard/page.tsx',
  'apps/web/app/presets/page.tsx',
  'apps/web/app/settings/page.tsx',
  'apps/web/components/portal-shell.tsx',
  'apps/web/components/event-ready-monitor.tsx',
  'apps/web/components/web-startup-intro.tsx',
];
const languages = ['fr', 'en', 'de', 'it', 'es', 'pt'];
const failures = [];
for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const missing = languages.filter((language) => !source.includes(`${language}:`) && !source.includes(`${language},`));
  if (missing.length) failures.push(`${file}: missing locale entries ${missing.join(', ')}`);
  if (!source.includes('khe-language-changed')) failures.push(`${file}: language changes are not observed at runtime`);
}
if (failures.length) {
  console.error('KHE i18n guard failed:\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`KHE i18n guard: ${files.length} critical surfaces cover FR/EN/DE/IT/ES/PT.`);
