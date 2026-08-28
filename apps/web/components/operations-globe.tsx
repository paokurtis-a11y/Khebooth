'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { GLOBE_ZOOM_SCALES, clampGlobeScale, clampLatitude, continentCamera, easeCamera, normalizeLongitude, projectGlobePoint, zoomLevelAt, zoomLevelForScale, type GlobeCamera, type GlobeZoomLevel } from './globe-camera';
import { clusterProjectedPoints, labelBudget } from './globe-performance';

type Language = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';
type Mode = 'agents' | 'clients' | 'relations' | 'visitors' | 'growth' | 'all';
type WindowKey = 'real-time' | '1d' | '7d' | '30d';
type StatusFilter = 'all' | 'online' | 'available' | 'busy' | 'offline' | 'risk' | 'regular' | 'business' | 'enterprise' | 'visitor' | 'engaged' | 'lead' | 'prospect' | 'customer';
type Stage = 'visitor' | 'engaged' | 'lead' | 'prospect' | 'client';
type CurrentUser = { role: string };
type AgentPoint = { id: string; email: string; phone?: string | null; firstName?: string | null; lastName?: string | null; role?: string; online: boolean; available: boolean; availability?: string | null; countryCode?: string | null; regionCode?: string | null; municipality?: string | null; latitude?: number | null; longitude?: number | null };
type ClientPoint = { id: string; name: string; email?: string | null; phone?: string | null; companyName?: string | null; notes?: string | null; subscriptionPlan?: string; subscriptionStatus?: string; paymentStatus?: string; lastSeenAt?: string | null; lastCountryCode?: string | null; lastRegionCode?: string | null; lastMunicipality?: string | null; lastLatitude?: number | null; lastLongitude?: number | null; online?: boolean; regular?: boolean; engagementScore?: number; stationSessionCount?: number; eventCount?: number; activeEventCount?: number; captureOnline?: boolean; sharingOnline?: boolean; mediaCount?: number; pendingMediaCount?: number; failedMediaCount?: number };
type Geo = { countryCode?: string | null; regionCode?: string | null; municipality?: string | null; latitude?: number | null; longitude?: number | null; events: number; visitors: number; dominantStage: Stage; stages: Record<Stage, number> };
type LiveVisitorPoint = { id:string; online:true; source:'PROMOTIONAL_SITE'; countryCode?:string|null; regionCode?:string|null; municipality?:string|null; latitude?:number|null; longitude?:number|null; lastSeenAt:string; pagePath?:string|null };
type RelationRecord = { id: string; status: string; subject: string; lastMessageAt: string; startedAt: string; agentId: string; clientId: string; channel: string; priority: string; slaRisk: boolean };
type GlobeOverview = { generatedAt: string; mode: Mode; window: WindowKey; capabilities: { canViewAll: boolean; managedAccount: boolean; accountPlan: string | null; contactScope: string }; clients: ClientPoint[]; relations: RelationRecord[]; liveVisitors: { enabled:boolean; ttlSeconds:number; items:LiveVisitorPoint[] }; growth: { enabled: boolean; disabledReason?: string | null; geographies: Geo[]; summary: { visits: number; visitors: number; planSelections: number; checkouts: number; conversions: number } } };
type OwnerGeo = { isOwner: boolean; countryCode: string | null };
type CountryProps = { ADMIN?: string; CONTINENT?: string; LABELRANK?: number; LABEL_X?: number; LABEL_Y?: number; ISO_A2?: string; ISO_A2_EH?: string; NAME_FR?: string; NAME_EN?: string; NAME_DE?: string; NAME_IT?: string; NAME_ES?: string; NAME_PT?: string };
type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
type Country = { type: 'Feature'; properties: CountryProps; geometry: Geometry };
type WorldData = { type: 'FeatureCollection'; features: Country[] };
type MediaQueryListCompat = MediaQueryList & { addListener?: (listener: (event: MediaQueryListEvent) => void) => void; removeListener?: (listener: (event: MediaQueryListEvent) => void) => void };
type ContactAction = { label: string; value: string; href: string; kind: 'email' | 'phone' };
type ClusterMember = { kind: 'agent'; item: AgentPoint } | { kind: 'client'; item: ClientPoint };
type Selected = { key: string; title: string; subtitle: string; details: string[]; contacts?: ContactAction[]; members?: ClusterMember[] } | null;
type FocusTarget = { key: string; title: string; longitude: number; latitude: number; countryCode?: string | null; municipality?: string | null };
type CameraCopy = { world:string; continent:string; country:string; municipality:string; back:string; reset:string; zoomIn:string; zoomOut:string; explore:string; gesture:string; reduced:string };
type PointerSnapshot = { x: number; y: number; pointerType: string; interactive: boolean };
type GlobeInteraction = { pointers: Map<number, PointerSnapshot>; previousCenter: { x: number; y: number } | null; previousDistance: number; moved: boolean; suppressClick: boolean; lastTouchTapAt: number };
type WeatherCurrent = { time?: string; temperature_2m?: number; apparent_temperature?: number; is_day?: number; precipitation?: number; rain?: number; showers?: number; snowfall?: number; weather_code?: number; cloud_cover?: number; wind_speed_10m?: number; wind_direction_10m?: number; wind_gusts_10m?: number };
type WeatherApiItem = { latitude?: number; longitude?: number; current?: WeatherCurrent };
type WeatherPoint = { code: string; longitude: number; latitude: number; current: WeatherCurrent };
type WeatherCopy = { weather: string; show: string; hide: string; pause: string; animate: string; loading: string; unavailable: string; direct: string; temperature: string; feels: string; precipitation: string; wind: string; updated: string; clear: string; cloudy: string; fog: string; rain: string; snow: string; storm: string; showers: string };
type InsightCopy = { search:string; placeholder:string; noResults:string; agent:string; client:string; place:string; reliability:string; recent:string; estimated:string; aggregated:string; unavailable:string; coverage:string; alerts:string; noAlerts:string; slaRisk:string; noAgentAvailable:string; lowCoverage:string; stale:string };
type LiveVisitorCopy = { mode:string; anonymous:string; promotionalSite:string; activeNow:string; page:string; lastSeen:string; grouped:string; privacy:string };
type SearchResult =
  | { kind:'agent'; key:string; label:string; meta:string; searchable:string; longitude:number; latitude:number; countryCode?:string|null; municipality?:string|null; item:AgentPoint }
  | { kind:'client'; key:string; label:string; meta:string; searchable:string; longitude:number; latitude:number; countryCode?:string|null; municipality?:string|null; item:ClientPoint }
  | { kind:'growth'; key:string; label:string; meta:string; searchable:string; longitude:number; latitude:number; countryCode?:string|null; municipality?:string|null; item:Geo }
  | { kind:'visitor'; key:string; label:string; meta:string; searchable:string; longitude:number; latitude:number; countryCode?:string|null; municipality?:string|null; item:LiveVisitorPoint }
  | { kind:'country'; key:string; label:string; meta:string; searchable:string; longitude:number; latitude:number; countryCode:string; municipality?:null; item:Country };
type OperationalAlert = { key:'sla'|'agents'|'coverage'|'stale'; severity:'critical'|'warning'; label:string };

type Copy = {
  agents: string; clients: string; relations: string; growth: string; all: string; filters: string; status: string; geography: string; period: string;
  allStatuses: string; online: string; available: string; busy: string; offline: string; risk: string; world: string; rotate: string; auto: string; stop: string;
  ownerCurrent: string; privacy: string; loading: string; unavailable: string; noData: string; hidden: string; cluster: string; close: string; details: string;
  visitor: string; engaged: string; lead: string; prospect: string; client: string; events: string; stations: string; engagement: string; actions: string;
  activeEvent: string; capture: string; sharing: string; media: string; pending: string; failed: string; support: string; conversion: string; refreshed: string; regular: string; business: string; enterprise: string;
};

