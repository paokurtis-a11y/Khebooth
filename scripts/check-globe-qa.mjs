import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const componentPath = new URL('../apps/web/components/operations-globe.tsx', import.meta.url);
const cameraPath = new URL('../apps/web/components/globe-camera.ts', import.meta.url);
const performancePath = new URL('../apps/web/components/globe-performance.ts', import.meta.url);
const servicePath = new URL('../apps/api/src/operations/globe-intelligence.service.ts', import.meta.url);
const operationsServicePath = new URL('../apps/api/src/operations/operations.service.ts', import.meta.url);
const weatherRoutePath = new URL('../apps/web/app/api/globe-weather/route.ts', import.meta.url);
const operationsPagePath = new URL('../apps/web/app/operations/page.tsx', import.meta.url);
const analyticsBeaconPath = new URL('../apps/web/components/analytics-beacon.tsx', import.meta.url);
const portalMenuCssPath = new URL('../apps/web/app/portal-menu-enhancements.css', import.meta.url);
const responsivePlatformPath = new URL('../apps/web/app/responsive-platform.css', import.meta.url);
const rootLayoutPath = new URL('../apps/web/app/layout.tsx', import.meta.url);
const marketingPagePath = new URL('../apps/web/app/page.tsx', import.meta.url);
const marketingCartPath = new URL('../apps/web/components/marketing-cart.tsx', import.meta.url);
const supportCenterPath = new URL('../apps/web/components/support-center-tools.tsx', import.meta.url);
const currencySelectorPath = new URL('../apps/web/components/currency-selector.tsx', import.meta.url);
const experienceEnhancementsPath = new URL('../apps/web/app/experience-enhancements.css', import.meta.url);
const portalShellPath = new URL('../apps/web/components/portal-shell.tsx', import.meta.url);
const globalErrorPath = new URL('../apps/web/app/global-error.tsx', import.meta.url);
const component = readFileSync(componentPath, 'utf8');
const service = readFileSync(servicePath, 'utf8');
const operationsService = readFileSync(operationsServicePath, 'utf8');
const weatherRoute = readFileSync(weatherRoutePath, 'utf8');
const operationsPage = readFileSync(operationsPagePath, 'utf8');
const analyticsBeacon = readFileSync(analyticsBeaconPath, 'utf8');
const portalMenuCss = readFileSync(portalMenuCssPath, 'utf8');
const responsivePlatform = readFileSync(responsivePlatformPath, 'utf8');
const rootLayoutSource = readFileSync(rootLayoutPath, 'utf8');
const marketingPageSource = readFileSync(marketingPagePath, 'utf8');
const marketingCartSource = readFileSync(marketingCartPath, 'utf8');
const supportCenterSource = readFileSync(supportCenterPath, 'utf8');
const currencySelectorSource = readFileSync(currencySelectorPath, 'utf8');
const experienceEnhancements = readFileSync(experienceEnhancementsPath, 'utf8');
const portalShellSource = readFileSync(portalShellPath, 'utf8');
const globalErrorSource = readFileSync(globalErrorPath, 'utf8');
const cameraSource = readFileSync(cameraPath, 'utf8');
const performanceSource = readFileSync(performancePath, 'utf8');

for (const marker of [
  "role === 'OWNER'",
  "prefers-reduced-motion:reduce",
  'tabIndex={0}',
  'clusterProjectedPoints',
  'aria-live="polite"',
  'mode=${mode}&window=${windowKey}',
  'coordinateValue(agent.longitude, -180, 180)',
  'coordinateValue(client.lastLongitude, -180, 180)',
  'advanceFocus',
  'toggleAutoRotation',
  "zoomLevel==='municipality'",
  'motionOverrideRef.current = true',
  'normalizeOverview',
  'Array.isArray(data.features)',
  'media.addListener?.(updateMotion)',
  'onPointerMove={handlePointerMove}',
  'onPointerCancel={handlePointerEnd}',
  'onDoubleClick={handleDoubleClick}',
  'onWheel={handleWheel}',
  'touch-action:none',
  'zt.gesture',
  'contactActions(agent.email, agent.phone)',
  'contactActions(client.email, client.phone)',
  'href={contact.href}',
  'className="cluster-members"',
  "selectAgent(member.item,[member.item])",
  "selectClient(member.item,[member.item])",
  'WEATHER_BATCH_SIZE',
  'weatherMarkers.map',
  'setWeatherPlaying',
  'Weather data by Open‑Meteo.com',
  'managedAccount',
  "mode === 'growth' || mode === 'all'",
  'expanded = false',
  '.operations-globe.expanded .world-globe',
  'normalizeSearch(searchTerm)',
  'role="listbox"',
  'chooseSearchResult',
  'hasCoordinatePair',
  'insights.reliability',
  'coveragePercent',
  'operationalAlerts',
  'insights.noAlerts',
  "type Mode = 'agents' | 'clients' | 'relations' | 'visitors'",
  'liveVisitors',
  'visitorClusters',
  'showVisitors',
  'selectVisitor',
  'vt.privacy',
  'className="clickable live-visitor-marker"',
  '.modebar{display:grid',
  'grid-template-columns:repeat(2,minmax(0,1fr))',
]) assert.ok(component.includes(marker), `Globe QA marker missing: ${marker}`);

