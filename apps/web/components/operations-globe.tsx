'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { GLOBE_ZOOM_SCALES, continentCamera, easeCamera, normalizeLongitude, projectGlobePoint, zoomLevelAt, type GlobeCamera, type GlobeZoomLevel } from './globe-camera';
import { clusterProjectedPoints, labelBudget } from './globe-performance';

type Language = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';
type Mode = 'agents' | 'clients' | 'relations' | 'growth' | 'all';
type WindowKey = 'real-time' | '1d' | '7d' | '30d';
type StatusFilter = 'all' | 'online' | 'available' | 'busy' | 'offline' | 'risk' | 'regular' | 'business' | 'enterprise' | 'visitor' | 'engaged' | 'lead' | 'prospect' | 'customer';
type Stage = 'visitor' | 'engaged' | 'lead' | 'prospect' | 'client';
type CurrentUser = { role: string };
type AgentPoint = { id: string; email: string; firstName?: string | null; lastName?: string | null; online: boolean; available: boolean; availability?: string | null; countryCode?: string | null; regionCode?: string | null; municipality?: string | null; latitude?: number | null; longitude?: number | null };
type ClientPoint = { id: string; name: string; email?: string | null; companyName?: string | null; subscriptionPlan?: string; subscriptionStatus?: string; paymentStatus?: string; lastSeenAt?: string | null; lastCountryCode?: string | null; lastRegionCode?: string | null; lastMunicipality?: string | null; lastLatitude?: number | null; lastLongitude?: number | null; online?: boolean; regular?: boolean; engagementScore?: number; stationSessionCount?: number; eventCount?: number; activeEventCount?: number; captureOnline?: boolean; sharingOnline?: boolean; mediaCount?: number; pendingMediaCount?: number; failedMediaCount?: number };
type Geo = { countryCode?: string | null; regionCode?: string | null; municipality?: string | null; latitude?: number | null; longitude?: number | null; events: number; visitors: number; dominantStage: Stage; stages: Record<Stage, number> };
type RelationRecord = { id: string; status: string; subject: string; lastMessageAt: string; startedAt: string; agentId: string; clientId: string; channel: string; priority: string; slaRisk: boolean };
type GlobeOverview = { generatedAt: string; mode: Mode; window: WindowKey; capabilities: { canViewAll: boolean }; clients: ClientPoint[]; relations: RelationRecord[]; growth: { enabled: boolean; disabledReason?: string | null; geographies: Geo[]; summary: { visits: number; visitors: number; planSelections: number; checkouts: number; conversions: number } } };
type OwnerGeo = { isOwner: boolean; countryCode: string | null };
type CountryProps = { ADMIN?: string; CONTINENT?: string; LABELRANK?: number; LABEL_X?: number; LABEL_Y?: number; ISO_A2?: string; ISO_A2_EH?: string; NAME_FR?: string; NAME_EN?: string; NAME_DE?: string; NAME_IT?: string; NAME_ES?: string; NAME_PT?: string };
type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
type Country = { type: 'Feature'; properties: CountryProps; geometry: Geometry };
type WorldData = { type: 'FeatureCollection'; features: Country[] };
type MediaQueryListCompat = MediaQueryList & { addListener?: (listener: (event: MediaQueryListEvent) => void) => void; removeListener?: (listener: (event: MediaQueryListEvent) => void) => void };
type Selected = { key: string; title: string; subtitle: string; details: string[] } | null;
type FocusTarget = { key: string; title: string; longitude: number; latitude: number; countryCode?: string | null; municipality?: string | null };
type CameraCopy = { world:string; continent:string; country:string; municipality:string; back:string; reset:string; zoomIn:string; zoomOut:string; explore:string; reduced:string };

type Copy = {
  agents: string; clients: string; relations: string; growth: string; all: string; filters: string; status: string; geography: string; period: string;
  allStatuses: string; online: string; available: string; busy: string; offline: string; risk: string; world: string; rotate: string; auto: string; stop: string;
  ownerCurrent: string; privacy: string; loading: string; unavailable: string; noData: string; hidden: string; cluster: string; close: string; details: string;
  visitor: string; engaged: string; lead: string; prospect: string; client: string; events: string; stations: string; engagement: string; actions: string;
  activeEvent: string; capture: string; sharing: string; media: string; pending: string; failed: string; support: string; conversion: string; refreshed: string; regular: string; business: string; enterprise: string;
};