const WORLD_SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const WEATHER_SOURCE = '/api/globe-weather';
const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const WEATHER_BATCH_SIZE = 40;
const copy: Record<Language, Copy> = {
  fr: { agents:'Agents',clients:'Clients',relations:'Relations',growth:'Croissance',all:'Tout',filters:'Filtres',status:'Statut',geography:'Zone',period:'Période',allStatuses:'Tous',online:'En ligne',available:'Disponible',busy:'Occupé',offline:'Hors ligne',risk:'SLA à risque',world:'Monde',rotate:'Rotation du globe',auto:'Rotation automatique',stop:'Arrêter la rotation',ownerCurrent:'OWNER · pays actuel',privacy:'Position estimée de zone, jamais un suivi GPS précis.',loading:'Chargement du Globe KHE…',unavailable:'Carte détaillée indisponible : le globe simplifié reste actif.',noData:'Aucune donnée géographique fiable pour cette couche.',hidden:'élément(s) sans zone restent dans les listes, sans point inventé.',cluster:'éléments dans cette zone',close:'Fermer',details:'Détails',visitor:'Visiteur',engaged:'Engagé',lead:'Lead',prospect:'Prospect',client:'Client',events:'événements',stations:'stations',engagement:'Engagement',actions:'actions',activeEvent:'événement actif',capture:'CAPTURE',sharing:'SHARING',media:'médias',pending:'en attente',failed:'échec',support:'Support actif',conversion:'Conversion',refreshed:'Actualisé',regular:'Régulier',business:'Business',enterprise:'Enterprise' },
  en: { agents:'Agents',clients:'Clients',relations:'Relations',growth:'Growth',all:'All',filters:'Filters',status:'Status',geography:'Area',period:'Period',allStatuses:'All',online:'Online',available:'Available',busy:'Busy',offline:'Offline',risk:'SLA at risk',world:'World',rotate:'Globe rotation',auto:'Auto rotate',stop:'Stop rotation',ownerCurrent:'OWNER · current country',privacy:'Approximate area only, never precise GPS tracking.',loading:'Loading KHE Globe…',unavailable:'Detailed map unavailable: the simplified globe remains active.',noData:'No reliable geographic data for this layer.',hidden:'item(s) without an area remain in lists, with no invented point.',cluster:'items in this area',close:'Close',details:'Details',visitor:'Visitor',engaged:'Engaged',lead:'Lead',prospect:'Prospect',client:'Client',events:'events',stations:'stations',engagement:'Engagement',actions:'actions',activeEvent:'active event',capture:'CAPTURE',sharing:'SHARING',media:'media',pending:'pending',failed:'failed',support:'Active support',conversion:'Conversion',refreshed:'Refreshed',regular:'Regular',business:'Business',enterprise:'Enterprise' },
  de: { agents:'Agenten',clients:'Kunden',relations:'Beziehungen',growth:'Wachstum',all:'Alle',filters:'Filter',status:'Status',geography:'Gebiet',period:'Zeitraum',allStatuses:'Alle',online:'Online',available:'Verfügbar',busy:'Beschäftigt',offline:'Offline',risk:'SLA gefährdet',world:'Welt',rotate:'Globus drehen',auto:'Automatisch drehen',stop:'Rotation stoppen',ownerCurrent:'OWNER · aktuelles Land',privacy:'Nur geschätztes Gebiet, niemals präzises GPS-Tracking.',loading:'KHE-Globus wird geladen…',unavailable:'Detailkarte nicht verfügbar: der vereinfachte Globus bleibt aktiv.',noData:'Keine verlässlichen Geodaten für diese Ebene.',hidden:'Element(e) ohne Gebiet bleiben in Listen, ohne erfundenen Punkt.',cluster:'Elemente in diesem Gebiet',close:'Schließen',details:'Details',visitor:'Besucher',engaged:'Engagiert',lead:'Lead',prospect:'Interessent',client:'Kunde',events:'Events',stations:'Stationen',engagement:'Engagement',actions:'Aktionen',activeEvent:'aktives Event',capture:'CAPTURE',sharing:'SHARING',media:'Medien',pending:'ausstehend',failed:'fehlgeschlagen',support:'Aktiver Support',conversion:'Konversion',refreshed:'Aktualisiert',regular:'Regelmäßig',business:'Business',enterprise:'Enterprise' },
  it: { agents:'Agenti',clients:'Clienti',relations:'Relazioni',growth:'Crescita',all:'Tutto',filters:'Filtri',status:'Stato',geography:'Zona',period:'Periodo',allStatuses:'Tutti',online:'Online',available:'Disponibile',busy:'Occupato',offline:'Offline',risk:'SLA a rischio',world:'Mondo',rotate:'Rotazione del globo',auto:'Rotazione automatica',stop:'Ferma rotazione',ownerCurrent:'OWNER · paese attuale',privacy:'Solo zona approssimativa, mai tracciamento GPS preciso.',loading:'Caricamento Globe KHE…',unavailable:'Mappa dettagliata non disponibile: il globo semplificato resta attivo.',noData:'Nessun dato geografico affidabile per questo livello.',hidden:'elemento/i senza zona restano nelle liste, senza punti inventati.',cluster:'elementi in questa zona',close:'Chiudi',details:'Dettagli',visitor:'Visitatore',engaged:'Coinvolto',lead:'Lead',prospect:'Potenziale',client:'Cliente',events:'eventi',stations:'stazioni',engagement:'Coinvolgimento',actions:'azioni',activeEvent:'evento attivo',capture:'CAPTURE',sharing:'SHARING',media:'media',pending:'in attesa',failed:'errore',support:'Supporto attivo',conversion:'Conversione',refreshed:'Aggiornato',regular:'Regolare',business:'Business',enterprise:'Enterprise' },
  es: { agents:'Agentes',clients:'Clientes',relations:'Relaciones',growth:'Crecimiento',all:'Todo',filters:'Filtros',status:'Estado',geography:'Zona',period:'Periodo',allStatuses:'Todos',online:'En línea',available:'Disponible',busy:'Ocupado',offline:'Sin conexión',risk:'SLA en riesgo',world:'Mundo',rotate:'Rotación del globo',auto:'Rotación automática',stop:'Detener rotación',ownerCurrent:'OWNER · país actual',privacy:'Solo zona aproximada, nunca seguimiento GPS preciso.',loading:'Cargando Globo KHE…',unavailable:'Mapa detallado no disponible: el globo simplificado sigue activo.',noData:'No hay datos geográficos fiables para esta capa.',hidden:'elemento(s) sin zona permanecen en listas, sin puntos inventados.',cluster:'elementos en esta zona',close:'Cerrar',details:'Detalles',visitor:'Visitante',engaged:'Interesado',lead:'Lead',prospect:'Prospecto',client:'Cliente',events:'eventos',stations:'estaciones',engagement:'Participación',actions:'acciones',activeEvent:'evento activo',capture:'CAPTURE',sharing:'SHARING',media:'medios',pending:'pendiente',failed:'fallo',support:'Soporte activo',conversion:'Conversión',refreshed:'Actualizado',regular:'Regular',business:'Business',enterprise:'Enterprise' },
  pt: { agents:'Agentes',clients:'Clientes',relations:'Relações',growth:'Crescimento',all:'Tudo',filters:'Filtros',status:'Estado',geography:'Zona',period:'Período',allStatuses:'Todos',online:'Online',available:'Disponível',busy:'Ocupado',offline:'Offline',risk:'SLA em risco',world:'Mundo',rotate:'Rotação do globo',auto:'Rotação automática',stop:'Parar rotação',ownerCurrent:'OWNER · país atual',privacy:'Apenas zona aproximada, nunca seguimento GPS preciso.',loading:'A carregar Globo KHE…',unavailable:'Mapa detalhado indisponível: o globo simplificado continua ativo.',noData:'Sem dados geográficos fiáveis para esta camada.',hidden:'elemento(s) sem zona permanecem nas listas, sem ponto inventado.',cluster:'elementos nesta zona',close:'Fechar',details:'Detalhes',visitor:'Visitante',engaged:'Envolvido',lead:'Lead',prospect:'Prospect',client:'Cliente',events:'eventos',stations:'estações',engagement:'Envolvimento',actions:'ações',activeEvent:'evento ativo',capture:'CAPTURE',sharing:'SHARING',media:'media',pending:'pendente',failed:'falha',support:'Suporte ativo',conversion:'Conversão',refreshed:'Atualizado',regular:'Regular',business:'Business',enterprise:'Enterprise' },
};

const weatherCopy: Record<Language, WeatherCopy> = {
  fr:{weather:'Météo en direct',show:'Afficher la météo',hide:'Masquer la météo',pause:'Pause météo',animate:'Animer la météo',loading:'Chargement météo…',unavailable:'Météo temporairement indisponible.',direct:'Conditions actuelles',temperature:'Température',feels:'Ressenti',precipitation:'Précipitations',wind:'Vent',updated:'Mise à jour',clear:'Ensoleillé',cloudy:'Nuageux',fog:'Brouillard',rain:'Pluie',snow:'Neige',storm:'Orage',showers:'Averses'},
  en:{weather:'Live weather',show:'Show weather',hide:'Hide weather',pause:'Pause weather',animate:'Animate weather',loading:'Loading weather…',unavailable:'Weather is temporarily unavailable.',direct:'Current conditions',temperature:'Temperature',feels:'Feels like',precipitation:'Precipitation',wind:'Wind',updated:'Updated',clear:'Sunny',cloudy:'Cloudy',fog:'Fog',rain:'Rain',snow:'Snow',storm:'Thunderstorm',showers:'Showers'},
  de:{weather:'Live-Wetter',show:'Wetter anzeigen',hide:'Wetter ausblenden',pause:'Wetter pausieren',animate:'Wetter animieren',loading:'Wetter wird geladen…',unavailable:'Wetter vorübergehend nicht verfügbar.',direct:'Aktuelle Bedingungen',temperature:'Temperatur',feels:'Gefühlt',precipitation:'Niederschlag',wind:'Wind',updated:'Aktualisiert',clear:'Sonnig',cloudy:'Bewölkt',fog:'Nebel',rain:'Regen',snow:'Schnee',storm:'Gewitter',showers:'Schauer'},
  it:{weather:'Meteo in diretta',show:'Mostra meteo',hide:'Nascondi meteo',pause:'Pausa meteo',animate:'Anima meteo',loading:'Caricamento meteo…',unavailable:'Meteo temporaneamente non disponibile.',direct:'Condizioni attuali',temperature:'Temperatura',feels:'Percepita',precipitation:'Precipitazioni',wind:'Vento',updated:'Aggiornato',clear:'Soleggiato',cloudy:'Nuvoloso',fog:'Nebbia',rain:'Pioggia',snow:'Neve',storm:'Temporale',showers:'Rovesci'},
  es:{weather:'Tiempo en directo',show:'Mostrar tiempo',hide:'Ocultar tiempo',pause:'Pausar tiempo',animate:'Animar tiempo',loading:'Cargando tiempo…',unavailable:'Tiempo temporalmente no disponible.',direct:'Condiciones actuales',temperature:'Temperatura',feels:'Sensación',precipitation:'Precipitaciones',wind:'Viento',updated:'Actualizado',clear:'Soleado',cloudy:'Nublado',fog:'Niebla',rain:'Lluvia',snow:'Nieve',storm:'Tormenta',showers:'Chubascos'},
  pt:{weather:'Meteorologia em direto',show:'Mostrar meteorologia',hide:'Ocultar meteorologia',pause:'Pausar meteorologia',animate:'Animar meteorologia',loading:'A carregar meteorologia…',unavailable:'Meteorologia temporariamente indisponível.',direct:'Condições atuais',temperature:'Temperatura',feels:'Sensação',precipitation:'Precipitação',wind:'Vento',updated:'Atualizado',clear:'Ensolarado',cloudy:'Nublado',fog:'Nevoeiro',rain:'Chuva',snow:'Neve',storm:'Trovoada',showers:'Aguaceiros'},
};

const insightCopy: Record<Language, InsightCopy> = {
  fr:{search:'Recherche rapide',placeholder:'Agent, client, commune ou pays…',noResults:'Aucun résultat localisé',agent:'Agent',client:'Client',place:'Zone',reliability:'Fiabilité géographique',recent:'Zone récente',estimated:'Zone estimée',aggregated:'Données agrégées',unavailable:'Zone indisponible',coverage:'couverture',alerts:'Alertes opérationnelles',noAlerts:'Aucune alerte active',slaRisk:'relation(s) à risque SLA',noAgentAvailable:'Aucun agent disponible',lowCoverage:'Couverture géographique faible',stale:'client(s) avec une zone ancienne'},
  en:{search:'Quick search',placeholder:'Agent, client, municipality or country…',noResults:'No located result',agent:'Agent',client:'Client',place:'Area',reliability:'Geographic reliability',recent:'Recent area',estimated:'Estimated area',aggregated:'Aggregated data',unavailable:'Area unavailable',coverage:'coverage',alerts:'Operational alerts',noAlerts:'No active alert',slaRisk:'SLA-risk relation(s)',noAgentAvailable:'No agent available',lowCoverage:'Low geographic coverage',stale:'client(s) with an old area'},
  de:{search:'Schnellsuche',placeholder:'Agent, Kunde, Gemeinde oder Land…',noResults:'Kein lokalisierter Treffer',agent:'Agent',client:'Kunde',place:'Gebiet',reliability:'Geografische Verlässlichkeit',recent:'Aktuelles Gebiet',estimated:'Geschätztes Gebiet',aggregated:'Aggregierte Daten',unavailable:'Gebiet nicht verfügbar',coverage:'Abdeckung',alerts:'Betriebswarnungen',noAlerts:'Keine aktive Warnung',slaRisk:'SLA-gefährdete Beziehung(en)',noAgentAvailable:'Kein Agent verfügbar',lowCoverage:'Geringe geografische Abdeckung',stale:'Kunde(n) mit altem Gebiet'},
  it:{search:'Ricerca rapida',placeholder:'Agente, cliente, comune o paese…',noResults:'Nessun risultato localizzato',agent:'Agente',client:'Cliente',place:'Zona',reliability:'Affidabilità geografica',recent:'Zona recente',estimated:'Zona stimata',aggregated:'Dati aggregati',unavailable:'Zona non disponibile',coverage:'copertura',alerts:'Avvisi operativi',noAlerts:'Nessun avviso attivo',slaRisk:'relazione/i a rischio SLA',noAgentAvailable:'Nessun agente disponibile',lowCoverage:'Copertura geografica bassa',stale:'cliente/i con zona non recente'},
  es:{search:'Búsqueda rápida',placeholder:'Agente, cliente, municipio o país…',noResults:'Ningún resultado localizado',agent:'Agente',client:'Cliente',place:'Zona',reliability:'Fiabilidad geográfica',recent:'Zona reciente',estimated:'Zona estimada',aggregated:'Datos agregados',unavailable:'Zona no disponible',coverage:'cobertura',alerts:'Alertas operativas',noAlerts:'Ninguna alerta activa',slaRisk:'relación(es) con riesgo SLA',noAgentAvailable:'Ningún agente disponible',lowCoverage:'Cobertura geográfica baja',stale:'cliente(s) con zona antigua'},
  pt:{search:'Pesquisa rápida',placeholder:'Agente, cliente, município ou país…',noResults:'Nenhum resultado localizado',agent:'Agente',client:'Cliente',place:'Zona',reliability:'Fiabilidade geográfica',recent:'Zona recente',estimated:'Zona estimada',aggregated:'Dados agregados',unavailable:'Zona indisponível',coverage:'cobertura',alerts:'Alertas operacionais',noAlerts:'Nenhum alerta ativo',slaRisk:'relação(ões) em risco SLA',noAgentAvailable:'Nenhum agente disponível',lowCoverage:'Cobertura geográfica baixa',stale:'cliente(s) com zona antiga'},
};