for (const marker of ["type Tab='agents'|'globe'", 'tabGlobeFull', '<OperationsGlobe agents={agents} expanded/>', 'aria-pressed={tab===key}', "type VisitorMetric='visits'", "type ClientMetric='clients'", 'clientMetricRows', '<div className="grid two" style={{alignItems:', 'visitorMetricRows', 'aria-pressed={visitorMetric===key}', 't.detailAction', 'setVisitorMetric(null)', 'visitor.online', 't.liveNow', 't.leftSite']) {
  assert.ok(operationsPage.includes(marker), `Globe full-screen tab QA marker missing: ${marker}`);
}

for (const marker of [".portal-nav-group.is-open>.portal-nav-submenu", 'visibility:visible!important', 'height:auto!important', '.portal-nav-group.is-open>.portal-nav-submenu a{display:grid!important', '-webkit-overflow-scrolling:touch', 'overscroll-behavior:contain']) {
  assert.ok(portalMenuCss.includes(marker), `Mobile menu QA marker missing: ${marker}`);
}
for (const marker of ['hidden={!isOpen}', 'aria-hidden={!isOpen}']) {
  assert.ok(portalShellSource.includes(marker), `Mobile menu structure QA marker missing: ${marker}`);
}

for (const marker of [
  '-webkit-text-size-adjust:100%',
  '.content h1{',
  'font-size:clamp(1.75rem',
  '@media(max-width:1100px)',
  '@media(max-width:800px)',
  '@media(orientation:landscape) and (max-width:1000px) and (max-height:600px)',
  'grid-template-columns:clamp(250px,36vw,330px) minmax(0,1fr)!important',
  'height:100dvh!important',
  '.portal-nav-label',
  '.operations-globe .modebar',
  '.marketing-page .hero-copy h1',
]) {
  assert.ok(responsivePlatform.includes(marker), `Responsive platform QA marker missing: ${marker}`);
}
for (const marker of ["import './responsive-platform.css';", "import './experience-enhancements.css';", "width: 'device-width'", "viewportFit: 'cover'"]) {
  assert.ok(rootLayoutSource.includes(marker), `Responsive viewport QA marker missing: ${marker}`);
}

for (const marker of ["name==='chunkloaderror'", 'failed to load chunk', "url.searchParams.has('_khe_reload')", "console.error('[khe:web:global-error]'", 'window.location.replace(url.toString())', "reset();", 'Une erreur est survenue']) {
  assert.ok(globalErrorSource.includes(marker), `Browser recovery QA marker missing: ${marker}`);
}
for (const forbidden of ['|load failed|', '|failed to fetch|', '|network request failed|']) {
  assert.ok(!globalErrorSource.includes(forbidden), `Generic network failures must not trigger chunk recovery: ${forbidden}`);
}

for (const marker of ['MarketingCart', 'AddToCartButton', 'FEATURE_DETAILS', 'marketing-feature-detail', 'pricing-actions']) {
  assert.ok(marketingPageSource.includes(marker), `Marketing interaction QA marker missing: ${marker}`);
}
for (const marker of ['CART_KEY', 'marketing-cart-trigger', 'Continuer vers la souscription', 'Ajouter au panier']) {
  assert.ok(marketingCartSource.includes(marker), `Marketing cart QA marker missing: ${marker}`);
}
for (const marker of ['className="support-tools"', 'className="button secondary support-help"', 'support-bell-wrap', 'support-notification-panel']) {
  assert.ok(supportCenterSource.includes(marker), `Restored support controls QA marker missing: ${marker}`);
}
for (const marker of ['#fffdf8', '.popular-tag', 'overflow:visible!important', '.marketing-cart-panel', '.currency-selector select', 'color:var(--marketing-ink)!important']) {
  assert.ok(experienceEnhancements.includes(marker), `Promotional styling QA marker missing: ${marker}`);
}
for (const forbidden of ['.operations-world-card', '.support-help-dock', '.support-drag-handle']) {
  assert.ok(!experienceEnhancements.includes(forbidden), `Portal rollback styling must stay removed: ${forbidden}`);
}
for (const marker of ['🇨🇭 CHF · Suisse', '🇪🇺 EUR · Zone euro', '🇬🇧 GBP · Royaume-Uni', '🇺🇸 USD · États-Unis', '🇨🇦 CAD · Canada', '🇦🇺 AUD · Australie', 'aria-label="Devise et pays"']) {
  assert.ok(currencySelectorSource.includes(marker), `Currency selector QA marker missing: ${marker}`);
}

for (const marker of ['SESSION_HEARTBEAT', 'SESSION_ENDED', 'pagehide', '30000', "consent!=='accepted'"]) {
  assert.ok(analyticsBeacon.includes(marker), `Live visitor beacon QA marker missing: ${marker}`);
}