const WORLD_SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const copy: Record<Language, Copy> = {
  fr: { agents:'Agents',clients:'Clients',relations:'Relations',growth:'Croissance',all:'Tout',filters:'Filtres',status:'Statut',geography:'Zone',period:'Période',allStatuses:'Tous',online:'En ligne',available:'Disponible',busy:'Occupé',offline:'Hors ligne',risk:'SLA à risque',world:'Monde',rotate:'Rotation du globe',auto:'Rotation automatique',stop:'Arrêter la rotation',ownerCurrent:'OWNER · pays actuel',privacy:'Position estimée de zone, jamais un suivi GPS précis.',loading:'Chargement du Globe KHE…',unavailable:'Carte détaillée indisponible : le globe simplifié reste actif.',noData:'Aucune donnée géographique fiable pour cette couche.',hidden:'élément(s) sans zone restent dans les listes, sans point inventé.',cluster:'éléments dans cette zone',close:'Fermer',details:'Détails',visitor:'Visiteur',engaged:'Engagé',lead:'Lead',prospect:'Prospect',client:'Client',events:'événements',stations:'stations',engagement:'Engagement',actions:'actions',activeEvent:'événement actif',capture:'CAPTURE',sharing:'SHARING',media:'médias',pending:'en attente',failed:'échec',support:'Support actif',conversion:'Conversion',refreshed:'Actualisé',regular:'Régulier',business:'Business',enterprise:'Enterprise' },
  en: { agents:'Agents',clients:'Clients',relations:'Relations',growth:'Growth',all:'All',filters:'Filters',status:'Status',geography:'Area',period:'Period',allStatuses:'All',online:'Online',available:'Available',busy:'Busy',offline:'Offline',risk:'SLA at risk',world:'World',rotate:'Globe rotation',auto:'Auto rotate',stop:'Stop rotation',ownerCurrent:'OWNER · current country',privacy:'Approximate area only, never precise GPS tracking.',loading:'Loading KHE Globe…',unavailable:'Detailed map unavailable: the simplified globe remains active.',noData:'No reliable geographic data for this layer.',hidden:'item(s) without an area remain in lists, with no invented point.',cluster:'items in this area',close:'Close',details:'Details',visitor:'Visitor',engaged:'Engaged',lead:'Lead',prospect:'Prospect',client:'Client',events:'events',stations:'stations',engagement:'Engagement',actions:'actions',activeEvent:'active event',capture:'CAPTURE',sharing:'SHARING',media:'media',pending:'pending',failed:'failed',support:'Active support',conversion:'Conversion',refreshed:'Refreshed',regular:'Regular',business:'Business',enterprise:'Enterprise' },
  de: { agents:'Agenten',clients:'Kunden',relations:'Beziehungen',growth:'Wachstum',all:'Alle',filters:'Filter',status:'Status',geography:'Gebiet',period:'Zeitraum',allStatuses:'Alle',online:'Online',available:'Verfügbar',busy:'Beschäftigt',offline:'Offline',risk:'SLA gefährdet',world:'Welt',rotate:'Globus drehen',auto:'Automatisch drehen',stop:'Rotation stoppen',ownerCurrent:'OWNER · aktuelles Land',privacy:'Nur geschätztes Gebiet, niemals präzises GPS-Tracking.',loading:'KHE-Globus wird geladen…',unavailable:'Detailkarte nicht verfügbar: der vereinfachte Globus bleibt aktiv.',noData:'Keine verlässlichen Geodaten für diese Ebene.',hidden:'Element(e) ohne Gebiet bleiben in Listen, ohne erfundenen Punkt.',cluster:'Elemente in diesem Gebiet',close:'Schließen',details:'Details',visitor:'Besucher',engaged:'Engagiert',lead:'Lead',prospect:'Interessent',client:'Kunde',events:'Events',stations:'Stationen',engagement:'Engagement',actions:'Aktionen',activeEvent:'aktives Event',capture:'CAPTURE',sharing:'SHARING',media:'Medien',pending:'ausstehend',failed:'fehlgeschlagen',support:'Aktiver Support',conversion:'Konversion',refreshed:'Aktualisiert',regular:'Regelmäßig',business:'Business',enterprise:'Enterprise' },
  it: { agents:'Agenti',clients:'Clienti',relations:'Relazioni',growth:'Crescita',all:'Tutto',filters:'Filtri',status:'Stato',geography:'Zona',period:'Periodo',allStatuses:'Tutti',online:'Online',available:'Disponibile',busy:'Occupato',offline:'Offline',risk:'SLA a rischio',world:'Mondo',rotate:'Rotazione del globo',auto:'Rotazione automatica',stop:'Ferma rotazione',ownerCurrent:'OWNER · paese attuale',privacy:'Solo zona approssimativa, mai tracciamento GPS preciso.',loading:'Caricamento Globe KHE…',unavailable:'Mappa dettagliata non disponibile: il globo semplificato resta attivo.',noData:'Nessun dato geografico affidabile per questo livello.',hidden:'elemento/i senza zona restano nelle liste, senza punti inventati.',cluster:'elementi in questa zona',close:'Chiudi',details:'Dettagli',visitor:'Visitatore',engaged:'Coinvolto',lead:'Lead',prospect:'Potenziale',client:'Cliente',events:'eventi',stations:'stazioni',engagement:'Coinvolgimento',actions:'azioni',activeEvent:'evento attivo',capture:'CAPTURE',sharing:'SHARING',media:'media',pending:'in attesa',failed:'errore',support:'Supporto attivo',conversion:'Conversione',refreshed:'Aggiornato',regular:'Regolare',business:'Business',enterprise:'Enterprise' },
  es: { agents:'Agentes',clients:'Clientes',relations:'Relaciones',growth:'Crecimiento',all:'Todo',filters:'Filtros',status:'Estado',geography:'Zona',period:'Periodo',allStatuses:'Todos',online:'En línea',available:'Disponible',busy:'Ocupado',offline:'Sin conexión',risk:'SLA en riesgo',world:'Mundo',rotate:'Rotación del globo',auto:'Rotación automática',stop:'Detener rotación',ownerCurrent:'OWNER · país actual',privacy:'Solo zona aproximada, nunca seguimiento GPS preciso.',loading:'Cargando Globo KHE…',unavailable:'Mapa detallado no disponible: el globo simplificado sigue activo.',noData:'No hay datos geográficos fiables para esta capa.',hidden:'elemento(s) sin zona permanecen en listas, sin puntos inventados.',cluster:'elementos en esta zona',close:'Cerrar',details:'Detalles',visitor:'Visitante',engaged:'Interesado',lead:'Lead',prospect:'Prospecto',client:'Cliente',events:'eventos',stations:'estaciones',engagement:'Participación',actions:'acciones',activeEvent:'evento activo',capture:'CAPTURE',sharing:'SHARING',media:'medios',pending:'pendiente',failed:'fallo',support:'Soporte activo',conversion:'Conversión',refreshed:'Actualizado',regular:'Regular',business:'Business',enterprise:'Enterprise' },
  pt: { agents:'Agentes',clients:'Clientes',relations:'Relações',growth:'Crescimento',all:'Tudo',filters:'Filtros',status:'Estado',geography:'Zona',period:'Período',allStatuses:'Todos',online:'Online',available:'Disponível',busy:'Ocupado',offline:'Offline',risk:'SLA em risco',world:'Mundo',rotate:'Rotação do globo',auto:'Rotação automática',stop:'Parar rotação',ownerCurrent:'OWNER · país atual',privacy:'Apenas zona aproximada, nunca seguimento GPS preciso.',loading:'A carregar Globo KHE…',unavailable:'Mapa detalhado indisponível: o globo simplificado continua ativo.',noData:'Sem dados geográficos fiáveis para esta camada.',hidden:'elemento(s) sem zona permanecem nas listas, sem ponto inventado.',cluster:'elementos nesta zona',close:'Fechar',details:'Detalhes',visitor:'Visitante',engaged:'Envolvido',lead:'Lead',prospect:'Prospect',client:'Cliente',events:'eventos',stations:'estações',engagement:'Envolvimento',actions:'ações',activeEvent:'evento ativo',capture:'CAPTURE',sharing:'SHARING',media:'media',pending:'pendente',failed:'falha',support:'Suporte ativo',conversion:'Conversão',refreshed:'Atualizado',regular:'Regular',business:'Business',enterprise:'Enterprise' },
};