const liveVisitorCopy: Record<Language, LiveVisitorCopy> = {
  fr:{mode:'Visiteurs en direct',anonymous:'Visiteur anonyme',promotionalSite:'Site promotionnel',activeNow:'en ligne maintenant',page:'Page consultée',lastSeen:'Dernier signal',grouped:'visiteurs dans cette zone',privacy:'Présence consentie, temporaire et pseudonymisée.'},
  en:{mode:'Live visitors',anonymous:'Anonymous visitor',promotionalSite:'Promotional site',activeNow:'online now',page:'Current page',lastSeen:'Last signal',grouped:'visitors in this area',privacy:'Consented, temporary and pseudonymous presence.'},
  de:{mode:'Live-Besucher',anonymous:'Anonymer Besucher',promotionalSite:'Werbeseite',activeNow:'jetzt online',page:'Besuchte Seite',lastSeen:'Letztes Signal',grouped:'Besucher in diesem Gebiet',privacy:'Einwilligte, temporäre und pseudonyme Präsenz.'},
  it:{mode:'Visitatori in diretta',anonymous:'Visitatore anonimo',promotionalSite:'Sito promozionale',activeNow:'online ora',page:'Pagina visitata',lastSeen:'Ultimo segnale',grouped:'visitatori in questa zona',privacy:'Presenza consentita, temporanea e pseudonima.'},
  es:{mode:'Visitantes en directo',anonymous:'Visitante anónimo',promotionalSite:'Sitio promocional',activeNow:'en línea ahora',page:'Página visitada',lastSeen:'Última señal',grouped:'visitantes en esta zona',privacy:'Presencia consentida, temporal y seudónima.'},
  pt:{mode:'Visitantes em direto',anonymous:'Visitante anónimo',promotionalSite:'Site promocional',activeNow:'online agora',page:'Página visitada',lastSeen:'Último sinal',grouped:'visitantes nesta zona',privacy:'Presença consentida, temporária e pseudónima.'},
};

const stageColors: Record<Stage, string> = { visitor:'#718096',engaged:'#5aa6c9',lead:'#d8ae45',prospect:'#ef943f',client:'#7bd89b' };
const cameraCopy: Record<Language, CameraCopy> = {
  fr:{world:'Monde',continent:'Continent',country:'Pays',municipality:'Commune',back:'Retour',reset:'Vue mondiale',zoomIn:'Zoom avant',zoomOut:'Zoom arrière',explore:'Touchez un point pour sa fiche, puis retouchez-le : continent → pays → commune.',gesture:'Glissez dans toutes les directions · pincez ou double-touchez pour zoomer.',reduced:'Rotation arrêtée par le réglage Réduire les animations. Vous pouvez la lancer manuellement.'},
  en:{world:'World',continent:'Continent',country:'Country',municipality:'Municipality',back:'Back',reset:'World view',zoomIn:'Zoom in',zoomOut:'Zoom out',explore:'Tap a point for its card, then tap again: continent → country → municipality.',gesture:'Drag in every direction · pinch or double-tap to zoom.',reduced:'Rotation is paused by Reduce Motion. You can start it manually.'},
  de:{world:'Welt',continent:'Kontinent',country:'Land',municipality:'Gemeinde',back:'Zurück',reset:'Weltansicht',zoomIn:'Vergrößern',zoomOut:'Verkleinern',explore:'Punkt für die Karte antippen, dann erneut: Kontinent → Land → Gemeinde.',gesture:'In alle Richtungen ziehen · zum Zoomen aufziehen oder doppeltippen.',reduced:'Die Rotation ist durch Bewegung reduzieren pausiert. Sie kann manuell gestartet werden.'},
  it:{world:'Mondo',continent:'Continente',country:'Paese',municipality:'Comune',back:'Indietro',reset:'Vista mondo',zoomIn:'Ingrandisci',zoomOut:'Riduci',explore:'Tocca un punto per la scheda, poi ancora: continente → paese → comune.',gesture:'Trascina in ogni direzione · pizzica o tocca due volte per zoomare.',reduced:'La rotazione è sospesa da Riduci movimento. Puoi avviarla manualmente.'},
  es:{world:'Mundo',continent:'Continente',country:'País',municipality:'Municipio',back:'Atrás',reset:'Vista mundial',zoomIn:'Acercar',zoomOut:'Alejar',explore:'Toca un punto para su ficha y vuelve a tocar: continente → país → municipio.',gesture:'Arrastra en todas direcciones · pellizca o toca dos veces para acercar.',reduced:'La rotación está pausada por Reducir movimiento. Puedes iniciarla manualmente.'},
  pt:{world:'Mundo',continent:'Continente',country:'País',municipality:'Município',back:'Voltar',reset:'Vista mundial',zoomIn:'Aumentar',zoomOut:'Diminuir',explore:'Toque num ponto para a ficha e toque novamente: continente → país → município.',gesture:'Arraste em todas as direções · belisque ou toque duas vezes para ampliar.',reduced:'A rotação está pausada por Reduzir movimento. Pode iniciá-la manualmente.'},
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
  const rawLiveVisitors = raw.liveVisitors && typeof raw.liveVisitors === 'object' ? raw.liveVisitors : null;
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
    capabilities: raw.capabilities && typeof raw.capabilities === 'object'
      ? { canViewAll:Boolean(raw.capabilities.canViewAll), managedAccount:Boolean(raw.capabilities.managedAccount), accountPlan:typeof raw.capabilities.accountPlan === 'string' ? raw.capabilities.accountPlan : null, contactScope:typeof raw.capabilities.contactScope === 'string' ? raw.capabilities.contactScope : 'ORGANIZATION' }
      : { canViewAll:false, managedAccount:false, accountPlan:null, contactScope:'ORGANIZATION' },
    clients: Array.isArray(raw.clients) ? raw.clients : [], relations: Array.isArray(raw.relations) ? raw.relations : [],
    liveVisitors: {
      enabled:rawLiveVisitors?.enabled !== false,
      ttlSeconds:Math.max(30,Number(rawLiveVisitors?.ttlSeconds ?? 75)),
      items:Array.isArray(rawLiveVisitors?.items) ? rawLiveVisitors.items : [],
    },
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
function pointerCenter(pointers: Map<number, PointerSnapshot>) {
  const values = Array.from(pointers.values());
  if (!values.length) return null;
  return values.reduce((sum, point) => ({ x:sum.x + point.x / values.length, y:sum.y + point.y / values.length }), { x:0, y:0 });
}
function pointerDistance(pointers: Map<number, PointerSnapshot>) {
  const [first, second] = Array.from(pointers.values());
  return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
}
function contactActions(email?: string | null, phone?: string | null, prefix = ''): ContactAction[] {
  const actions: ContactAction[] = [];
  const cleanEmail = String(email ?? '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) actions.push({ label:`${prefix}${prefix ? ' · ' : ''}E-mail`, value:cleanEmail, href:`mailto:${cleanEmail}`, kind:'email' });
  const cleanPhone = String(phone ?? '').trim();
  const callablePhone = cleanPhone.startsWith('+') ? `+${cleanPhone.slice(1).replace(/\D/g, '')}` : cleanPhone.replace(/\D/g, '');
  if (callablePhone.length >= 5) actions.push({ label:`${prefix}${prefix ? ' · ' : ''}Téléphone`, value:cleanPhone, href:`tel:${callablePhone}`, kind:'phone' });
  return actions;
}
function weatherVisual(current: WeatherCurrent, text: WeatherCopy) {
  const code = Number(current.weather_code ?? -1);
  if (code >= 95) return { kind:'storm', icon:'⛈', label:text.storm };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86 || Number(current.snowfall) > 0) return { kind:'snow', icon:'❄', label:text.snow };
  if (code >= 80 && code <= 82) return { kind:'showers', icon:'🌦', label:text.showers };
  if ((code >= 51 && code <= 67) || Number(current.rain) > 0 || Number(current.precipitation) > 0) return { kind:'rain', icon:'🌧', label:text.rain };
  if (code === 45 || code === 48) return { kind:'fog', icon:'≋', label:text.fog };
  if (code >= 1 && code <= 3) return { kind:'cloudy', icon:code === 1 ? '🌤' : '☁', label:text.cloudy };
  return { kind:'clear', icon:current.is_day === 0 ? '☾' : '☀', label:text.clear };
}
function chunksOf<T>(items: T[], size: number) { const chunks: T[][] = []; for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size)); return chunks; }
function hasCoordinatePair(longitude?: number | null, latitude?: number | null) { return coordinateValue(longitude, -180, 180) !== null && coordinateValue(latitude, -90, 90) !== null; }
function isRecentTimestamp(value?: string | null, days = 1) { if (!value) return false; const time = new Date(value).getTime(); return Number.isFinite(time) && Date.now() - time <= days * 86_400_000; }
function normalizeSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim(); }

