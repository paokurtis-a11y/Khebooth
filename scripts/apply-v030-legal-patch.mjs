import { readFileSync, writeFileSync } from 'node:fs';

const path = 'apps/mobile/src/legal/legal-and-info.tsx';
let source = readFileSync(path, 'utf8');

const versionBefore = "export const APP_VERSION = '0.2.0';";
const revisionBefore = "export const LEGAL_CONTENT_REVISION = '2026-08-16.1';";
if (!source.includes(versionBefore)) throw new Error('Expected APP_VERSION 0.2.0 not found; aborting.');
if (!source.includes(revisionBefore)) throw new Error('Expected legal revision 2026-08-16.1 not found; aborting.');
source = source.replace(versionBefore, "export const APP_VERSION = '0.3.0';");
source = source.replace(revisionBefore, "export const LEGAL_CONTENT_REVISION = '2026-08-16.2';");
writeFileSync(path, source);
console.log('Legal version aligned to KHE Booth 0.3.0 / 2026-08-16.2');