const stageColors: Record<Stage, string> = { visitor:'#718096',engaged:'#5aa6c9',lead:'#d8ae45',prospect:'#ef943f',client:'#7bd89b' };
const cameraCopy: Record<Language, CameraCopy> = {
  fr:{world:'Monde',continent:'Continent',country:'Pays',municipality:'Commune',back:'Retour',reset:'Vue mondiale',zoomIn:'Zoom avant',zoomOut:'Zoom arrière',explore:'Touchez plusieurs fois un point : continent → pays → commune.',reduced:'Rotation arrêtée par le réglage Réduire les animations. Vous pouvez la lancer manuellement.'},
  en:{world:'World',continent:'Continent',country:'Country',municipality:'Municipality',back:'Back',reset:'World view',zoomIn:'Zoom in',zoomOut:'Zoom out',explore:'Tap a point repeatedly: continent → country → municipality.',reduced:'Rotation is paused by Reduce Motion. You can start it manually.'},
  de:{world:'Welt',continent:'Kontinent',country:'Land',municipality:'Gemeinde',back:'Zurück',reset:'Weltansicht',zoomIn:'Vergrößern',zoomOut:'Verkleinern',explore:'Punkt mehrfach antippen: Kontinent → Land → Gemeinde.',reduced:'Die Rotation ist durch Bewegung reduzieren pausiert. Sie kann manuell gestartet werden.'},
  it:{world:'Mondo',continent:'Continente',country:'Paese',municipality:'Comune',back:'Indietro',reset:'Vista mondo',zoomIn:'Ingrandisci',zoomOut:'Riduci',explore:'Tocca più volte un punto: continente → paese → comune.',reduced:'La rotazione è sospesa da Riduci movimento. Puoi avviarla manualmente.'},
  es:{world:'Mundo',continent:'Continente',country:'País',municipality:'Municipio',back:'Atrás',reset:'Vista mundial',zoomIn:'Acercar',zoomOut:'Alejar',explore:'Toca varias veces un punto: continente → país → municipio.',reduced:'La rotación está pausada por Reducir movimiento. Puedes iniciarla manualmente.'},
  pt:{world:'Mundo',continent:'Continente',country:'País',municipality:'Município',back:'Voltar',reset:'Vista mundial',zoomIn:'Aumentar',zoomOut:'Diminuir',explore:'Toque várias vezes num ponto: continente → país → município.',reduced:'A rotação está pausada por Reduzir movimento. Pode iniciá-la manualmente.'},
};
function readLanguage(): Language { if (typeof window === 'undefined') return 'fr'; const value = window.localStorage.getItem('khe.web.language'); return value && value in copy ? value as Language : 'fr'; }
function rings(geometry: Geometry): number[][][] { return geometry.type === 'Polygon' ? geometry.coordinates as number[][][] : (geometry.coordinates as number[][][][]).flat(); }
function validCountry(value: unknown): value is Country {
  if (!value || typeof value !== 'object') return false;
  const feature = value as Partial<Country>;
  return Boolean(feature.properties && feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') && Array.isArray(feature.geometry.coordinates));
}
function normalizeOverview(value: unknown): GlobeOverview {
  const raw = value && typeof value === 'object' ? value as Partial<GlobeOverview> : {};
  const rawGrowth = raw.growth && typeof raw.growth === 'object' ? raw.growth : null;
  const rawSummary = rawGrowth?.summary && typeof rawGrowth.summary === 'object' ? rawGrowth.summary : null;
  const stage = (item: Partial<Geo>, name: Stage) => Number(item.stages?.[name] ?? 0);
  const geographies = Array.isArray(rawGrowth?.geographies) ? rawGrowth.geographies.filter((item): item is Geo => Boolean(item && typeof item === 'object')).map((item) => ({
    ...item,
    events: Number(item.events ?? 0), visitors: Number(item.visitors ?? 0),
    dominantStage: (['visitor','engaged','lead','prospect','client'] as Stage[]).includes(item.dominantStage) ? item.dominantStage : 'visitor',
    stages: { visitor:stage(item,'visitor'),engaged:stage(item,'engaged'),lead:stage(item,'lead'),prospect:stage(item,'prospect'),client:stage(item,'client') },
  })) : [];
  return {
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    mode: raw.mode ?? 'agents', window: raw.window ?? 'real-time',
    capabilities: raw.capabilities && typeof raw.capabilities === 'object' ? { canViewAll:Boolean(raw.capabilities.canViewAll) } : { canViewAll:false },
    clients: Array.isArray(raw.clients) ? raw.clients : [], relations: Array.isArray(raw.relations) ? raw.relations : [],
    growth: {
      enabled: rawGrowth?.enabled !== false,
      disabledReason: typeof rawGrowth?.disabledReason === 'string' ? rawGrowth.disabledReason : null,
      geographies,
      summary: {
        visits:Number(rawSummary?.visits ?? 0),visitors:Number(rawSummary?.visitors ?? 0),planSelections:Number(rawSummary?.planSelections ?? 0),
        checkouts:Number(rawSummary?.checkouts ?? 0),conversions:Number(rawSummary?.conversions ?? 0),
      },
    },
  };
}
function iso2(properties: CountryProps) { return String(properties.ISO_A2_EH || properties.ISO_A2 || '').toUpperCase(); }
function localizedCountry(properties: CountryProps, language: Language) { const key = `NAME_${language.toUpperCase()}` as keyof CountryProps; return String(properties[key] || properties.NAME_EN || properties.ADMIN || ''); }
function displayName(agent: AgentPoint) { return [agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email; }
function activate(event: React.KeyboardEvent, action: () => void) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } }
function coordinateValue(value: number | null | undefined, minimum: number, maximum: number) {
  if (value === null || value === undefined) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum ? coordinate : null;
}