for (const marker of ['GLOBE_ZOOM_SCALES', 'municipality: 7', 'projectGlobePoint', 'easeCamera', 'clampGlobeScale', 'zoomLevelForScale']) {
  assert.ok(cameraSource.includes(marker), `Globe camera QA marker missing: ${marker}`);
}

assert.ok(
  component.includes('@keyframes detailReveal{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}'),
  'Globe CSS QA: detail animation must close before mobile and weather rules',
);

assert.ok(
  !component.includes('feature?.properties.LABEL_X); latitude = Number(feature?.properties.LABEL_Y)'),
  'Globe QA: a missing client coordinate must never fall back to an invented country point',
);

for (const marker of [
  "mode === 'all' && role !== UserRole.OWNER",
  'LIMIT 1000',
  'locationSharingEnabled',
  'consent=TRUE',
  'CACHE_TTL_MS',
  "row.subscriptionPlan === 'BUSINESS' || row.subscriptionPlan === 'ENTERPRISE'",
  'SELF_AND_ASSIGNED_AGENTS',
  'c.id=${managedClientId}::uuid',
  'requester."managedClientId"=${managedClientId}::uuid',
  "'visitors', 'growth', 'all'",
  'LIVE_VISITOR_TTL_SECONDS = 75',
  'DISTINCT ON ("sessionId")',
  'md5("sessionId") AS id',
  '"eventType"<>\'SESSION_ENDED\'',
  'includeLiveVisitors',
  "source: 'PROMOTIONAL_SITE'",
]) assert.ok(service.includes(marker), `Globe API QA marker missing: ${marker}`);

for (const marker of [
  '"locationSharingEnabled"=EXCLUDED."locationSharingEnabled"',
  'ELSE NULL END latitude',
  'round(p.latitude::numeric,2)',
  'u.id,u.email,u.phone',
  'Historique complet réservé à l’organisation KHE',
  'requester."managedClientId"=${scope.managedClientId}::uuid',
  'live_anonymous',
  '(l."anonymousId" IS NOT NULL) online',
]) assert.ok(operationsService.includes(marker), `Globe privacy QA marker missing: ${marker}`);

for (const marker of ['MAX_LOCATIONS = 40', 'OPEN_METEO_API_KEY', "process.env.VERCEL_ENV !== 'preview'", 'revalidate:CACHE_SECONDS']) {
  assert.ok(weatherRoute.includes(marker), `Globe weather proxy QA marker missing: ${marker}`);
}
assert.ok(service.includes('c.id,c.name,c.email,c.phone'), 'Globe contacts QA: client phone must be loaded by the protected overview');

const transpiled = ts.transpileModule(performanceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(module,exports){${transpiled}\n})(module,module.exports);`, { module });
const { clusterProjectedPoints, labelBudget } = module.exports;

const cameraTranspiled = ts.transpileModule(cameraSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cameraModule = { exports: {} };
vm.runInNewContext(`(function(module,exports){${cameraTranspiled}\n})(module,module.exports);`, { module:cameraModule });
const { GLOBE_ZOOM_SCALES, clampGlobeScale, continentCamera, easeCamera, projectGlobePoint, zoomLevelAt, zoomLevelForScale } = cameraModule.exports;

assert.equal(zoomLevelAt('world', 1), 'continent');
assert.equal(zoomLevelAt('continent', 1), 'country');
assert.equal(zoomLevelAt('country', 1), 'municipality');
assert.equal(zoomLevelAt('municipality', 1), 'municipality');
assert.equal(zoomLevelAt('world', -1), 'world');
assert.equal(clampGlobeScale(0.2), GLOBE_ZOOM_SCALES.world);
assert.equal(clampGlobeScale(20), GLOBE_ZOOM_SCALES.municipality);
assert.equal(zoomLevelForScale(1), 'world');
assert.equal(zoomLevelForScale(1.7), 'continent');
assert.equal(zoomLevelForScale(3.2), 'country');
assert.equal(zoomLevelForScale(7), 'municipality');
assert.equal(continentCamera('Europe', { longitude:0, latitude:0, scale:1 }).scale, GLOBE_ZOOM_SCALES.continent);
assert.equal(continentCamera('Europe', { longitude:0, latitude:0, scale:1 }).latitude, 50);
const centered = projectGlobePoint(7.45, 46.95, { longitude:7.45, latitude:46.95, scale:GLOBE_ZOOM_SCALES.municipality }, 260, 218);
assert.ok(centered.visible, 'Focused municipality must remain on the visible hemisphere');
assert.ok(Math.abs(centered.x - 260) < 0.001 && Math.abs(centered.y - 260) < 0.001, 'Focused target must project to the globe center');
const midway = easeCamera({ longitude:170, latitude:0, scale:1 }, { longitude:-170, latitude:50, scale:7 }, 0.5);
assert.ok(midway.scale > 1 && midway.scale < 7, 'Camera easing must interpolate scale');
assert.ok(Math.abs(midway.longitude) > 170, 'Camera easing must use the short path around the antimeridian');

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

console.log('Globe KHE 2.0 QA: permissions, privacy, live promotional visitors, clickable metrics, accessibility, full-screen tab, search, geographic reliability, operational alerts, hierarchical camera and 1,200-point clustering verified.');
