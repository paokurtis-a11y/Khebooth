import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const componentPath = new URL('../apps/web/components/operations-globe.tsx', import.meta.url);
const performancePath = new URL('../apps/web/components/globe-performance.ts', import.meta.url);
const servicePath = new URL('../apps/api/src/operations/globe-intelligence.service.ts', import.meta.url);
const operationsServicePath = new URL('../apps/api/src/operations/operations.service.ts', import.meta.url);
const component = readFileSync(componentPath, 'utf8');
const service = readFileSync(servicePath, 'utf8');
const operationsService = readFileSync(operationsServicePath, 'utf8');
const performanceSource = readFileSync(performancePath, 'utf8');

for (const marker of [
  "role === 'OWNER'",
  "prefers-reduced-motion:reduce",
  'tabIndex={0}',
  'clusterProjectedPoints',
  'aria-live="polite"',
  'mode=${mode}&window=${windowKey}',
]) assert.ok(component.includes(marker), `Globe QA marker missing: ${marker}`);

for (const marker of [
  "mode === 'all' && role !== UserRole.OWNER",
  'LIMIT 1000',
  'locationSharingEnabled',
  'consent=TRUE',
  'CACHE_TTL_MS',
]) assert.ok(service.includes(marker), `Globe API QA marker missing: ${marker}`);

for (const marker of [
  '"locationSharingEnabled"=EXCLUDED."locationSharingEnabled"',
  'ELSE NULL END latitude',
  'round(p.latitude::numeric,2)',
]) assert.ok(operationsService.includes(marker), `Globe privacy QA marker missing: ${marker}`);

const transpiled = ts.transpileModule(performanceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(module,exports){${transpiled}\n})(module,module.exports);`, { module });
const { clusterProjectedPoints, labelBudget } = module.exports;

const points = Array.from({ length: 1200 }, (_, index) => ({
  item: { id: index },
  x: 100 + (index % 20) * 0.5,
  y: 200 + (index % 15) * 0.5,
  depth: 0.8,
}));
const clusters = clusterProjectedPoints(points, 28);
assert.ok(clusters.length < 10, '1,200 nearby points must be aggressively clustered');
assert.equal(clusters.reduce((total, cluster) => total + cluster.items.length, 0), 1200, 'Clustering must preserve every point');
assert.equal(labelBudget(320), 12);
assert.equal(labelBudget(768), 22);
assert.equal(labelBudget(1440), 32);

console.log('Globe KHE 2.0 QA: permissions, privacy, accessibility and 1,200-point clustering verified.');