export function OperationsGlobe({ agents }: { agents: AgentPoint[] }) {
  const [camera, setCamera] = useState<GlobeCamera>({ longitude:0, latitude:0, scale:GLOBE_ZOOM_SCALES.world });
  const [zoomLevel, setZoomLevel] = useState<GlobeZoomLevel>('world');
  const [zoomLabel, setZoomLabel] = useState('');
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [worldError, setWorldError] = useState(false);
  const [language, setLanguage] = useState<Language>('fr');
  const [role, setRole] = useState<string>('ADMIN');
  const [mode, setMode] = useState<Mode>('agents');
  const [windowKey, setWindowKey] = useState<WindowKey>('real-time');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [country, setCountry] = useState('all');
  const [overview, setOverview] = useState<GlobeOverview | null>(null);
  const [ownerGeo, setOwnerGeo] = useState<OwnerGeo | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1000);
  const ownerFocused = useRef(false);
  const frameRef = useRef<number | null>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const cameraRef = useRef(camera);
  const motionOverrideRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const lastFrameRef = useRef(0);
  const t = copy[language];
  const zt = cameraCopy[language];
  const size = 520, center = size / 2, radius = 218;
  const clients = Array.isArray(overview?.clients) ? overview.clients : [];
  const growth = Array.isArray(overview?.growth?.geographies) ? overview.growth.geographies : [];
  const relationRecords = Array.isArray(overview?.relations) ? overview.relations : [];
  const isOwner = role === 'OWNER';

  useEffect(() => {
    setLanguage(readLanguage());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)') as MediaQueryListCompat;
    const updateMotion = () => {
      reducedMotionRef.current = media.matches;
      setReducedMotion(media.matches);
      if (media.matches && !motionOverrideRef.current) setPlaying(false);
    };
    const updateWidth = () => setViewportWidth(window.innerWidth);
    const updateLanguage = (event: Event) => { const detail = (event as CustomEvent<string>).detail; if (detail && detail in copy) setLanguage(detail as Language); };
    updateMotion(); updateWidth();
    if (typeof media.addEventListener === 'function') media.addEventListener('change', updateMotion);
    else media.addListener?.(updateMotion);
    window.addEventListener('resize', updateWidth); window.addEventListener('khe-language-changed', updateLanguage);
    return () => {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', updateMotion);
      else media.removeListener?.(updateMotion);
      window.removeEventListener('resize', updateWidth); window.removeEventListener('khe-language-changed', updateLanguage);
    };
  }, []);

  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => () => {
    if (cameraFrameRef.current !== null) window.cancelAnimationFrame(cameraFrameRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(WORLD_SOURCE, { cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error('world map');
      const data = await response.json() as Partial<WorldData>;
      if (!Array.isArray(data.features)) throw new Error('world map');
      return { type:'FeatureCollection' as const, features:data.features.filter(validCountry) };
    }).then((data) => { if (active) setWorld(data); }).catch(() => { if (active) setWorldError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([apiRequest<CurrentUser>('/auth/me'), apiRequest<OwnerGeo>('/operations/geo/me')]).then((results) => {
      if (!active) return;
      if (results[0].status === 'fulfilled') setRole(results[0].value.role);
      if (results[1].status === 'fulfilled') setOwnerGeo(results[1].value);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (!isOwner && mode === 'all') setMode('agents'); }, [isOwner, mode]);
  useEffect(() => {
    setSelected(null); setCountry('all'); setStatus('all'); setFocusTarget(null); setZoomLevel('world'); setZoomLabel('');
    const next = { longitude:cameraRef.current.longitude, latitude:0, scale:GLOBE_ZOOM_SCALES.world };
    cameraRef.current = next; setCamera(next);
  }, [mode]);
  useEffect(() => { setSelected(null); }, [status, windowKey]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await apiRequest<GlobeOverview>(`/operations/globe/overview?mode=${mode}&window=${windowKey}`);
      setOverview(normalizeOverview(data)); setError('');
    } catch (loadError) {
      if (!quiet) setError(loadError instanceof Error ? loadError.message : t.noData);
    } finally { if (!quiet) setLoading(false); }
  }, [mode, t.noData, windowKey]);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 15_000); return () => window.clearInterval(timer); }, [load]);

  const animateCamera = useCallback((target: GlobeCamera, level: GlobeZoomLevel, label: string, onComplete?: () => void) => {
    if (cameraFrameRef.current !== null) window.cancelAnimationFrame(cameraFrameRef.current);
    setPlaying(false); setZoomLevel(level); setZoomLabel(label);
    const from = cameraRef.current;
    const duration = reducedMotionRef.current && !motionOverrideRef.current ? 0 : 720;
    if (!duration) {
      cameraRef.current = target; setCamera(target); onComplete?.(); return;
    }
    const startedAt = window.performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const next = easeCamera(from, target, progress);
      cameraRef.current = next; setCamera(next);
      if (progress < 1) cameraFrameRef.current = window.requestAnimationFrame(step);
      else { cameraFrameRef.current = null; onComplete?.(); }
    };
    cameraFrameRef.current = window.requestAnimationFrame(step);
  }, []);

  const project = useCallback((longitude: number, latitude: number) => {
    return projectGlobePoint(longitude, latitude, camera, center, radius);
  }, [camera]);

  useEffect(() => {
    if (!playing || zoomLevel !== 'world' || (reducedMotion && !motionOverrideRef.current)) return;
    const animate = (time: number) => {
      if (time - lastFrameRef.current >= 33) {
        setCamera((value) => {
          const next = { ...value, longitude:normalizeLongitude(value.longitude + 0.28), latitude:0, scale:GLOBE_ZOOM_SCALES.world };
          cameraRef.current = next; return next;
        });
        lastFrameRef.current = time;
      }
      frameRef.current = window.requestAnimationFrame(animate);
    };
    frameRef.current = window.requestAnimationFrame(animate);
    return () => { if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current); };
  }, [playing, reducedMotion, zoomLevel]);

  const ownerCountryCode = ownerGeo?.isOwner ? ownerGeo.countryCode?.toUpperCase() || null : null;
  const countryByCode = useMemo(() => { const map = new Map<string, Country>(); world?.features.forEach((feature) => { const code = iso2(feature.properties); if (code && code !== '-99') map.set(code, feature); }); return map; }, [world]);
  useEffect(() => {
    if (!world || !ownerCountryCode || ownerFocused.current) return;
    const feature = countryByCode.get(ownerCountryCode), longitude = Number(feature?.properties.LABEL_X), latitude = Number(feature?.properties.LABEL_Y);
    ownerFocused.current = true; if (!Number.isFinite(longitude)) return;
    animateCamera({ longitude, latitude:Number.isFinite(latitude) ? latitude : 0, scale:GLOBE_ZOOM_SCALES.world }, 'world', '', () => {
      if (!reducedMotionRef.current || motionOverrideRef.current) setPlaying(true);
    });
  }, [animateCamera, countryByCode, ownerCountryCode, world]);

  const countryShapes = useMemo(() => {
    if (!world) return [];
    return world.features.map((feature, index) => {
      const paths: string[] = [];
      for (const ring of rings(feature.geometry)) {
        let current = '', visibleCount = 0;
        for (const [longitude, latitude] of ring) {
          const point = project(longitude, latitude);
          if (point.visible) { current += `${visibleCount ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`; visibleCount += 1; }
          else if (visibleCount > 2) { paths.push(current); current = ''; visibleCount = 0; }
          else { current = ''; visibleCount = 0; }
        }
        if (visibleCount > 2) paths.push(current);
      }
      return { feature, index, paths };
    }).filter((item) => item.paths.length);
  }, [project, world]);

  const labels = useMemo(() => {
    if (!world) return [];
    return world.features.map((feature) => {
      const properties = feature.properties, longitude = Number(properties.LABEL_X), latitude = Number(properties.LABEL_Y);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
      const point = project(longitude, latitude); if (!point.visible || point.depth < 0.12) return null;
      return { name: localizedCountry(properties, language), code: iso2(properties), rank: Number(properties.LABELRANK || 9), ...point };
    }).filter(Boolean).sort((a, b) => (a!.rank - b!.rank) || (b!.depth - a!.depth)).slice(0, labelBudget(viewportWidth)) as Array<{ name: string; code: string; rank: number; x: number; y: number; depth: number }>;
  }, [language, project, viewportWidth, world]);

  const availableCountries = useMemo(() => {
    const codes = new Set<string>();
    agents.forEach((item) => item.countryCode && codes.add(item.countryCode.toUpperCase()));
    clients.forEach((item) => item.lastCountryCode && codes.add(item.lastCountryCode.toUpperCase()));
    growth.forEach((item) => item.countryCode && codes.add(item.countryCode.toUpperCase()));
    return Array.from(codes).filter((code) => countryByCode.has(code)).sort((a, b) => localizedCountry(countryByCode.get(a)!.properties, language).localeCompare(localizedCountry(countryByCode.get(b)!.properties, language)));
  }, [agents, clients, countryByCode, growth, language]);

  const cameraForTarget = useCallback((target: FocusTarget, level: GlobeZoomLevel) => {
    const exact = { longitude:target.longitude, latitude:target.latitude, scale:GLOBE_ZOOM_SCALES[level] };
    const feature = target.countryCode ? countryByCode.get(target.countryCode.toUpperCase()) : undefined;
    if (level === 'world') return { longitude:cameraRef.current.longitude, latitude:0, scale:GLOBE_ZOOM_SCALES.world };
    if (level === 'continent') return continentCamera(feature?.properties.CONTINENT, exact);
    if (level === 'country') {
      const longitude = Number(feature?.properties.LABEL_X), latitude = Number(feature?.properties.LABEL_Y);
      return {
        longitude:Number.isFinite(longitude) ? longitude : exact.longitude,
        latitude:Number.isFinite(latitude) ? latitude : exact.latitude,
        scale:GLOBE_ZOOM_SCALES.country,
      };
    }
    return exact;
  }, [countryByCode]);

  const labelForTarget = useCallback((target: FocusTarget, level: GlobeZoomLevel) => {
    const feature = target.countryCode ? countryByCode.get(target.countryCode.toUpperCase()) : undefined;
    if (level === 'continent') return String(feature?.properties.CONTINENT || zt.continent);
    if (level === 'country') return feature ? localizedCountry(feature.properties, language) : target.countryCode || zt.country;
    if (level === 'municipality') return target.municipality || target.title;
    return '';
  }, [countryByCode, language, zt.continent, zt.country]);

  const advanceFocus = useCallback((target: FocusTarget, details: NonNullable<Selected>) => {
    const repeated = focusTarget?.key === target.key;
    const nextLevel = repeated ? zoomLevelAt(zoomLevel, 1) : 'continent';
    setFocusTarget(target); setSelected(details);
    animateCamera(cameraForTarget(target, nextLevel), nextLevel, labelForTarget(target, nextLevel));
  }, [animateCamera, cameraForTarget, focusTarget?.key, labelForTarget, zoomLevel]);

  const zoomBy = useCallback((delta: number) => {
    const nextLevel = zoomLevelAt(zoomLevel, delta);
    if (nextLevel === zoomLevel) return;
    if (nextLevel === 'world') {
      animateCamera({ longitude:cameraRef.current.longitude, latitude:0, scale:GLOBE_ZOOM_SCALES.world }, 'world', '');
      return;
    }
    if (focusTarget) {
      animateCamera(cameraForTarget(focusTarget, nextLevel), nextLevel, labelForTarget(focusTarget, nextLevel));
      return;
    }
    animateCamera({ ...cameraRef.current, scale:GLOBE_ZOOM_SCALES[nextLevel] }, nextLevel, zt[nextLevel]);
  }, [animateCamera, cameraForTarget, focusTarget, labelForTarget, zoomLevel, zt]);

  const resetView = useCallback((resumeRotation = false) => {
    setCountry('all'); setSelected(null); setFocusTarget(null);
    animateCamera({ longitude:0, latitude:0, scale:GLOBE_ZOOM_SCALES.world }, 'world', '', () => {
      if (resumeRotation) setPlaying(true);
    });
  }, [animateCamera]);

  const toggleAutoRotation = useCallback(() => {
    if (playing) { setPlaying(false); return; }
    motionOverrideRef.current = true;
    resetView(true);
  }, [playing, resetView]);

  const filteredAgents = useMemo(() => agents.filter((agent) => {
    if (country !== 'all' && agent.countryCode?.toUpperCase() !== country) return false;
    if (status === 'online' && !agent.online) return false;
    if (status === 'available' && !agent.available) return false;
    if (status === 'busy' && agent.availability !== 'BUSY') return false;
    if (status === 'offline' && agent.online) return false;
    return true;
  }), [agents, country, status]);
  const filteredClients = useMemo(() => clients.filter((client) => {
    if (country !== 'all' && client.lastCountryCode?.toUpperCase() !== country) return false;
    if (status === 'online' && !client.online) return false;
    if (status === 'offline' && client.online) return false;
    if (status === 'regular' && !client.regular) return false;
    if (status === 'business' && client.subscriptionPlan !== 'BUSINESS') return false;
    if (status === 'enterprise' && client.subscriptionPlan !== 'ENTERPRISE') return false;
    if (status === 'risk' && !client.failedMediaCount && client.paymentStatus !== 'OVERDUE' && client.subscriptionStatus !== 'SUSPENDED') return false;
    return true;
  }), [clients, country, status]);
  const filteredGrowth = useMemo(() => growth.filter((item) => {
    if (country !== 'all' && item.countryCode?.toUpperCase() !== country) return false;
    const selectedStage = status === 'customer' ? 'client' : status;
    if (['visitor','engaged','lead','prospect','client'].includes(selectedStage) && item.dominantStage !== selectedStage) return false;
    return true;
  }), [country, growth, status]);
  const filteredRelations = useMemo(() => relationRecords.filter((item) => status !== 'risk' || item.slaRisk), [relationRecords, status]);

  const agentLocations = useMemo(() => filteredAgents.flatMap((agent) => {
    const longitude = coordinateValue(agent.longitude, -180, 180), latitude = coordinateValue(agent.latitude, -90, 90);
    if (longitude === null || latitude === null) return [];
    const point = project(longitude, latitude); return point.visible ? [{ item: agent, ...point }] : [];
  }), [filteredAgents, project]);
  const clientLocations = useMemo(() => filteredClients.flatMap((client) => {
    const longitude = coordinateValue(client.lastLongitude, -180, 180), latitude = coordinateValue(client.lastLatitude, -90, 90);
    if (longitude === null || latitude === null) return [];
    const point = project(longitude, latitude); return point.visible ? [{ item: client, ...point }] : [];
  }), [filteredClients, project]);
  const growthLocations = useMemo(() => filteredGrowth.flatMap((item) => {
    const longitude = coordinateValue(item.longitude, -180, 180), latitude = coordinateValue(item.latitude, -90, 90);
    if (longitude === null || latitude === null) return [];
    const point = project(longitude, latitude); return point.visible ? [{ item, ...point }] : [];
  }), [filteredGrowth, project]);
  const clusterCell = zoomLevel === 'municipality' ? 13 : zoomLevel === 'country' ? 19 : zoomLevel === 'continent' ? 25 : viewportWidth < 600 ? 35 : 27;
  const agentClusters = useMemo(() => clusterProjectedPoints(agentLocations, clusterCell), [agentLocations, clusterCell]);
  const clientClusters = useMemo(() => clusterProjectedPoints(clientLocations, clusterCell + 1), [clientLocations, clusterCell]);
  const growthClusters = useMemo(() => clusterProjectedPoints(growthLocations, clusterCell + (zoomLevel === 'world' ? 7 : 2)), [growthLocations, clusterCell, zoomLevel]);

  const relations = useMemo(() => {
    const agentMap = new Map(agentLocations.map((point) => [point.item.id, point]));
    const clientMap = new Map(clientLocations.map((point) => [point.item.id, point]));
    return filteredRelations.flatMap((item) => { const agent = agentMap.get(item.agentId), client = clientMap.get(item.clientId); return agent && client ? [{ item, agent, client }] : []; });
  }, [agentLocations, clientLocations, filteredRelations]);

  const hiddenCount = filteredAgents.filter((item) => coordinateValue(item.latitude, -90, 90) === null || coordinateValue(item.longitude, -180, 180) === null).length
    + filteredClients.filter((item) => coordinateValue(item.lastLatitude, -90, 90) === null || coordinateValue(item.lastLongitude, -180, 180) === null).length;
  const showAgents = mode === 'agents' || mode === 'relations' || mode === 'all';
  const showClients = mode === 'clients' || mode === 'relations' || mode === 'all';
  const showRelations = mode === 'relations' || mode === 'all';
  const showGrowth = mode === 'growth' || mode === 'all';
  const layerCount = mode === 'agents' ? agentLocations.length : mode === 'clients' ? clientLocations.length : mode === 'relations' ? relations.length : mode === 'growth' ? growthLocations.length : agentLocations.length + clientLocations.length + growthLocations.length;
  const modeOptions: Array<[Mode, string]> = [['agents', t.agents], ['clients', t.clients], ['relations', t.relations], ['growth', t.growth], ...(isOwner ? [['all', t.all] as [Mode, string]] : [])];
  const statusOptions: Array<[StatusFilter, string]> = mode === 'relations'
    ? [['all', t.allStatuses], ['risk', t.risk]]
    : mode === 'growth'
      ? [['all', t.allStatuses], ['visitor', t.visitor], ['engaged', t.engaged], ['lead', t.lead], ['prospect', t.prospect], ['customer', t.client]]
      : mode === 'clients'
        ? [['all', t.allStatuses], ['online', t.online], ['offline', t.offline], ['regular', t.regular], ['business', t.business], ['enterprise', t.enterprise], ['risk', t.risk]]
        : [['all', t.allStatuses], ['online', t.online], ['available', t.available], ['busy', t.busy], ['offline', t.offline]];
  const selectCountry = (feature: Country) => {
    const code = iso2(feature.properties); if (!code || code === '-99') return;
    setCountry(code);
    const countryAgents = agents.filter((item) => item.countryCode?.toUpperCase() === code).length;
    const countryClients = clients.filter((item) => item.lastCountryCode?.toUpperCase() === code).length;
    const countryVisitors = growth.filter((item) => item.countryCode?.toUpperCase() === code).reduce((sum, item) => sum + Number(item.visitors || 0), 0);
    const title = localizedCountry(feature.properties, language), longitude = Number(feature.properties.LABEL_X), latitude = Number(feature.properties.LABEL_Y);
    const details = { key:`country:${code}`,title,subtitle:code === ownerCountryCode ? t.ownerCurrent : code,details:[`${countryAgents} ${t.agents}`,`${countryClients} ${t.clients}`,`${countryVisitors} ${t.visitor}`] };
    setSelected(details);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      const target = { key:`country:${code}`,title,longitude,latitude,countryCode:code };
      setFocusTarget(target); animateCamera(cameraForTarget(target, 'country'), 'country', title);
    }
  };

  return <div className="operations-globe" aria-busy={loading}>
    <div className="globe-toolbar" aria-label={t.filters}>
      <div className="modebar">{modeOptions.map(([key, label]) => <button key={key} type="button" className={mode === key ? 'mode active' : 'mode'} aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>)}</div>
      <div className="filters">
        <label><span>{t.status}</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>{statusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>{t.geography}</span><select value={country} onChange={(event) => { const code=event.target.value;if(code==='all')resetView();else{const feature=countryByCode.get(code);if(feature)selectCountry(feature);} }}><option value="all">{t.world}</option>{availableCountries.map((code) => <option key={code} value={code}>{localizedCountry(countryByCode.get(code)!.properties, language)}</option>)}</select></label>
        <label><span>{t.period}</span><select value={windowKey} onChange={(event) => setWindowKey(event.target.value as WindowKey)}><option value="real-time">Temps réel</option><option value="1d">24 h</option><option value="7d">7 j</option><option value="30d">30 j</option></select></label>
      </div>
    </div>
    {showGrowth && overview?.growth ? <div className="kpis" aria-label={t.growth}><span>{overview.growth.summary.visitors} {t.visitor}</span><span>{overview.growth.summary.planSelections} {t.lead}</span><span>{overview.growth.summary.checkouts} {t.prospect}</span><span>{overview.growth.summary.conversions} {t.client}</span><span>{t.conversion} {overview.growth.summary.checkouts ? Math.round(overview.growth.summary.conversions / overview.growth.summary.checkouts * 100) : 0}%</span></div> : null}
    <div className="globe-stage"><div className="globe-halo"/><svg viewBox={`0 0 ${size} ${size}`} width="100%" className="world-globe" role="img" aria-label="KHE Global Intelligence Globe 2.0">
      <defs><radialGradient id="ocean" cx="37%" cy="30%"><stop offset="0" stopColor="#203446"/><stop offset=".55" stopColor="#0f1b26"/><stop offset="1" stopColor="#05090d"/></radialGradient><radialGradient id="shine" cx="28%" cy="20%"><stop offset="0" stopColor="rgba(255,255,255,.24)"/><stop offset=".55" stopColor="rgba(255,255,255,.02)"/><stop offset="1" stopColor="rgba(255,255,255,0)"/></radialGradient><clipPath id="earth-clip"><circle cx={center} cy={center} r={radius}/></clipPath><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <circle cx={center} cy={center} r={radius} fill="url(#ocean)" stroke="rgba(218,177,76,.72)" strokeWidth="2.4"/>
      <g clipPath="url(#earth-clip)"><g className="geo-grid" fill="none" stroke="rgba(143,166,187,.13)" strokeWidth=".8"><ellipse cx={center} cy={center} rx={radius*.72} ry={radius}/><ellipse cx={center} cy={center} rx={radius*.36} ry={radius}/><line x1={center-radius} y1={center} x2={center+radius} y2={center}/><ellipse cx={center} cy={center-radius*.49} rx={radius*.87} ry={radius*.25}/><ellipse cx={center} cy={center+radius*.49} rx={radius*.87} ry={radius*.25}/></g>
        {countryShapes.map(({ feature, index, paths }) => paths.map((path, pathIndex) => { const code = iso2(feature.properties), action = () => selectCountry(feature); return <path key={`${index}-${pathIndex}`} d={path} className={`country ${code === ownerCountryCode ? 'owner-country' : ''} ${code === country ? 'selected-country' : ''}`} role={pathIndex === 0 ? 'button' : undefined} tabIndex={pathIndex === 0 ? 0 : -1} aria-label={pathIndex === 0 ? localizedCountry(feature.properties, language) : undefined} onClick={action} onKeyDown={(event) => activate(event, action)}/>; }))}
        {showRelations ? relations.map(({ item, agent, client }) => { const middleX=(agent.x+client.x)/2,middleY=Math.min(agent.y,client.y)-36,path=`M${agent.x.toFixed(1)},${agent.y.toFixed(1)} Q${middleX.toFixed(1)},${middleY.toFixed(1)} ${client.x.toFixed(1)},${client.y.toFixed(1)}`,title=`${displayName(agent.item)} ↔ ${client.item.name}`,action=()=>advanceFocus({key:`relation:${item.id}`,title,longitude:Number(client.item.lastLongitude),latitude:Number(client.item.lastLatitude),countryCode:client.item.lastCountryCode,municipality:client.item.lastMunicipality},{key:`relation:${item.id}`,title,subtitle:item.slaRisk?t.risk:t.support,details:[item.subject,item.status,item.channel,new Date(item.lastMessageAt).toLocaleString()]}); return <path key={item.id} d={path} className={`relation-line ${item.slaRisk?'risk':''}`} role="button" tabIndex={0} aria-label={`${t.relations}: ${displayName(agent.item)} ${client.item.name}`} onClick={action} onKeyDown={(event)=>activate(event,action)}/>; }) : null}
        {labels.map((label) => <text key={`${label.code}-${label.x}`} x={label.x} y={label.y} textAnchor="middle" className={`country-label rank-${Math.min(8,label.rank)} ${label.code===ownerCountryCode?'owner-label':''}`}>{label.code===ownerCountryCode?'★ ':''}{label.name}</text>)}
        {showGrowth ? growthClusters.map((cluster) => { const representative=cluster.items[0],count=cluster.items.reduce((sum,item)=>sum+item.visitors,0),title=[representative.municipality,representative.regionCode,representative.countryCode].filter(Boolean).join(' · ')||t.growth,key=`growth:${representative.countryCode||'world'}:${representative.municipality||representative.regionCode||cluster.key}`,action=()=>advanceFocus({key,title,longitude:Number(representative.longitude),latitude:Number(representative.latitude),countryCode:representative.countryCode,municipality:representative.municipality},{key,title,subtitle:`${count} ${t.visitor}`,details:Object.entries(representative.stages).map(([stage,value])=>`${t[stage as Stage]}: ${value}`)}); return <g key={cluster.key} transform={`translate(${cluster.x} ${cluster.y})`} role="button" tabIndex={0} aria-label={`${count} ${t.visitor}`} className="clickable" onClick={action} onKeyDown={(event)=>activate(event,action)}><circle r={Math.min(16,6+Math.sqrt(Math.max(1,count))*1.4)} fill={stageColors[representative.dominantStage]} opacity=".82" stroke="#fff1c2" strokeWidth="1.1"/><circle r={Math.min(22,10+Math.sqrt(Math.max(1,count))*1.8)} fill="none" stroke={stageColors[representative.dominantStage]} opacity=".35"/><text textAnchor="middle" y="3" className="cluster-count">{count}</text></g>; }) : null}
        {showClients ? clientClusters.map((cluster) => { const client=cluster.items[0],key=`client:${client.id}`,title=cluster.items.length>1?`${cluster.items.length} ${t.cluster}`:client.name,action=()=>advanceFocus({key,title,longitude:Number(client.lastLongitude),latitude:Number(client.lastLatitude),countryCode:client.lastCountryCode,municipality:client.lastMunicipality},{key,title,subtitle:client.online?t.online:t.offline,details:cluster.items.length>1?cluster.items.slice(0,12).map((item)=>item.name):[[client.lastMunicipality,client.lastRegionCode,client.lastCountryCode].filter(Boolean).join(' · '),`${client.subscriptionPlan||'—'} · ${client.engagementScore??0}/100`,`${client.activeEventCount||0} ${t.activeEvent} · ${client.stationSessionCount||0} ${t.stations}`,`${t.capture}: ${client.captureOnline?t.online:t.offline} · ${t.sharing}: ${client.sharingOnline?t.online:t.offline}`,`${client.mediaCount||0} ${t.media} · ${client.pendingMediaCount||0} ${t.pending} · ${client.failedMediaCount||0} ${t.failed}`].filter((line):line is string=>Boolean(line))}); return <g key={cluster.key} transform={`translate(${cluster.x} ${cluster.y}) rotate(45)`} role="button" tabIndex={0} aria-label={client.name} className="clickable" onClick={action} onKeyDown={(event)=>activate(event,action)}><rect x={cluster.items.length>1?-8:-6} y={cluster.items.length>1?-8:-6} width={cluster.items.length>1?16:12} height={cluster.items.length>1?16:12} rx="2" fill={client.regular?'#c39cff':client.online?'#54d7e7':'#7f8dc0'} stroke="#fff" strokeWidth="1.1"/><circle r={cluster.items.length>1?14:client.online?11:9} fill="none" stroke="rgba(84,215,231,.4)"/>{cluster.items.length>1?<text transform="rotate(-45)" textAnchor="middle" y="3" className="cluster-count">{cluster.items.length}</text>:null}</g>; }) : null}
        {showAgents ? agentClusters.map((cluster) => { const agent=cluster.items[0],key=`agent:${agent.id}`,title=cluster.items.length>1?`${cluster.items.length} ${t.cluster}`:displayName(agent),action=()=>advanceFocus({key,title,longitude:Number(agent.longitude),latitude:Number(agent.latitude),countryCode:agent.countryCode,municipality:agent.municipality},{key,title,subtitle:agent.available?t.available:agent.online?t.online:t.offline,details:cluster.items.length>1?cluster.items.slice(0,12).map(displayName):[[agent.municipality,agent.regionCode,agent.countryCode].filter(Boolean).join(' · '),agent.email].filter((line):line is string=>Boolean(line))}); return <g key={cluster.key} transform={`translate(${cluster.x} ${cluster.y})`} role="button" tabIndex={0} aria-label={displayName(agent)} className="clickable" filter="url(#glow)" onClick={action} onKeyDown={(event)=>activate(event,action)}><circle r={cluster.items.length>1?9:agent.available?7:agent.online?5.5:4.5} fill={agent.available?'#6fe09a':agent.online?'#e0b94d':'#7c8794'} stroke="#fff" strokeWidth="1.2"/>{cluster.items.length>1?<text textAnchor="middle" y="3" className="cluster-count">{cluster.items.length}</text>:agent.available?<circle r="12" fill="none" stroke="rgba(111,224,154,.5)"/>:null}</g>; }) : null}
        <circle cx={center} cy={center} r={radius} fill="url(#shine)" pointerEvents="none"/>
      </g><circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,220,131,.25)" strokeWidth="7" opacity=".22"/>
    </svg>{loading?<div className="globe-message">{t.loading}</div>:null}{worldError?<div className="globe-message fallback">{t.unavailable}</div>:null}{!loading&&layerCount===0?<div className="globe-message">{overview?.growth?.enabled===false&&showGrowth?overview.growth.disabledReason||t.noData:t.noData}</div>:null}</div>
    {error?<p className="globe-error" role="alert">{error}</p>:null}
    {selected?<aside className="globe-detail" aria-live="polite" aria-label={t.details}><div><strong>{selected.title}</strong><div className="detail-subtitle">{selected.subtitle}</div></div><div className="detail-lines">{selected.details.map((line,index)=><span key={`${line}-${index}`}>{line}</span>)}</div><button type="button" onClick={()=>setSelected(null)} aria-label={t.close}>×</button></aside>:null}
    <div className="zoom-bar" aria-label={zt.explore}>
      <div className="zoom-copy"><div className="zoom-path"><strong>{zt.world}</strong>{zoomLevel!=='world'?<><span>›</span><strong>{zt[zoomLevel]}</strong></>:null}{zoomLabel?<><span>›</span><b>{zoomLabel}</b></>:null}</div><small>{zt.explore}</small></div>
      <div className="zoom-actions">
        <button type="button" onClick={()=>zoomBy(-1)} disabled={zoomLevel==='world'} aria-label={zt.zoomOut}>−</button>
        <button type="button" onClick={()=>zoomBy(1)} disabled={zoomLevel==='municipality'} aria-label={zt.zoomIn}>+</button>
        <button type="button" className="wide" onClick={()=>resetView()} disabled={zoomLevel==='world'&&!focusTarget}>{zt.reset}</button>
      </div>
    </div>
    <div className="globe-controls"><label><span>{t.rotate}</span><input aria-label={t.rotate} type="range" min={-180} max={180} value={Math.round(camera.longitude)} onChange={(event)=>{setPlaying(false);const next={...cameraRef.current,longitude:Number(event.target.value)};cameraRef.current=next;setCamera(next);}}/></label><button type="button" className="button secondary" aria-pressed={playing} onClick={toggleAutoRotation}>{playing?`Ⅱ ${t.stop}`:`▶ ${t.auto}`}</button></div>
    {reducedMotion&&!motionOverrideRef.current&&!playing?<p className="motion-note">{zt.reduced}</p>:null}
    <div className="globe-legend"><span><i className="dot owner"/> {t.ownerCurrent}</span><span><i className="dot agent"/> {t.agents}</span><span><i className="diamond"/> {t.clients}</span>{Object.entries(stageColors).map(([stage,color])=><span key={stage}><i className="dot" style={{background:color}}/> {t[stage as Stage]}</span>)}<span><i className="line"/> {t.relations}</span></div>
    <p className="globe-privacy">{t.privacy}{hiddenCount?` · ${hiddenCount} ${t.hidden}`:''}{overview?.generatedAt?` · ${t.refreshed} ${new Date(overview.generatedAt).toLocaleTimeString()}`:''}</p>
    <style jsx>{`
      .operations-globe{position:relative}.globe-toolbar{display:grid;gap:9px}.modebar,.filters{display:flex;gap:6px;overflow-x:auto;padding:2px}.mode{border:1px solid #39434f;background:#10151b;color:#aeb8c5;border-radius:999px;padding:7px 11px;font-size:10px;font-weight:850;white-space:nowrap;cursor:pointer}.mode.active{background:linear-gradient(135deg,#d9af49,#9e7428);border-color:#efcf79;color:#0b0d0f}.filters label{display:grid;gap:3px;min-width:125px}.filters span{font-size:9px;color:#8793a2;font-weight:850}.filters select{border:1px solid #36404b;background:#0e141a;color:#dfe6ed;border-radius:9px;padding:7px;font-size:10px}.kpis{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0 0}.kpis span{padding:5px 8px;border:1px solid rgba(210,173,79,.2);border-radius:999px;color:#c5cfda;font-size:9px}.globe-stage{position:relative;display:grid;place-items:center;isolation:isolate;min-height:300px;overflow:hidden;border-radius:22px}.globe-halo{position:absolute;width:78%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(210,173,79,.14),transparent 68%);filter:blur(20px)}.world-globe{position:relative;z-index:1;max-width:590px;filter:drop-shadow(0 24px 34px rgba(0,0,0,.42))}.country{fill:rgba(70,87,72,.88);stroke:rgba(217,197,140,.28);stroke-width:.55;cursor:pointer;transition:fill .2s ease}.country:hover,.country:focus{fill:rgba(101,113,91,.98);outline:none}.country.owner-country{fill:#b88a2b;stroke:#ffe186;stroke-width:1.2}.country.selected-country{stroke:#fff1b6;stroke-width:1.7}.country-label{fill:rgba(236,239,236,.76);font-size:6.15px;font-weight:720;paint-order:stroke;stroke:rgba(3,7,10,.8);stroke-width:1.75px;pointer-events:none}.owner-label{fill:#ffe69b;font-size:8px;font-weight:950}.relation-line{fill:none;stroke:#e0b94d;stroke-width:1.8;stroke-dasharray:6 4;filter:drop-shadow(0 0 5px rgba(224,185,77,.7));cursor:pointer;animation:relationFlow 1.4s linear infinite}.relation-line.risk{stroke:#e87575}.relation-line:focus{stroke-width:3;outline:none}.clickable{cursor:pointer;outline:none}.clickable:focus>*:first-child{stroke:#fff4b8;stroke-width:3}.cluster-count{fill:#071019;font-size:7px;font-weight:950;pointer-events:none}.globe-message{position:absolute;z-index:4;padding:8px 12px;border:1px solid rgba(210,173,79,.25);border-radius:999px;background:rgba(7,11,15,.82);color:#cbd3dc;font-size:10px}.globe-message.fallback{top:9px}.globe-error{color:#ff9aa4;font-size:11px;text-align:center}.globe-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) auto;gap:12px;max-width:590px;margin:8px auto 0;padding:11px 12px;border:1px solid rgba(210,173,79,.28);border-radius:14px;background:linear-gradient(135deg,rgba(25,27,30,.95),rgba(12,16,21,.96))}.globe-detail strong{color:#fff;font-size:12px}.detail-subtitle{color:#d9b75d;font-size:9px;font-weight:850;margin-top:2px}.detail-lines{display:grid;gap:3px;color:#aeb8c5;font-size:9px}.globe-detail button{border:0;background:transparent;color:#a8b3bf;font-size:20px;cursor:pointer}.zoom-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;max-width:590px;margin:10px auto 0;padding:9px 10px;border:1px solid rgba(210,173,79,.22);border-radius:13px;background:rgba(13,18,24,.72)}.zoom-copy{min-width:0}.zoom-path{display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;color:#8d98a7;font-size:9px}.zoom-path strong{color:#d8b75d;text-transform:uppercase;letter-spacing:.05em}.zoom-path b{overflow:hidden;text-overflow:ellipsis;color:#e7edf4}.zoom-copy small{display:block;margin-top:4px;color:#8f9baa;font-size:8.5px;line-height:1.35}.zoom-actions{display:flex;gap:5px}.zoom-actions button{min-width:31px;min-height:31px;border:1px solid #3b4652;border-radius:9px;background:#111820;color:#eef3f7;font-weight:900;cursor:pointer}.zoom-actions button.wide{padding:0 9px;color:#dcb851;font-size:9px}.zoom-actions button:disabled{opacity:.38;cursor:not-allowed}.globe-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;max-width:590px;margin:9px auto 0}.globe-controls label{display:grid;gap:5px}.globe-controls label span{font-size:11px;font-weight:850;color:#aeb8c5}.globe-controls input{width:100%;accent-color:#d8ae45}.globe-controls .button{min-height:36px;padding:7px 10px;font-size:10px}.motion-note{text-align:center;color:#aab4c0;font-size:8.5px;line-height:1.4;max-width:590px;margin:6px auto 0}.globe-legend{display:flex;justify-content:center;gap:11px;flex-wrap:wrap;margin-top:12px;color:#aeb8c5;font-size:9px}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}.dot.owner{background:#b88a2b;box-shadow:0 0 7px #eac96c}.dot.agent{background:#6fe09a}.diamond{display:inline-block;width:8px;height:8px;transform:rotate(45deg);margin-right:5px;background:#54d7e7}.line{display:inline-block;width:15px;height:2px;margin:0 4px 2px 0;background:#e0b94d}.globe-privacy{text-align:center;color:#8e99a8;font-size:10px;line-height:1.45;margin:8px auto 0;max-width:650px}@keyframes relationFlow{to{stroke-dashoffset:-20}}
      @media(max-width:600px){.globe-stage{min-height:260px}.country-label{font-size:5.7px}.country-label.rank-5,.country-label.rank-6,.country-label.rank-7,.country-label.rank-8{display:none}.filters{display:grid;grid-template-columns:repeat(3,minmax(110px,1fr));overflow-x:auto}.zoom-bar{grid-template-columns:1fr}.zoom-actions{justify-content:flex-start}.globe-controls{grid-template-columns:1fr}.globe-controls .button{justify-self:start}.globe-detail{grid-template-columns:1fr auto}.detail-lines{grid-column:1/-1}.relation-line{stroke-width:2.3}}
      @media(prefers-reduced-motion:reduce){.relation-line{animation:none}.country{transition:none}}
    `}</style>
  </div>;
}