export function OperationsGlobe({ agents, expanded = false }: { agents: AgentPoint[]; expanded?: boolean }) {
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
  const [interacting, setInteracting] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherPlaying, setWeatherPlaying] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherPoints, setWeatherPoints] = useState<Record<string, WeatherPoint>>({});
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const ownerFocused = useRef(false);
  const frameRef = useRef<number | null>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const cameraRef = useRef(camera);
  const motionOverrideRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const lastFrameRef = useRef(0);
  const interactionRef = useRef<GlobeInteraction>({ pointers:new Map(), previousCenter:null, previousDistance:0, moved:false, suppressClick:false, lastTouchTapAt:0 });
  const t = copy[language];
  const zt = cameraCopy[language];
  const wt = weatherCopy[language];
  const insights = insightCopy[language];
  const vt = liveVisitorCopy[language];
  const size = 520, center = size / 2, radius = 218;
  const clients = Array.isArray(overview?.clients) ? overview.clients : [];
  const growth = Array.isArray(overview?.growth?.geographies) ? overview.growth.geographies : [];
  const relationRecords = Array.isArray(overview?.relations) ? overview.relations : [];
  const liveVisitors = Array.isArray(overview?.liveVisitors?.items) ? overview.liveVisitors.items : [];
  const isOwner = role === 'OWNER';
  const isManagedAccount = overview?.capabilities.managedAccount === true;

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
    if (!weatherEnabled || !world) return;
    const controller = new AbortController();
    const locations = world.features.map((feature) => ({
      code:iso2(feature.properties), longitude:Number(feature.properties.LABEL_X), latitude:Number(feature.properties.LABEL_Y),
    })).filter((item) => item.code && item.code !== '-99' && Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
    const loadWeather = async () => {
      setWeatherLoading(true);
      try {
        const batches = chunksOf(locations, WEATHER_BATCH_SIZE);
        const results = await Promise.allSettled(batches.map(async (batch) => {
          const parameters = new URLSearchParams({
            latitude:batch.map((item) => item.latitude.toFixed(3)).join(','),
            longitude:batch.map((item) => item.longitude.toFixed(3)).join(','),
            current:'temperature_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
            timezone:'auto',
          });
          const response = await fetch(`${WEATHER_SOURCE}?${parameters}`, { cache:'no-store', signal:controller.signal });
          if (!response.ok) throw new Error('weather');
          const payload = await response.json() as WeatherApiItem | WeatherApiItem[];
          const values = Array.isArray(payload) ? payload : [payload];
          return batch.map((location, index) => ({ ...location, current:values[index]?.current ?? {} }));
        }));
        if (controller.signal.aborted) return;
        const points: Record<string, WeatherPoint> = {};
        results.forEach((result) => { if (result.status === 'fulfilled') result.value.forEach((point) => { points[point.code] = point; }); });
        if (!Object.keys(points).length) throw new Error('weather');
        setWeatherPoints(points); setWeatherUpdatedAt(new Date().toISOString()); setWeatherError('');
      } catch (weatherLoadError) {
        if (!controller.signal.aborted) setWeatherError(wt.unavailable);
      } finally { if (!controller.signal.aborted) setWeatherLoading(false); }
    };
    void loadWeather();
    const timer = window.setInterval(() => void loadWeather(), WEATHER_REFRESH_MS);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [weatherEnabled, world, wt.unavailable]);

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
  useEffect(() => { if (isManagedAccount && (mode === 'visitors' || mode === 'growth' || mode === 'all')) setMode('agents'); }, [isManagedAccount, mode]);
  useEffect(() => { if (mode === 'visitors' && windowKey !== 'real-time') setWindowKey('real-time'); }, [mode, windowKey]);
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

  const weatherMarkers = useMemo(() => {
    if (!weatherEnabled) return [];
    return labels.map((label) => {
      const weather = weatherPoints[label.code];
      return weather ? { ...label, weather, visual:weatherVisual(weather.current, wt) } : null;
    }).filter(Boolean) as Array<{ name: string; code: string; x: number; y: number; depth: number; weather: WeatherPoint; visual: ReturnType<typeof weatherVisual> }>;
  }, [labels, weatherEnabled, weatherPoints, wt]);

  const availableCountries = useMemo(() => {
    const codes = new Set<string>();
    agents.forEach((item) => item.countryCode && codes.add(item.countryCode.toUpperCase()));
    clients.forEach((item) => item.lastCountryCode && codes.add(item.lastCountryCode.toUpperCase()));
    growth.forEach((item) => item.countryCode && codes.add(item.countryCode.toUpperCase()));
    liveVisitors.forEach((item) => item.countryCode && codes.add(item.countryCode.toUpperCase()));
    return Array.from(codes).filter((code) => countryByCode.has(code)).sort((a, b) => localizedCountry(countryByCode.get(a)!.properties, language).localeCompare(localizedCountry(countryByCode.get(b)!.properties, language)));
  }, [agents, clients, countryByCode, growth, language, liveVisitors]);

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

  const setManualCamera = useCallback((nextCamera: GlobeCamera) => {
    if (cameraFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    }
    setPlaying(false);
    const next = { ...nextCamera, longitude:normalizeLongitude(nextCamera.longitude), latitude:clampLatitude(nextCamera.latitude), scale:clampGlobeScale(nextCamera.scale) };
    const nextLevel = zoomLevelForScale(next.scale);
    cameraRef.current = next; setCamera(next); setZoomLevel(nextLevel);
    if (nextLevel === 'world' && !focusTarget) setZoomLabel('');
  }, [focusTarget]);

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current;
    if (interaction.pointers.size === 0) interaction.moved = false;
    const interactive = event.target instanceof Element && Boolean(event.target.closest('[role="button"]'));
    interaction.pointers.set(event.pointerId, { x:event.clientX, y:event.clientY, pointerType:event.pointerType, interactive });
    interaction.previousCenter = pointerCenter(interaction.pointers);
    interaction.previousDistance = pointerDistance(interaction.pointers);
    setPlaying(false); setInteracting(true);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current;
    if (!interaction.pointers.has(event.pointerId)) return;
    const previousCenter = interaction.previousCenter;
    const previousDistance = interaction.previousDistance;
    const pointer = interaction.pointers.get(event.pointerId)!;
    interaction.pointers.set(event.pointerId, { ...pointer, x:event.clientX, y:event.clientY });
    const centerPoint = pointerCenter(interaction.pointers);
    if (!previousCenter || !centerPoint) return;
    const deltaX = centerPoint.x - previousCenter.x, deltaY = centerPoint.y - previousCenter.y;
    const distance = pointerDistance(interaction.pointers);
    const current = cameraRef.current;
    if (interaction.pointers.size >= 2 && previousDistance > 0 && distance > 0) {
      if (Math.abs(distance - previousDistance) > 1 || Math.abs(deltaX) + Math.abs(deltaY) > 2) interaction.moved = true;
      setManualCamera({
        longitude:current.longitude - deltaX * .34 / current.scale,
        latitude:current.latitude + deltaY * .28 / current.scale,
        scale:current.scale * distance / previousDistance,
      });
      interaction.previousDistance = distance;
    } else if (Math.abs(deltaX) + Math.abs(deltaY) > 1) {
      interaction.moved = true;
      setManualCamera({
        ...current,
        longitude:current.longitude - deltaX * .42 / current.scale,
        latitude:current.latitude + deltaY * .34 / current.scale,
      });
    }
    if (interaction.moved) {
      try { if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional on older mobile browsers. */ }
    }
    interaction.previousCenter = centerPoint;
  }, [setManualCamera]);

  const handlePointerEnd = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current;
    const pointer = interaction.pointers.get(event.pointerId);
    const moved = interaction.moved;
    interaction.pointers.delete(event.pointerId);
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Older mobile browsers may release it themselves. */ }
    if (!moved && pointer?.pointerType === 'touch' && !pointer.interactive && interaction.pointers.size === 0) {
      const now = window.performance.now();
      if (now - interaction.lastTouchTapAt < 340) { interaction.lastTouchTapAt = 0; zoomBy(1); }
      else interaction.lastTouchTapAt = now;
    }
    if (moved) {
      interaction.suppressClick = true;
      window.setTimeout(() => { interaction.suppressClick = false; }, 0);
    }
    interaction.previousCenter = pointerCenter(interaction.pointers);
    interaction.previousDistance = pointerDistance(interaction.pointers);
    if (interaction.pointers.size === 0) { interaction.moved = false; setInteracting(false); }
  }, [zoomBy]);

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * .0015);
    setManualCamera({ ...cameraRef.current, scale:cameraRef.current.scale * factor });
  }, [setManualCamera]);

  const handleDoubleClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (event.target instanceof Element && event.target.closest('[role="button"]')) return;
    event.preventDefault(); zoomBy(1);
  }, [zoomBy]);

  const suppressGestureClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactionRef.current.suppressClick) return;
    event.preventDefault(); event.stopPropagation();
  }, []);

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
  const filteredVisitors = useMemo(() => liveVisitors.filter((item) => country === 'all' || item.countryCode?.toUpperCase() === country), [country, liveVisitors]);

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
  const visitorLocations = useMemo(() => filteredVisitors.flatMap((item) => {
    const longitude = coordinateValue(item.longitude, -180, 180), latitude = coordinateValue(item.latitude, -90, 90);
    if (longitude === null || latitude === null) return [];
    const point = project(longitude, latitude); return point.visible ? [{ item, ...point }] : [];
  }), [filteredVisitors, project]);
  const growthLocations = useMemo(() => filteredGrowth.flatMap((item) => {
    const longitude = coordinateValue(item.longitude, -180, 180), latitude = coordinateValue(item.latitude, -90, 90);
    if (longitude === null || latitude === null) return [];
    const point = project(longitude, latitude); return point.visible ? [{ item, ...point }] : [];
  }), [filteredGrowth, project]);
  const clusterCell = zoomLevel === 'municipality' ? 13 : zoomLevel === 'country' ? 19 : zoomLevel === 'continent' ? 25 : viewportWidth < 600 ? 35 : 27;
  const agentClusters = useMemo(() => clusterProjectedPoints(agentLocations, clusterCell), [agentLocations, clusterCell]);
  const clientClusters = useMemo(() => clusterProjectedPoints(clientLocations, clusterCell + 1), [clientLocations, clusterCell]);
  const visitorClusters = useMemo(() => clusterProjectedPoints(visitorLocations, clusterCell + 2), [visitorLocations, clusterCell]);
  const growthClusters = useMemo(() => clusterProjectedPoints(growthLocations, clusterCell + (zoomLevel === 'world' ? 7 : 2)), [growthLocations, clusterCell, zoomLevel]);

  const relations = useMemo(() => {
    const agentMap = new Map(agentLocations.map((point) => [point.item.id, point]));
    const clientMap = new Map(clientLocations.map((point) => [point.item.id, point]));
    return filteredRelations.flatMap((item) => { const agent = agentMap.get(item.agentId), client = clientMap.get(item.clientId); return agent && client ? [{ item, agent, client }] : []; });
  }, [agentLocations, clientLocations, filteredRelations]);

  const hiddenCount = filteredAgents.filter((item) => !hasCoordinatePair(item.longitude, item.latitude)).length
    + filteredClients.filter((item) => !hasCoordinatePair(item.lastLongitude, item.lastLatitude)).length
    + filteredVisitors.filter((item) => !hasCoordinatePair(item.longitude, item.latitude)).length;
  const showAgents = mode === 'agents' || mode === 'relations' || mode === 'all';
  const showClients = mode === 'clients' || mode === 'relations' || mode === 'all';
  const showRelations = mode === 'relations' || mode === 'all';
  const showVisitors = mode === 'visitors' || mode === 'all';
  const showGrowth = mode === 'growth' || mode === 'all';
  const layerCount = mode === 'agents' ? agentLocations.length : mode === 'clients' ? clientLocations.length : mode === 'relations' ? relations.length : mode === 'visitors' ? visitorLocations.length : mode === 'growth' ? growthLocations.length : agentLocations.length + clientLocations.length + visitorLocations.length + growthLocations.length;

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = normalizeSearch(searchTerm);
    if (query.length < 2) return [];
    const candidates: SearchResult[] = [];
    agents.forEach((item) => {
      const longitude=coordinateValue(item.longitude,-180,180),latitude=coordinateValue(item.latitude,-90,90);
      if (longitude===null||latitude===null) return;
      const label=displayName(item),area=[item.municipality,item.regionCode,item.countryCode].filter(Boolean).join(' · ');
      candidates.push({kind:'agent',key:`search:agent:${item.id}`,label,meta:`${insights.agent}${area?` · ${area}`:''}`,searchable:normalizeSearch([label,item.email,item.phone,area].filter(Boolean).join(' ')),longitude,latitude,countryCode:item.countryCode,municipality:item.municipality,item});
    });
    clients.forEach((item) => {
      const longitude=coordinateValue(item.lastLongitude,-180,180),latitude=coordinateValue(item.lastLatitude,-90,90);
      if (longitude===null||latitude===null) return;
      const area=[item.lastMunicipality,item.lastRegionCode,item.lastCountryCode].filter(Boolean).join(' · ');
      candidates.push({kind:'client',key:`search:client:${item.id}`,label:item.name,meta:`${insights.client}${area?` · ${area}`:''}`,searchable:normalizeSearch([item.name,item.companyName,item.email,item.phone,area].filter(Boolean).join(' ')),longitude,latitude,countryCode:item.lastCountryCode,municipality:item.lastMunicipality,item});
    });
    liveVisitors.forEach((item) => {
      const longitude=coordinateValue(item.longitude,-180,180),latitude=coordinateValue(item.latitude,-90,90);
      if(longitude===null||latitude===null)return;
      const area=[item.municipality,item.regionCode,item.countryCode].filter(Boolean).join(' · ');
      candidates.push({kind:'visitor',key:`search:visitor:${item.id}`,label:vt.anonymous,meta:`${vt.promotionalSite}${area?` · ${area}`:''}`,searchable:normalizeSearch([vt.anonymous,vt.promotionalSite,area,item.pagePath].filter(Boolean).join(' ')),longitude,latitude,countryCode:item.countryCode,municipality:item.municipality,item});
    });
    growth.forEach((item,index) => {
      const longitude=coordinateValue(item.longitude,-180,180),latitude=coordinateValue(item.latitude,-90,90);
      if (longitude===null||latitude===null) return;
      const label=[item.municipality,item.regionCode,item.countryCode].filter(Boolean).join(' · ')||insights.place;
      candidates.push({kind:'growth',key:`search:growth:${item.countryCode||'world'}:${item.municipality||item.regionCode||index}`,label,meta:`${insights.place} · ${item.events} ${t.events}`,searchable:normalizeSearch(`${label} ${item.events} ${t.events}`),longitude,latitude,countryCode:item.countryCode,municipality:item.municipality,item});
    });
    world?.features.forEach((item,index) => {
      const longitude=coordinateValue(Number(item.properties.LABEL_X),-180,180),latitude=coordinateValue(Number(item.properties.LABEL_Y),-90,90),countryCode=iso2(item.properties);
      if (longitude===null||latitude===null||!countryCode||countryCode==='-99') return;
      const label=localizedCountry(item.properties,language);
      candidates.push({kind:'country',key:`search:country:${countryCode}:${index}`,label,meta:`${insights.place} · ${countryCode}`,searchable:normalizeSearch(`${label} ${countryCode}`),longitude,latitude,countryCode,municipality:null,item});
    });
    return candidates.filter((item)=>item.searchable.includes(query)).sort((a,b)=>a.label.localeCompare(b.label,language)).slice(0,8);
  }, [agents,clients,growth,insights.agent,insights.client,insights.place,language,liveVisitors,searchTerm,t.events,vt.anonymous,vt.promotionalSite,world]);

  const agentLocatedCount=filteredAgents.filter((item)=>hasCoordinatePair(item.longitude,item.latitude)).length;
  const clientLocatedCount=filteredClients.filter((item)=>hasCoordinatePair(item.lastLongitude,item.lastLatitude)).length;
  const visitorLocatedCount=filteredVisitors.filter((item)=>hasCoordinatePair(item.longitude,item.latitude)).length;
  const growthLocatedCount=filteredGrowth.filter((item)=>hasCoordinatePair(item.longitude,item.latitude)).length;
  const agentById=new Map(agents.map((item)=>[item.id,item]));
  const clientById=new Map(clients.map((item)=>[item.id,item]));
  const relationLocatedCount=filteredRelations.filter((item)=>{
    const agent=agentById.get(item.agentId),client=clientById.get(item.clientId);
    return Boolean(agent&&client&&hasCoordinatePair(agent.longitude,agent.latitude)&&hasCoordinatePair(client.lastLongitude,client.lastLatitude));
  }).length;
  const reliabilityTotal=mode==='agents'?filteredAgents.length:mode==='clients'?filteredClients.length:mode==='relations'?filteredRelations.length:mode==='visitors'?filteredVisitors.length:mode==='growth'?filteredGrowth.length:filteredAgents.length+filteredClients.length+filteredVisitors.length+filteredGrowth.length;
  const reliabilityLocated=mode==='agents'?agentLocatedCount:mode==='clients'?clientLocatedCount:mode==='relations'?relationLocatedCount:mode==='visitors'?visitorLocatedCount:mode==='growth'?growthLocatedCount:agentLocatedCount+clientLocatedCount+visitorLocatedCount+growthLocatedCount;
  const recentAgentCount=filteredAgents.filter((item)=>item.online&&hasCoordinatePair(item.longitude,item.latitude)).length;
  const recentClientCount=filteredClients.filter((item)=>isRecentTimestamp(item.lastSeenAt)&&hasCoordinatePair(item.lastLongitude,item.lastLatitude)).length;
  const recentRelationCount=filteredRelations.filter((item)=>{
    const agent=agentById.get(item.agentId),client=clientById.get(item.clientId);
    return Boolean(agent?.online&&client&&isRecentTimestamp(client.lastSeenAt)&&hasCoordinatePair(agent.longitude,agent.latitude)&&hasCoordinatePair(client.lastLongitude,client.lastLatitude));
  }).length;
  const reliabilityRecent=mode==='agents'?recentAgentCount:mode==='clients'?recentClientCount:mode==='relations'?recentRelationCount:mode==='visitors'?visitorLocatedCount:mode==='growth'?0:recentAgentCount+recentClientCount+visitorLocatedCount;
  const reliabilityAggregated=mode==='growth'?growthLocatedCount:mode==='all'?growthLocatedCount:0;
  const reliabilityEstimated=Math.max(0,reliabilityLocated-reliabilityRecent-reliabilityAggregated);
  const reliabilityUnavailable=Math.max(0,reliabilityTotal-reliabilityLocated);
  const coveragePercent=reliabilityTotal?Math.round(reliabilityLocated/reliabilityTotal*100):0;
  const staleClientCount=clients.filter((item)=>hasCoordinatePair(item.lastLongitude,item.lastLatitude)&&!isRecentTimestamp(item.lastSeenAt,7)).length;
  const slaRiskCount=relationRecords.filter((item)=>item.slaRisk).length;
  const availableAgentCount=agents.filter((item)=>item.available).length;
  const operationalAlerts: OperationalAlert[]=[
    ...(slaRiskCount?[{key:'sla' as const,severity:'critical' as const,label:`${slaRiskCount} ${insights.slaRisk}`}]:[]),
    ...(agents.length&&availableAgentCount===0?[{key:'agents' as const,severity:'warning' as const,label:insights.noAgentAvailable}]:[]),
    ...(reliabilityTotal>0&&coveragePercent<70?[{key:'coverage' as const,severity:'warning' as const,label:`${insights.lowCoverage} (${coveragePercent} %)`}]:[]),
    ...(staleClientCount?[{key:'stale' as const,severity:'warning' as const,label:`${staleClientCount} ${insights.stale}`}]:[]),
  ];
  const modeOptions: Array<[Mode, string]> = [
    ['agents', t.agents], ['clients', t.clients], ['relations', t.relations],
    ...(!isManagedAccount ? [['visitors', vt.mode] as [Mode, string], ['growth', t.growth] as [Mode, string]] : []),
    ...(isOwner && !isManagedAccount ? [['all', t.all] as [Mode, string]] : []),
  ];
  const statusOptions: Array<[StatusFilter, string]> = mode === 'relations'
    ? [['all', t.allStatuses], ['risk', t.risk]]
    : mode === 'visitors'
      ? [['all', t.allStatuses]]
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
    const countryLiveVisitors = liveVisitors.filter((item) => item.countryCode?.toUpperCase() === code).length;
    const title = localizedCountry(feature.properties, language), longitude = Number(feature.properties.LABEL_X), latitude = Number(feature.properties.LABEL_Y);
    const details = { key:`country:${code}`,title,subtitle:code === ownerCountryCode ? t.ownerCurrent : code,details:[`${insights.reliability}: ${insights.aggregated}`,`${countryAgents} ${t.agents}`,`${countryClients} ${t.clients}`,`${countryLiveVisitors} ${vt.activeNow}`,`${countryVisitors} ${t.visitor}`] };
    setSelected(details);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      const target = { key:`country:${code}`,title,longitude,latitude,countryCode:code };
      setFocusTarget(target); animateCamera(cameraForTarget(target, 'country'), 'country', title);
    }
  };
  const selectAgent = (agent: AgentPoint, clusterItems: AgentPoint[]) => {
    const clusterSize = clusterItems.length || 1;
    const key = `agent:${agent.id}`, title = clusterSize > 1 ? `${clusterSize} ${t.cluster}` : displayName(agent);
    const details: NonNullable<Selected> = {
      key, title, subtitle:agent.available ? t.available : agent.online ? t.online : t.offline,
      details:clusterSize > 1 ? [
        ...clusterItems.slice(0, 50).map(displayName),
        ...(clusterSize > 50 ? [`+${clusterSize - 50}`] : []),
      ] : [
        `${insights.reliability}: ${agent.online ? insights.recent : insights.estimated}`,
        [agent.municipality,agent.regionCode,agent.countryCode].filter(Boolean).join(' · '),
        agent.role ? `Rôle : ${agent.role}` : '',
        agent.availability ? `${t.available} : ${agent.availability}` : '',
      ].filter(Boolean),
      contacts:clusterSize > 1 ? [] : contactActions(agent.email, agent.phone),
      members:clusterSize > 1 ? clusterItems.slice(0, 50).map((item) => ({ kind:'agent' as const, item })) : undefined,
    };
    advanceFocus({ key,title,longitude:Number(agent.longitude),latitude:Number(agent.latitude),countryCode:agent.countryCode,municipality:agent.municipality }, details);
  };
  const selectClient = (client: ClientPoint, clusterItems: ClientPoint[]) => {
    const clusterSize = clusterItems.length || 1;
    const key = `client:${client.id}`, title = clusterSize > 1 ? `${clusterSize} ${t.cluster}` : client.name;
    const details: NonNullable<Selected> = {
      key, title, subtitle:client.online ? t.online : t.offline,
      details:clusterSize > 1 ? [
        ...clusterItems.slice(0, 50).map((item) => item.name),
        ...(clusterSize > 50 ? [`+${clusterSize - 50}`] : []),
      ] : [
        `${insights.reliability}: ${isRecentTimestamp(client.lastSeenAt) ? insights.recent : insights.estimated}`,
        [client.lastMunicipality,client.lastRegionCode,client.lastCountryCode].filter(Boolean).join(' · '),
        client.companyName ? `Société : ${client.companyName}` : '',
        `${client.subscriptionPlan || '—'} · ${client.subscriptionStatus || '—'} · ${client.paymentStatus || '—'}`,
        `${t.engagement} : ${client.engagementScore ?? 0}/100`,
        `${client.activeEventCount || 0} ${t.activeEvent} · ${client.stationSessionCount || 0} ${t.stations}`,
        `${t.capture}: ${client.captureOnline ? t.online : t.offline} · ${t.sharing}: ${client.sharingOnline ? t.online : t.offline}`,
        `${client.mediaCount || 0} ${t.media} · ${client.pendingMediaCount || 0} ${t.pending} · ${client.failedMediaCount || 0} ${t.failed}`,
        client.notes ? `Notes : ${client.notes.slice(0, 240)}` : '',
      ].filter(Boolean),
      contacts:clusterSize > 1 ? [] : contactActions(client.email, client.phone),
      members:clusterSize > 1 ? clusterItems.slice(0, 50).map((item) => ({ kind:'client' as const, item })) : undefined,
    };
    advanceFocus({ key,title,longitude:Number(client.lastLongitude),latitude:Number(client.lastLatitude),countryCode:client.lastCountryCode,municipality:client.lastMunicipality }, details);
  };
  const selectVisitor = (visitor: LiveVisitorPoint, clusterItems: LiveVisitorPoint[]) => {
    const clusterSize=clusterItems.length||1;
    const title=clusterSize>1?`${clusterSize} ${vt.grouped}`:vt.anonymous;
    const details: NonNullable<Selected>={
      key:`visitor:${visitor.id}`,
      title,
      subtitle:`● ${vt.activeNow} · ${vt.promotionalSite}`,
      details:clusterSize>1
        ? [`${insights.reliability}: ${insights.recent}`,vt.privacy,...Array.from(new Set(clusterItems.map((item)=>item.pagePath||'/'))).slice(0,8).map((page)=>`${vt.page}: ${page}`)]
        : [
          `${insights.reliability}: ${insights.recent}`,
          vt.privacy,
          [visitor.municipality,visitor.regionCode,visitor.countryCode].filter(Boolean).join(' · '),
          `${vt.page}: ${visitor.pagePath||'/'}`,
          `${vt.lastSeen}: ${new Date(visitor.lastSeenAt).toLocaleTimeString()}`,
        ].filter(Boolean),
    };
    advanceFocus({key:details.key,title,longitude:Number(visitor.longitude),latitude:Number(visitor.latitude),countryCode:visitor.countryCode,municipality:visitor.municipality},details);
  };
  const selectRelation = (item: RelationRecord, agent: AgentPoint, client: ClientPoint) => {
    const key = `relation:${item.id}`, title = `${displayName(agent)} ↔ ${client.name}`;
    advanceFocus(
      { key,title,longitude:Number(client.lastLongitude),latitude:Number(client.lastLatitude),countryCode:client.lastCountryCode,municipality:client.lastMunicipality },
      {
        key,title,subtitle:item.slaRisk ? t.risk : t.support,
        details:[item.subject,item.status,item.channel,item.priority,new Date(item.lastMessageAt).toLocaleString()].filter(Boolean),
        contacts:[...contactActions(agent.email,agent.phone,displayName(agent)),...contactActions(client.email,client.phone,client.name)],
      },
    );
  };
  const selectWeather = (marker: (typeof weatherMarkers)[number]) => {
    const current = marker.weather.current, visual = marker.visual;
    setSelected({
      key:`weather:${marker.code}`, title:marker.name, subtitle:`${visual.icon} ${visual.label} · ${wt.direct}`,
      details:[
        `${wt.temperature} : ${Math.round(Number(current.temperature_2m ?? 0))} °C`,
        `${wt.feels} : ${Math.round(Number(current.apparent_temperature ?? current.temperature_2m ?? 0))} °C`,
        `${wt.precipitation} : ${Number(current.precipitation ?? 0).toFixed(1)} mm`,
        `${wt.wind} : ${Math.round(Number(current.wind_speed_10m ?? 0))} km/h · ${Math.round(Number(current.wind_direction_10m ?? 0))}°`,
        current.time ? `${wt.updated} : ${new Date(current.time).toLocaleString()}` : '',
      ].filter(Boolean),
    });
  };

  const chooseSearchResult = (result: SearchResult) => {
    setSearchTerm('');
    if (result.kind==='country') { selectCountry(result.item); return; }
    const target: FocusTarget={key:result.key,title:result.label,longitude:result.longitude,latitude:result.latitude,countryCode:result.countryCode,municipality:result.municipality};
    if (result.kind==='agent') selectAgent(result.item,[result.item]);
    else if (result.kind==='client') selectClient(result.item,[result.item]);
    else if (result.kind==='visitor') selectVisitor(result.item,[result.item]);
    else {
      const item=result.item;
      setSelected({key:result.key,title:result.label,subtitle:`${item.visitors} ${t.visitor}`,details:[`${insights.reliability}: ${insights.aggregated}`,`${item.events} ${t.events}`,...Object.entries(item.stages).map(([stage,value])=>`${t[stage as Stage]}: ${value}`)]});
    }
    const level: GlobeZoomLevel=result.municipality?'municipality':'country';
    setFocusTarget(target);
    if (result.countryCode) setCountry(result.countryCode.toUpperCase());
    animateCamera(cameraForTarget(target,level),level,labelForTarget(target,level));
  };

  const openOperationalAlert = (alert: OperationalAlert) => {
    if (alert.key==='sla') setMode('relations');
    if (alert.key==='agents') setMode('agents');
    if (alert.key==='stale') setMode('clients');
  };

  return <div className={`operations-globe ${expanded ? 'expanded' : ''}`} aria-busy={loading}>
    <div className="globe-toolbar" aria-label={t.filters}>
      <div className="modebar" role="tablist" aria-label="Couches du globe">{modeOptions.map(([key, label]) => <button key={key} type="button" role="tab" className={mode === key ? 'mode active' : 'mode'} aria-selected={mode === key} aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>)}</div>
      <div className="search-box">
        <label><span>{insights.search}</span><input type="search" value={searchTerm} placeholder={insights.placeholder} autoComplete="off" aria-controls="globe-search-results" aria-expanded={normalizeSearch(searchTerm).length>=2} onChange={(event)=>setSearchTerm(event.target.value)} onKeyDown={(event)=>{if(event.key==='Escape')setSearchTerm('');}}/></label>
        {normalizeSearch(searchTerm).length>=2?<div id="globe-search-results" className="search-results" role="listbox" aria-label={insights.search}>{searchResults.length?searchResults.map((result)=><button key={result.key} type="button" role="option" aria-selected="false" onClick={()=>chooseSearchResult(result)}><strong>{result.label}</strong><span>{result.meta}</span></button>):<p role="status">{insights.noResults}</p>}</div>:null}
      </div>
      <div className="filters">
        <label><span>{t.status}</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>{statusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>{t.geography}</span><select value={country} onChange={(event) => { const code=event.target.value;if(code==='all')resetView();else{const feature=countryByCode.get(code);if(feature)selectCountry(feature);} }}><option value="all">{t.world}</option>{availableCountries.map((code) => <option key={code} value={code}>{localizedCountry(countryByCode.get(code)!.properties, language)}</option>)}</select></label>
        <label><span>{t.period}</span><select value={windowKey} disabled={mode==='visitors'} onChange={(event) => setWindowKey(event.target.value as WindowKey)}><option value="real-time">Temps réel</option><option value="1d">24 h</option><option value="7d">7 j</option><option value="30d">30 j</option></select></label>
      </div>
    </div>
    <div className="insight-grid">
      <section className="reliability-card" aria-label={insights.reliability}>
        <div className="insight-title"><strong>◎ {insights.reliability}</strong><b>{coveragePercent}% {insights.coverage}</b></div>
        <div className="reliability-meter" aria-hidden="true"><i style={{width:`${coveragePercent}%`}}/></div>
        <div className="reliability-chips"><span className="recent">● {reliabilityRecent} {insights.recent}</span><span className="estimated">● {reliabilityEstimated} {insights.estimated}</span><span className="aggregated">● {reliabilityAggregated} {insights.aggregated}</span><span className="unavailable">● {reliabilityUnavailable} {insights.unavailable}</span></div>
      </section>
      <section className="alerts-card" aria-label={insights.alerts}>
        <div className="insight-title"><strong>⚠ {insights.alerts}</strong><b>{operationalAlerts.length}</b></div>
        <div className="alert-list" aria-live="polite">{operationalAlerts.length?operationalAlerts.map((alert)=><button key={alert.key} type="button" className={alert.severity} onClick={()=>openOperationalAlert(alert)}>{alert.label}<span>›</span></button>):<span className="no-alert">✓ {insights.noAlerts}</span>}</div>
      </section>
    </div>
    {showVisitors?<div className="kpis live-kpis" aria-label={vt.mode}><span><i className="dot visitor-live"/> {liveVisitors.length} {vt.activeNow}</span><span>{vt.privacy}</span></div>:null}
    {showGrowth && overview?.growth ? <div className="kpis" aria-label={t.growth}><span>{overview.growth.summary.visitors} {t.visitor}</span><span>{overview.growth.summary.planSelections} {t.lead}</span><span>{overview.growth.summary.checkouts} {t.prospect}</span><span>{overview.growth.summary.conversions} {t.client}</span><span>{t.conversion} {overview.growth.summary.checkouts ? Math.round(overview.growth.summary.conversions / overview.growth.summary.checkouts * 100) : 0}%</span></div> : null}
    <div className="globe-stage"><div className="globe-halo"/><svg viewBox={`0 0 ${size} ${size}`} width="100%" className={`world-globe ${interacting?'interacting':''}`} role="img" aria-label="KHE Global Intelligence Globe 2.0" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onClickCapture={suppressGestureClick} onDoubleClick={handleDoubleClick} onWheel={handleWheel}>
      <defs><radialGradient id="ocean" cx="37%" cy="30%"><stop offset="0" stopColor="#203446"/><stop offset=".55" stopColor="#0f1b26"/><stop offset="1" stopColor="#05090d"/></radialGradient><radialGradient id="shine" cx="28%" cy="20%"><stop offset="0" stopColor="rgba(255,255,255,.24)"/><stop offset=".55" stopColor="rgba(255,255,255,.02)"/><stop offset="1" stopColor="rgba(255,255,255,0)"/></radialGradient><clipPath id="earth-clip"><circle cx={center} cy={center} r={radius}/></clipPath><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <circle cx={center} cy={center} r={radius} fill="url(#ocean)" stroke="rgba(218,177,76,.72)" strokeWidth="2.4"/>
      <g clipPath="url(#earth-clip)"><g className="geo-grid" fill="none" stroke="rgba(143,166,187,.13)" strokeWidth=".8"><ellipse cx={center} cy={center} rx={radius*.72} ry={radius}/><ellipse cx={center} cy={center} rx={radius*.36} ry={radius}/><line x1={center-radius} y1={center} x2={center+radius} y2={center}/><ellipse cx={center} cy={center-radius*.49} rx={radius*.87} ry={radius*.25}/><ellipse cx={center} cy={center+radius*.49} rx={radius*.87} ry={radius*.25}/></g>
        {countryShapes.map(({ feature, index, paths }) => paths.map((path, pathIndex) => { const code = iso2(feature.properties), action = () => selectCountry(feature); return <path key={`${index}-${pathIndex}`} d={path} className={`country ${code === ownerCountryCode ? 'owner-country' : ''} ${code === country ? 'selected-country' : ''}`} role={pathIndex === 0 ? 'button' : undefined} tabIndex={pathIndex === 0 ? 0 : -1} aria-label={pathIndex === 0 ? localizedCountry(feature.properties, language) : undefined} onClick={action} onKeyDown={(event) => activate(event, action)}/>; }))}
        {showRelations ? relations.map(({ item, agent, client }) => { const middleX=(agent.x+client.x)/2,middleY=Math.min(agent.y,client.y)-36,path=`M${agent.x.toFixed(1)},${agent.y.toFixed(1)} Q${middleX.toFixed(1)},${middleY.toFixed(1)} ${client.x.toFixed(1)},${client.y.toFixed(1)}`,action=()=>selectRelation(item,agent.item,client.item); return <path key={item.id} d={path} className={`relation-line ${item.slaRisk?'risk':''}`} role="button" tabIndex={0} aria-label={`${t.relations}: ${displayName(agent.item)} ${client.item.name}`} onClick={action} onKeyDown={(event)=>activate(event,action)}/>; }) : null}
        {labels.map((label) => <text key={`${label.code}-${label.x}`} x={label.x} y={label.y} textAnchor="middle" className={`country-label rank-${Math.min(8,label.rank)} ${label.code===ownerCountryCode?'owner-label':''}`}>{label.code===ownerCountryCode?'★ ':''}{label.name}</text>)}
        {weatherMarkers.map((marker) => { const action=()=>selectWeather(marker); return <g key={`weather-${marker.code}`} transform={`translate(${marker.x} ${marker.y-13})`} role="button" tabIndex={0} aria-label={`${marker.name} · ${marker.visual.label}`} className={`clickable weather-marker ${weatherPlaying?'playing':'paused'} ${marker.visual.kind}`} onClick={action} onKeyDown={(event)=>activate(event,action)}><circle r="11" className="weather-backdrop"/><text textAnchor="middle" y="4" className="weather-icon">{marker.visual.icon}</text><text x="10" y="-7" className="weather-temperature">{Math.round(Number(marker.weather.current.temperature_2m??0))}°</text></g>; })}
        {showVisitors ? visitorClusters.map((cluster) => { const visitor=cluster.items[0],action=()=>selectVisitor(visitor,cluster.items); return <g key={`visitor-${cluster.key}`} transform={`translate(${cluster.x} ${cluster.y})`} role="button" tabIndex={0} aria-label={`${cluster.items.length} ${vt.activeNow}`} className="clickable live-visitor-marker" onClick={action} onKeyDown={(event)=>activate(event,action)}><circle r={cluster.items.length>1?9:6.5} fill="#ff73d1" stroke="#fff4fc" strokeWidth="1.2"/><circle className="marker-ring" r={cluster.items.length>1?15:12} fill="none" stroke="rgba(255,115,209,.58)"/>{cluster.items.length>1?<text textAnchor="middle" y="3" className="cluster-count">{cluster.items.length}</text>:<circle r="2" fill="#311126" pointerEvents="none"/>}</g>; }) : null}
        {showGrowth ? growthClusters.map((cluster) => { const representative=cluster.items[0],count=cluster.items.reduce((sum,item)=>sum+item.visitors,0),title=[representative.municipality,representative.regionCode,representative.countryCode].filter(Boolean).join(' · ')||t.growth,key=`growth:${representative.countryCode||'world'}:${representative.municipality||representative.regionCode||cluster.key}`,action=()=>advanceFocus({key,title,longitude:Number(representative.longitude),latitude:Number(representative.latitude),countryCode:representative.countryCode,municipality:representative.municipality},{key,title,subtitle:`${count} ${t.visitor}`,details:[`${insights.reliability}: ${insights.aggregated}`,...Object.entries(representative.stages).map(([stage,value])=>`${t[stage as Stage]}: ${value}`)]}); return <g key={cluster.key} transform={`translate(${cluster.x} ${cluster.y})`} role="button" tabIndex={0} aria-label={`${count} ${t.visitor}`} className="clickable growth-marker" onClick={action} onKeyDown={(event)=>activate(event,action)}><circle r={Math.min(16,6+Math.sqrt(Math.max(1,count))*1.4)} fill={stageColors[representative.dominantStage]} opacity=".82" stroke="#fff1c2" strokeWidth="1.1"/><circle className="marker-ring" r={Math.min(22,10+Math.sqrt(Math.max(1,count))*1.8)} fill="none" stroke={stageColors[representative.dominantStage]} opacity=".35"/><text textAnchor="middle" y="3" className="cluster-count">{count}</text></g>; }) : null}
        {showClients ? clientClusters.map((cluster) => { const client=cluster.items[0],action=()=>selectClient(client,cluster.items); return <g key={cluster.key} transform={`translate(${cluster.x} ${cluster.y}) rotate(45)`} role="button" tabIndex={0} aria-label={client.name} className="clickable client-marker" onClick={action} onKeyDown={(event)=>activate(event,action)}><rect x={cluster.items.length>1?-8:-6} y={cluster.items.length>1?-8:-6} width={cluster.items.length>1?16:12} height={cluster.items.length>1?16:12} rx="2" fill={client.regular?'#c39cff':client.online?'#54d7e7':'#7f8dc0'} stroke="#fff" strokeWidth="1.1"/><circle className="marker-ring" r={cluster.items.length>1?14:client.online?11:9} fill="none" stroke="rgba(84,215,231,.4)"/>{cluster.items.length>1?<text transform="rotate(-45)" textAnchor="middle" y="3" className="cluster-count">{cluster.items.length}</text>:null}</g>; }) : null}
        {showAgents ? agentClusters.map((cluster) => { const agent=cluster.items[0],action=()=>selectAgent(agent,cluster.items); return <g key={cluster.key} transform={`translate(${cluster.x} ${cluster.y})`} role="button" tabIndex={0} aria-label={displayName(agent)} className="clickable agent-marker" filter="url(#glow)" onClick={action} onKeyDown={(event)=>activate(event,action)}><circle r={cluster.items.length>1?9:agent.available?7:agent.online?5.5:4.5} fill={agent.available?'#6fe09a':agent.online?'#e0b94d':'#7c8794'} stroke="#fff" strokeWidth="1.2"/>{cluster.items.length>1?<text textAnchor="middle" y="3" className="cluster-count">{cluster.items.length}</text>:agent.available?<circle className="marker-ring" r="12" fill="none" stroke="rgba(111,224,154,.5)"/>:null}</g>; }) : null}
        <circle cx={center} cy={center} r={radius} fill="url(#shine)" pointerEvents="none"/>
      </g><circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,220,131,.25)" strokeWidth="7" opacity=".22"/>
    </svg>{loading?<div className="globe-message">{t.loading}</div>:null}{worldError?<div className="globe-message fallback">{t.unavailable}</div>:null}</div>
    {!loading&&layerCount===0?<p className="layer-note" role="status">{overview?.growth?.enabled===false&&showGrowth?overview.growth.disabledReason||t.noData:t.noData}</p>:null}
    {error?<p className="globe-error" role="alert">{error}</p>:null}
    {selected?<aside className="globe-detail" aria-live="polite" aria-label={t.details}><div><strong>{selected.title}</strong><div className="detail-subtitle">{selected.subtitle}</div></div><div className="detail-lines">{selected.members?.length?<div className="cluster-members" role="list" aria-label={selected.title}>{selected.members.map((member)=>{const label=member.kind==='agent'?displayName(member.item):member.item.name;const meta=member.kind==='agent'?[member.item.municipality,member.item.countryCode,member.item.email].filter(Boolean).join(' · '):[member.item.lastMunicipality,member.item.lastCountryCode,member.item.email].filter(Boolean).join(' · ');const action=()=>member.kind==='agent'?selectAgent(member.item,[member.item]):selectClient(member.item,[member.item]);return <div key={`${member.kind}:${member.item.id}`} role="listitem"><button type="button" onClick={action} aria-label={`${t.details}: ${label}`}><b>{label}</b>{meta?<span>{meta}</span>:null}</button></div>;})}</div>:selected.details.map((line,index)=><span key={`${line}-${index}`}>{line}</span>)}{selected.contacts?.length?<div className="contact-actions">{selected.contacts.map((contact)=><a key={`${contact.kind}:${contact.href}:${contact.label}`} href={contact.href} aria-label={`${contact.label} ${contact.value}`}><b>{contact.kind==='phone'?'☎':'✉'} {contact.label}</b><span>{contact.value}</span></a>)}</div>:null}</div><button type="button" onClick={()=>setSelected(null)} aria-label={t.close}>×</button></aside>:null}
    <div className="zoom-bar" aria-label={zt.explore}>
      <div className="zoom-copy"><div className="zoom-path"><strong>{zt.world}</strong>{zoomLevel!=='world'?<><span>›</span><strong>{zt[zoomLevel]}</strong></>:null}{zoomLabel?<><span>›</span><b>{zoomLabel}</b></>:null}</div><small>{zt.gesture}<br/>{zt.explore}</small></div>
      <div className="zoom-actions">
        <button type="button" onClick={()=>zoomBy(-1)} disabled={zoomLevel==='world'} aria-label={zt.zoomOut}>−</button>
        <button type="button" onClick={()=>zoomBy(1)} disabled={zoomLevel==='municipality'} aria-label={zt.zoomIn}>+</button>
        <button type="button" className="wide" onClick={()=>resetView()} disabled={zoomLevel==='world'&&!focusTarget}>{zt.reset}</button>
      </div>
    </div>
    <div className="globe-controls"><label><span>{t.rotate}</span><input aria-label={t.rotate} type="range" min={-180} max={180} value={Math.round(camera.longitude)} onChange={(event)=>{setPlaying(false);const next={...cameraRef.current,longitude:Number(event.target.value)};cameraRef.current=next;setCamera(next);}}/></label><button type="button" className="button secondary" aria-pressed={playing} onClick={toggleAutoRotation}>{playing?`Ⅱ ${t.stop}`:`▶ ${t.auto}`}</button></div>
    <div className="weather-controls" aria-label={wt.weather}><button type="button" className={`button secondary ${weatherEnabled?'active':''}`} aria-pressed={weatherEnabled} onClick={()=>setWeatherEnabled((value)=>!value)}>{weatherEnabled?`☁ ${wt.hide}`:`☀ ${wt.show}`}</button>{weatherEnabled?<button type="button" className="button secondary" aria-pressed={weatherPlaying} onClick={()=>setWeatherPlaying((value)=>!value)}>{weatherPlaying?`Ⅱ ${wt.pause}`:`▶ ${wt.animate}`}</button>:null}{weatherEnabled&&weatherLoading?<span role="status">{wt.loading}</span>:null}{weatherEnabled&&weatherError?<span className="weather-error" role="status">{weatherError}</span>:null}{weatherEnabled&&weatherUpdatedAt?<small>{wt.updated} {new Date(weatherUpdatedAt).toLocaleTimeString()}</small>:null}{weatherEnabled?<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open‑Meteo.com</a>:null}</div>
    {reducedMotion&&!motionOverrideRef.current&&!playing?<p className="motion-note">{zt.reduced}</p>:null}
    <div className="globe-legend"><span><i className="dot owner"/> {t.ownerCurrent}</span><span><i className="dot agent"/> {t.agents}</span><span><i className="diamond"/> {t.clients}</span><span><i className="dot visitor-live"/> {vt.mode}</span>{Object.entries(stageColors).map(([stage,color])=><span key={stage}><i className="dot" style={{background:color}}/> {t[stage as Stage]}</span>)}<span><i className="line"/> {t.relations}</span></div>
    <p className="globe-privacy">{t.privacy}{isManagedAccount?` · ${overview?.capabilities.accountPlan ?? 'BUSINESS'} · compte et agents affectés`:''}{hiddenCount?` · ${hiddenCount} ${t.hidden}`:''}{overview?.generatedAt?` · ${t.refreshed} ${new Date(overview.generatedAt).toLocaleTimeString()}`:''}</p>
    <style jsx>{`
      .operations-globe{position:relative}.operations-globe.expanded{width:100%}.operations-globe.expanded .globe-stage{min-height:clamp(520px,68vh,820px)}.operations-globe.expanded .world-globe{width:min(82vh,920px);max-width:96%;height:auto}.operations-globe.expanded .zoom-bar,.operations-globe.expanded .globe-controls,.operations-globe.expanded .weather-controls,.operations-globe.expanded .globe-detail{max-width:920px}.operations-globe.expanded .globe-legend,.operations-globe.expanded .globe-privacy,.operations-globe.expanded .insight-grid{max-width:1040px}.globe-toolbar{display:grid;gap:9px}.modebar{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:6px;overflow:visible;padding:2px}.filters{display:flex;gap:6px;overflow-x:auto;padding:2px}.mode{display:flex;align-items:center;justify-content:center;width:100%;min-height:40px;border:1px solid #39434f;background:#10151b;color:#aeb8c5;border-radius:999px;padding:7px 11px;font-size:10px;font-weight:850;text-align:center;line-height:1.2;white-space:normal;overflow-wrap:anywhere;cursor:pointer}.mode.active{background:linear-gradient(135deg,#d9af49,#9e7428);border-color:#efcf79;color:#0b0d0f}.filters label{display:grid;gap:3px;min-width:125px}.filters span{font-size:9px;color:#8793a2;font-weight:850}.filters select{border:1px solid #36404b;background:#0e141a;color:#dfe6ed;border-radius:9px;padding:7px;font-size:10px}.search-box{position:relative;z-index:12}.search-box label{display:grid;gap:4px}.search-box label>span{color:#aeb8c5;font-size:10px;font-weight:850}.search-box input{width:100%;min-height:40px;border:1px solid rgba(210,173,79,.38);border-radius:12px;background:#0c1218;color:#eef3f7;padding:9px 12px;font-size:11px;outline:none}.search-box input:focus{border-color:#e2bd59;box-shadow:0 0 0 3px rgba(210,173,79,.12)}.search-results{position:absolute;top:100%;left:0;right:0;z-index:20;display:grid;gap:4px;max-height:280px;overflow:auto;margin-top:5px;padding:6px;border:1px solid rgba(210,173,79,.42);border-radius:12px;background:rgba(9,14,19,.98);box-shadow:0 18px 40px rgba(0,0,0,.45)}.search-results button{display:grid;gap:2px;width:100%;padding:8px 10px;border:1px solid transparent;border-radius:8px;background:#111820;color:#eef3f7;text-align:left;cursor:pointer}.search-results button:hover,.search-results button:focus{border-color:#d9b75d;background:#18212a;outline:none}.search-results strong{font-size:10px}.search-results span,.search-results p{margin:0;color:#95a2af;font-size:9px}.insight-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:8px;max-width:760px;margin:9px auto 0}.reliability-card,.alerts-card{display:grid;align-content:start;gap:7px;padding:10px;border:1px solid rgba(210,173,79,.24);border-radius:13px;background:rgba(13,18,24,.78)}.insight-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.insight-title strong{color:#eef3f7;font-size:10px}.insight-title b{color:#dcb851;font-size:9px}.reliability-meter{height:5px;overflow:hidden;border-radius:999px;background:#27303a}.reliability-meter i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#d49d35,#6fe09a)}.reliability-chips{display:flex;gap:5px;flex-wrap:wrap}.reliability-chips span{padding:4px 6px;border-radius:999px;background:#111820;color:#aeb8c5;font-size:8px}.reliability-chips .recent{color:#7ee5a2}.reliability-chips .estimated{color:#e8c463}.reliability-chips .aggregated{color:#78d8e4}.reliability-chips .unavailable{color:#969faa}.alert-list{display:grid;gap:5px}.alert-list button{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border:1px solid rgba(232,117,117,.28);border-radius:8px;background:rgba(104,35,42,.18);color:#ffb2ba;font-size:8.5px;text-align:left;cursor:pointer}.alert-list button.warning{border-color:rgba(224,185,77,.28);background:rgba(95,72,24,.18);color:#efd27f}.alert-list button:focus,.alert-list button:hover{border-color:currentColor;outline:none}.no-alert{color:#7ee5a2;font-size:9px}.kpis{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0 0}.kpis span{padding:5px 8px;border:1px solid rgba(210,173,79,.2);border-radius:999px;color:#c5cfda;font-size:9px}.globe-stage{position:relative;display:grid;place-items:center;isolation:isolate;min-height:300px;overflow:hidden;border-radius:22px}.globe-halo{position:absolute;width:78%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(210,173,79,.14),transparent 68%);filter:blur(20px);animation:haloBreath 4.8s ease-in-out infinite}.world-globe{position:relative;z-index:1;max-width:590px;filter:drop-shadow(0 24px 34px rgba(0,0,0,.42));touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}.world-globe.interacting{cursor:grabbing}.country{fill:rgba(70,87,72,.88);stroke:rgba(217,197,140,.28);stroke-width:.55;cursor:pointer;transition:fill .2s ease}.country:hover,.country:focus{fill:rgba(101,113,91,.98);outline:none}.country.owner-country{fill:#b88a2b;stroke:#ffe186;stroke-width:1.2}.country.selected-country{stroke:#fff1b6;stroke-width:1.7}.country-label{fill:rgba(236,239,236,.76);font-size:6.15px;font-weight:720;paint-order:stroke;stroke:rgba(3,7,10,.8);stroke-width:1.75px;pointer-events:none}.owner-label{fill:#ffe69b;font-size:8px;font-weight:950}.relation-line{fill:none;stroke:#e0b94d;stroke-width:1.8;stroke-dasharray:6 4;filter:drop-shadow(0 0 5px rgba(224,185,77,.7));cursor:pointer;animation:relationFlow 1.4s linear infinite}.relation-line.risk{stroke:#e87575}.relation-line:focus{stroke-width:3;outline:none}.clickable{cursor:pointer;outline:none}.clickable:focus>*:first-child{stroke:#fff4b8;stroke-width:3}.marker-ring{transform-box:fill-box;transform-origin:center;animation:markerPulse 2.2s ease-in-out infinite}.cluster-count{fill:#071019;font-size:7px;font-weight:950;pointer-events:none}.weather-marker{filter:drop-shadow(0 2px 5px rgba(0,0,0,.7))}.weather-backdrop{fill:rgba(7,13,19,.86);stroke:rgba(224,185,77,.55);stroke-width:.8}.weather-icon{font-size:13px;pointer-events:none;transform-box:fill-box;transform-origin:center}.weather-temperature{fill:#fff5d5;font-size:6px;font-weight:900;paint-order:stroke;stroke:#071019;stroke-width:2px;pointer-events:none}.weather-marker.playing.rain .weather-icon,.weather-marker.playing.showers .weather-icon{animation:weatherRain 1.15s ease-in-out infinite}.weather-marker.playing.snow .weather-icon{animation:weatherSnow 2.2s ease-in-out infinite}.weather-marker.playing.storm .weather-icon{animation:weatherStorm 1.4s ease-in-out infinite}.weather-marker.playing.clear .weather-icon{animation:weatherSun 3s ease-in-out infinite}.weather-marker.playing.cloudy .weather-icon,.weather-marker.playing.fog .weather-icon{animation:weatherCloud 4s ease-in-out infinite}.globe-message{position:absolute;z-index:4;padding:8px 12px;border:1px solid rgba(210,173,79,.25);border-radius:999px;background:rgba(7,11,15,.82);color:#cbd3dc;font-size:10px}.globe-message.fallback{top:9px}.layer-note{max-width:590px;margin:3px auto 0;padding:5px 9px;color:#8f9baa;font-size:9px;line-height:1.4;text-align:center}.globe-error{color:#ff9aa4;font-size:11px;text-align:center}.globe-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) auto;gap:12px;max-width:590px;margin:8px auto 0;padding:11px 12px;border:1px solid rgba(210,173,79,.42);border-radius:14px;background:linear-gradient(135deg,rgba(25,27,30,.98),rgba(12,16,21,.98));box-shadow:0 14px 34px rgba(0,0,0,.24);animation:detailReveal .28s ease-out}.globe-detail strong{color:#fff;font-size:12px}.detail-subtitle{color:#d9b75d;font-size:9px;font-weight:850;margin-top:2px}.detail-lines{display:grid;gap:3px;color:#aeb8c5;font-size:9px}.cluster-members{display:grid;gap:5px;max-height:190px;overflow:auto;padding-right:3px}.cluster-members button{display:grid;gap:2px;width:100%;padding:7px 8px;border:1px solid rgba(210,173,79,.28);border-radius:8px;background:#111820;color:#eef3f7;text-align:left;cursor:pointer}.cluster-members button:hover,.cluster-members button:focus{border-color:#e5c667;background:#18212a;outline:none}.cluster-members button b{font-size:9px}.cluster-members button span{overflow:hidden;text-overflow:ellipsis;color:#9da9b5;font-size:8px;white-space:nowrap}.contact-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.contact-actions a{display:grid;gap:1px;min-width:140px;padding:7px 9px;border:1px solid rgba(210,173,79,.35);border-radius:9px;background:#111820;color:#eef3f7;text-decoration:none}.contact-actions a:focus,.contact-actions a:hover{border-color:#e5c667;background:#18212a;outline:none}.contact-actions a b{color:#e2bd59;font-size:8.5px}.contact-actions a span{overflow:hidden;text-overflow:ellipsis;font-size:9px}.globe-detail>button{border:0;background:transparent;color:#a8b3bf;font-size:20px;cursor:pointer}.zoom-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;max-width:590px;margin:10px auto 0;padding:9px 10px;border:1px solid rgba(210,173,79,.22);border-radius:13px;background:rgba(13,18,24,.72)}.zoom-copy{min-width:0}.zoom-path{display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;color:#8d98a7;font-size:9px}.zoom-path strong{color:#d8b75d;text-transform:uppercase;letter-spacing:.05em}.zoom-path b{overflow:hidden;text-overflow:ellipsis;color:#e7edf4}.zoom-copy small{display:block;margin-top:4px;color:#8f9baa;font-size:8.5px;line-height:1.45}.zoom-actions{display:flex;gap:5px}.zoom-actions button{min-width:31px;min-height:31px;border:1px solid #3b4652;border-radius:9px;background:#111820;color:#eef3f7;font-weight:900;cursor:pointer}.zoom-actions button.wide{padding:0 9px;color:#dcb851;font-size:9px}.zoom-actions button:disabled{opacity:.38;cursor:not-allowed}.globe-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;max-width:590px;margin:9px auto 0}.globe-controls label{display:grid;gap:5px}.globe-controls label span{font-size:11px;font-weight:850;color:#aeb8c5}.globe-controls input{width:100%;accent-color:#d8ae45}.globe-controls .button{min-height:36px;padding:7px 10px;font-size:10px}.weather-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:590px;margin:7px auto 0}.weather-controls .button{min-height:32px;padding:6px 9px;font-size:9px}.weather-controls .button.active{border-color:#d9b75d;color:#f1d887}.weather-controls span,.weather-controls small{color:#91a0ae;font-size:8.5px}.weather-controls .weather-error{color:#ff9aa4}.motion-note{text-align:center;color:#aab4c0;font-size:8.5px;line-height:1.4;max-width:590px;margin:6px auto 0}.globe-legend{display:flex;justify-content:center;gap:11px;flex-wrap:wrap;margin-top:12px;color:#aeb8c5;font-size:9px}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}.dot.owner{background:#b88a2b;box-shadow:0 0 7px #eac96c}.dot.agent{background:#6fe09a}.dot.visitor-live{background:#ff73d1;box-shadow:0 0 8px rgba(255,115,209,.8)}.live-kpis{justify-content:center}.live-visitor-marker{filter:drop-shadow(0 0 7px rgba(255,115,209,.6))}.diamond{display:inline-block;width:8px;height:8px;transform:rotate(45deg);margin-right:5px;background:#54d7e7}.line{display:inline-block;width:15px;height:2px;margin:0 4px 2px 0;background:#e0b94d}.globe-privacy{text-align:center;color:#8e99a8;font-size:10px;line-height:1.45;margin:8px auto 0;max-width:650px}@keyframes relationFlow{to{stroke-dashoffset:-20}}@keyframes markerPulse{50%{opacity:.88;transform:scale(1.18)}}@keyframes weatherRain{50%{transform:translateY(2px)}}@keyframes weatherSnow{50%{transform:translate(-1px,2px) rotate(4deg)}}@keyframes weatherStorm{25%{opacity:.55}50%{transform:scale(1.12)}}@keyframes weatherSun{50%{transform:scale(1.1);filter:drop-shadow(0 0 7px rgba(255,211,88,.95))}}@keyframes weatherCloud{50%{transform:translateX(2px)}}@keyframes haloBreath{50%{opacity:.68;transform:scale(1.04)}}@keyframes detailReveal{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
      .weather-controls a{color:#8fb4cf;font-size:8.5px;text-decoration:none}
      @media(max-width:600px){.modebar{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mode{min-height:44px;padding:8px 10px}.insight-grid{grid-template-columns:1fr}.search-results{position:static;max-height:220px}.operations-globe.expanded .globe-stage{min-height:min(74vh,500px)}.operations-globe.expanded .world-globe{width:min(94vw,540px)}.globe-stage{min-height:260px}.country-label{font-size:5.7px}.country-label.rank-5,.country-label.rank-6,.country-label.rank-7,.country-label.rank-8{display:none}.filters{display:grid;grid-template-columns:repeat(3,minmax(110px,1fr));overflow-x:auto}.zoom-bar{grid-template-columns:1fr}.zoom-actions{justify-content:flex-start}.globe-controls{grid-template-columns:1fr}.globe-controls .button{justify-self:start}.globe-detail{grid-template-columns:1fr auto}.detail-lines{grid-column:1/-1}.relation-line{stroke-width:2.3}}
      @media(prefers-reduced-motion:reduce){.relation-line,.marker-ring,.weather-icon,.globe-halo,.globe-detail{animation:none}.country{transition:none}}
    `}</style>
  </div>;
}
