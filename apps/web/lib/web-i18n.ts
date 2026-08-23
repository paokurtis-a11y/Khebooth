export const WEB_LANGUAGES = ['fr','en','de','it','es','pt'] as const;
export type WebLanguage = (typeof WEB_LANGUAGES)[number];

export const WEB_LANGUAGE_STORAGE_KEY = 'khe.web.language';
export const WEB_LANGUAGE_EVENT = 'khe-language-changed';

export const WEB_LANGUAGE_LABELS: Record<WebLanguage,string> = {
  fr:'Français', en:'English', de:'Deutsch', it:'Italiano', es:'Español', pt:'Português',
};

export const WEB_LANGUAGE_LOCALES: Record<WebLanguage,string> = {
  fr:'fr-CH', en:'en-GB', de:'de-CH', it:'it-CH', es:'es-ES', pt:'pt-PT',
};

type TranslationSet = Record<WebLanguage,string>;

const phrase = (fr:string,en:string,de:string,it:string,es:string,pt:string):TranslationSet => ({fr,en,de,it,es,pt});

export const WEB_PHRASES: Record<string,TranslationSet> = {
  'MENU KHE': phrase('MENU KHE','KHE MENU','KHE MENÜ','MENU KHE','MENÚ KHE','MENU KHE'),
  'Tout fermer': phrase('Tout fermer','Close all','Alle schließen','Chiudi tutto','Cerrar todo','Fechar tudo'),
  'Accueil': phrase('Accueil','Home','Start','Home','Inicio','Início'),
  'Clients': phrase('Clients','Clients','Kunden','Clienti','Clientes','Clientes'),
  'Événements & Studio': phrase('Événements & Studio','Events & Studio','Events & Studio','Eventi & Studio','Eventos & Studio','Eventos & Studio'),
  'Support & communications': phrase('Support & communications','Support & communications','Support & Kommunikation','Supporto & comunicazioni','Soporte y comunicaciones','Suporte & comunicações'),
  'Mon activité agent': phrase('Mon activité agent','My agent activity','Meine Agentenaktivität','La mia attività agente','Mi actividad de agente','Minha atividade de agente'),
  'Centre opérations KHE': phrase('Centre opérations KHE','KHE Operations Center','KHE Operationszentrum','Centro operativo KHE','Centro de operaciones KHE','Centro de operações KHE'),
  'Marketing & croissance': phrase('Marketing & croissance','Marketing & growth','Marketing & Wachstum','Marketing & crescita','Marketing y crecimiento','Marketing & crescimento'),
  'Administration': phrase('Administration','Administration','Administration','Amministrazione','Administración','Administração'),
  'Paramètres': phrase('Paramètres','Settings','Einstellungen','Impostazioni','Ajustes','Definições'),
  'Aide & conformité': phrase('Aide & conformité','Help & compliance','Hilfe & Compliance','Aiuto & conformità','Ayuda y cumplimiento','Ajuda & conformidade'),
  'Dashboard': phrase('Tableau de bord','Dashboard','Dashboard','Dashboard','Panel de control','Painel'),
  'CRM & historique des e-mails': phrase('CRM & historique des e-mails','CRM & email history','CRM & E-Mail-Verlauf','CRM e cronologia e-mail','CRM e historial de e-mails','CRM e histórico de e-mails'),
  'Événements': phrase('Événements','Events','Veranstaltungen','Eventi','Eventos','Eventos'),
  'Modèles': phrase('Modèles','Templates','Vorlagen','Modelli','Plantillas','Modelos'),
  'Créer un événement': phrase('Créer un événement','Create event','Event erstellen','Crea evento','Crear evento','Criar evento'),
  'Aide / Messagerie': phrase('Aide / Messagerie','Help / Messages','Hilfe / Nachrichten','Aiuto / Messaggi','Ayuda / Mensajes','Ajuda / Mensagens'),
  'Vue d’ensemble des opérations': phrase('Vue d’ensemble des opérations','Operations overview','Operationsübersicht','Panoramica operazioni','Vista general de operaciones','Visão geral das operações'),
  'Routage & SLA': phrase('Routage & SLA','Routing & SLA','Routing & SLA','Instradamento & SLA','Enrutamiento & SLA','Encaminhamento & SLA'),
  'Effectifs & prévisions': phrase('Effectifs & prévisions','Workforce & forecasts','Personal & Prognosen','Personale & previsioni','Personal y previsiones','Equipa & previsões'),
  'Marketing & analyses': phrase('Marketing & analyses','Marketing & analytics','Marketing & Analysen','Marketing & analisi','Marketing y analítica','Marketing & análises'),
  'Stripe & campagnes': phrase('Stripe & campagnes','Stripe & campaigns','Stripe & Kampagnen','Stripe & campagne','Stripe y campañas','Stripe & campanhas'),
  'E-mailing automatisé': phrase('E-mailing automatisé','Automated emailing','E-Mail-Automation','E-mail automatiche','E-mail automatizado','E-mail automático'),
  'Communications clients': phrase('Communications clients','Client communications','Kundenkommunikation','Comunicazioni clienti','Comunicaciones con clientes','Comunicações com clientes'),
  'Profil': phrase('Profil','Profile','Profil','Profilo','Perfil','Perfil'),
  'Paramètres généraux': phrase('Paramètres généraux','General settings','Allgemeine Einstellungen','Impostazioni generali','Ajustes generales','Definições gerais'),
  'Configuration du site web': phrase('Configuration du site web','Website configuration','Website-Konfiguration','Configurazione del sito web','Configuración del sitio web','Configuração do site'),
  'Équipe & autorisations': phrase('Équipe & autorisations','Team & permissions','Team & Berechtigungen','Team e autorizzazioni','Equipo y permisos','Equipa & permissões'),
  'Sécurité des plateformes': phrase('Sécurité des plateformes','Platform security','Plattformsicherheit','Sicurezza delle piattaforme','Seguridad de las plataformas','Segurança das plataformas'),
  'Guide d’utilisation': phrase('Guide d’utilisation','User guide','Benutzerhandbuch','Guida utente','Guía de uso','Manual de utilização'),
  'Conditions d’utilisation': phrase('Conditions d’utilisation','Terms of use','Nutzungsbedingungen','Condizioni d’uso','Condiciones de uso','Termos de utilização'),
  'Déconnexion': phrase('Déconnexion','Log out','Abmelden','Disconnetti','Cerrar sesión','Terminar sessão'),
  'Chargement de KHE Booth…': phrase('Chargement de KHE Booth…','Loading KHE Booth…','KHE Booth wird geladen…','Caricamento KHE Booth…','Cargando KHE Booth…','A carregar KHE Booth…'),
  'Espace Agent KHE': phrase('Espace Agent KHE','KHE Agent space','KHE Agentenbereich','Area Agente KHE','Espacio Agente KHE','Espaço Agente KHE'),
  'Mon planning': phrase('Mon planning','My schedule','Mein Dienstplan','La mia pianificazione','Mi planificación','O meu planeamento'),
  'Shift en direct': phrase('Shift en direct','Live shift','Live-Schicht','Turno in diretta','Turno en directo','Turno em direto'),
  'Mon brief de shift': phrase('Mon brief de shift','My shift brief','Mein Schichtbriefing','Il mio briefing di turno','Mi briefing de turno','O meu briefing de turno'),
  'Mon relais': phrase('Mon relais','My handover','Meine Übergabe','Il mio passaggio consegne','Mi relevo','A minha passagem de turno'),
  'Mon renfort SLA': phrase('Mon renfort SLA','My SLA rescue','Mein SLA-Einsatz','Il mio supporto SLA','Mi refuerzo SLA','O meu reforço SLA'),
  'Centre de commande': phrase('Centre de commande','Command Center','Command Center','Centro di comando','Centro de mando','Centro de comando'),
  'Shift équipe en direct': phrase('Shift équipe en direct','Team live shift','Team-Live-Schicht','Turno team in diretta','Turno de equipo en directo','Turno da equipa em direto'),
  'Brief d’équipe': phrase('Brief d’équipe','Team brief','Team-Briefing','Brief del team','Brief del equipo','Brief da equipa'),
  'Relais d’équipe': phrase('Relais d’équipe','Team handover','Team-Übergabe','Passaggio consegne del team','Relevo del equipo','Passagem de turno da equipa'),
  'Renfort SLA de l’équipe': phrase('Renfort SLA de l’équipe','Team SLA rescue','Team-SLA-Einsatz','Supporto SLA del team','Refuerzo SLA del equipo','Reforço SLA da equipa'),
  'Équipe & effectifs': phrase('Équipe & effectifs','Team & workforce','Team & Personal','Team & personale','Equipo y personal','Equipa & efetivos'),
  'Optimisation du planning': phrase('Optimisation du planning','Schedule optimization','Dienstplanoptimierung','Ottimizzazione pianificazione','Optimización de planificación','Otimização do planeamento'),
  'Abonnement & facturation': phrase('Abonnement & facturation','Subscription & billing','Abonnement & Abrechnung','Abbonamento & fatturazione','Suscripción y facturación','Subscrição & faturação'),
  'Connexions développeur': phrase('Connexions développeur','Developer connections','Entwicklerverbindungen','Connessioni sviluppatore','Conexiones de desarrollador','Ligações de programador'),
  'Agents KHE': phrase('Agents KHE','KHE Agents','KHE-Agenten','Agenti KHE','Agentes KHE','Agentes KHE'),
  'Confidentialité': phrase('Confidentialité','Privacy','Datenschutz','Privacy','Privacidad','Privacidade'),
  'Suppression des données': phrase('Suppression des données','Data deletion','Datenlöschung','Eliminazione dei dati','Eliminación de datos','Eliminação de dados'),
  'ESPACE ENTREPRISE GÉRÉ PAR KHE': phrase('ESPACE ENTREPRISE GÉRÉ PAR KHE','KHE-MANAGED ENTERPRISE SPACE','VON KHE VERWALTETER ENTERPRISE-BEREICH','SPAZIO ENTERPRISE GESTITO DA KHE','ESPACIO ENTERPRISE GESTIONADO POR KHE','ESPAÇO ENTERPRISE GERIDO PELA KHE'),
  'Agent KHE': phrase('Agent KHE','KHE Agent','KHE-Agent','Agente KHE','Agente KHE','Agente KHE'),
  'Connecté': phrase('Connecté','Connected','Verbunden','Connesso','Conectado','Ligado'),
  'Déconnecté': phrase('Déconnecté','Offline','Getrennt','Disconnesso','Desconectado','Desligado'),
  'Disponible': phrase('Disponible','Available','Verfügbar','Disponibile','Disponible','Disponível'),
  'Occupé': phrase('Occupé','Busy','Beschäftigt','Occupato','Ocupado','Ocupado'),
  'En pause': phrase('En pause','On break','In Pause','In pausa','En pausa','Em pausa'),
  'Indisponible': phrase('Indisponible','Unavailable','Nicht verfügbar','Non disponibile','No disponible','Indisponível'),
  'Disponible — recevoir les tâches': phrase('Disponible — recevoir les tâches','Available — receive tasks','Verfügbar — Aufgaben empfangen','Disponibile — ricevi attività','Disponible — recibir tareas','Disponível — receber tarefas'),
  'Routage intelligent actif': phrase('Routage intelligent actif','Smart routing active','Intelligentes Routing aktiv','Instradamento intelligente attivo','Enrutamiento inteligente activo','Encaminhamento inteligente ativo'),
  'Aucune affectation automatique': phrase('Aucune affectation automatique','No automatic assignment','Keine automatische Zuweisung','Nessuna assegnazione automatica','Sin asignación automática','Sem atribuição automática'),
  'Shift en service': phrase('Shift en service','Shift active','Schicht aktiv','Turno attivo','Turno activo','Turno ativo'),
  'Shift en pause': phrase('Shift en pause','Shift paused','Schicht pausiert','Turno in pausa','Turno en pausa','Turno em pausa'),
  'Brief de fin de shift prêt': phrase('Brief de fin de shift prêt','End-of-shift brief ready','Schichtabschluss-Briefing bereit','Brief di fine turno pronto','Brief de fin de turno listo','Brief de fim de turno pronto'),
  'SLA Rescue actif': phrase('SLA Rescue actif','SLA Rescue active','SLA Rescue aktiv','SLA Rescue attivo','SLA Rescue activo','SLA Rescue ativo'),
  'Équipe en direct': phrase('Équipe en direct','Live team','Live-Team','Team in diretta','Equipo en directo','Equipa em direto'),
  'Renfort d’équipe': phrase('Renfort d’équipe','Team rescue','Team-Einsatz','Supporto team','Refuerzo de equipo','Reforço de equipa'),
  'Routage': phrase('Routage','Routing','Routing','Instradamento','Enrutamiento','Encaminhamento'),
  'Optimiser': phrase('Optimiser','Optimize','Optimieren','Ottimizza','Optimizar','Otimizar'),
  'Disponibilité Agent KHE': phrase('Disponibilité Agent KHE','KHE Agent availability','KHE-Agent-Verfügbarkeit','Disponibilità Agente KHE','Disponibilidad Agente KHE','Disponibilidade Agente KHE'),
  'Afficher le panneau Agent KHE': phrase('Afficher le panneau Agent KHE','Show KHE Agent panel','KHE-Agentenpanel anzeigen','Mostra pannello Agente KHE','Mostrar panel Agente KHE','Mostrar painel Agente KHE'),
  'Masquer le panneau Agent KHE': phrase('Masquer le panneau Agent KHE','Hide KHE Agent panel','KHE-Agentenpanel ausblenden','Nascondi pannello Agente KHE','Ocultar panel Agente KHE','Ocultar painel Agente KHE'),
  'KHE • DISPONIBILITÉ AGENT': phrase('KHE • DISPONIBILITÉ AGENT','KHE • AGENT AVAILABILITY','KHE • AGENTENVERFÜGBARKEIT','KHE • DISPONIBILITÀ AGENTE','KHE • DISPONIBILIDAD DEL AGENTE','KHE • DISPONIBILIDADE DO AGENTE'),
  'Souhaitez-vous recevoir des affectations ?': phrase('Souhaitez-vous recevoir des affectations ?','Would you like to receive assignments?','Möchten Sie Zuweisungen erhalten?','Vuoi ricevere assegnazioni?','¿Desea recibir asignaciones?','Pretende receber atribuições?'),
  'Partager ma zone approximative': phrase('Partager ma zone approximative','Share my approximate area','Meinen ungefähren Bereich teilen','Condividi la mia zona approssimativa','Compartir mi zona aproximada','Partilhar a minha zona aproximada'),
  'Me rendre disponible': phrase('Me rendre disponible','Set myself available','Als verfügbar setzen','Impostami disponibile','Ponerme disponible','Ficar disponível'),
  'Rester indisponible': phrase('Rester indisponible','Stay unavailable','Nicht verfügbar bleiben','Resta non disponibile','Seguir no disponible','Continuar indisponível'),
  'Activation…': phrase('Activation…','Activating…','Aktivierung…','Attivazione…','Activando…','A ativar…'),
  'Présence indisponible': phrase('Présence indisponible','Presence unavailable','Präsenz nicht verfügbar','Presenza non disponibile','Presencia no disponible','Presença indisponível'),
  'Impossible de modifier le statut': phrase('Impossible de modifier le statut','Unable to change status','Status kann nicht geändert werden','Impossibile modificare lo stato','No se puede cambiar el estado','Não foi possível alterar o estado'),
  'PRÉFÉRENCES KHE': phrase('PRÉFÉRENCES KHE','KHE PREFERENCES','KHE-EINSTELLUNGEN','PREFERENZE KHE','PREFERENCIAS KHE','PREFERÊNCIAS KHE'),
  'Affichage, langue, notifications, son, vibration et comportement régional du site.': phrase('Affichage, langue, notifications, son, vibration et comportement régional du site.','Display, language, notifications, sound, vibration and regional site behaviour.','Anzeige, Sprache, Benachrichtigungen, Ton, Vibration und regionales Website-Verhalten.','Visualizzazione, lingua, notifiche, suono, vibrazione e comportamento regionale del sito.','Pantalla, idioma, notificaciones, sonido, vibración y comportamiento regional del sitio.','Visualização, idioma, notificações, som, vibração e comportamento regional do site.'),
  'AFFICHAGE & LISIBILITÉ': phrase('AFFICHAGE & LISIBILITÉ','DISPLAY & READABILITY','ANZEIGE & LESBARKEIT','VISUALIZZAZIONE & LEGGIBILITÀ','PANTALLA Y LEGIBILIDAD','VISUALIZAÇÃO & LEGIBILIDADE'),
  'Taille et style des écritures': phrase('Taille et style des écritures','Text size and style','Textgröße und -stil','Dimensione e stile del testo','Tamaño y estilo del texto','Tamanho e estilo do texto'),
  'Taille du texte': phrase('Taille du texte','Text size','Textgröße','Dimensione del testo','Tamaño del texto','Tamanho do texto'),
  'Style d’écriture': phrase('Style d’écriture','Text style','Textstil','Stile del testo','Estilo del texto','Estilo do texto'),
  'Petit': phrase('Petit','Small','Klein','Piccolo','Pequeño','Pequeno'),
  'Normal': phrase('Normal','Normal','Normal','Normale','Normal','Normal'),
  'Grand': phrase('Grand','Large','Groß','Grande','Grande','Grande'),
  'Très grand': phrase('Très grand','Extra large','Sehr groß','Molto grande','Muy grande','Muito grande'),
  'Classique': phrase('Classique','Classic','Klassisch','Classico','Clásico','Clássico'),
  'Moderne': phrase('Moderne','Modern','Modern','Moderno','Moderno','Moderno'),
  'Élégant': phrase('Élégant','Elegant','Elegant','Elegante','Elegante','Elegante'),
  'Confort': phrase('Confort','Comfort','Komfort','Comfort','Confort','Conforto'),
  'APERÇU EN DIRECT': phrase('APERÇU EN DIRECT','LIVE PREVIEW','LIVE-VORSCHAU','ANTEPRIMA LIVE','VISTA PREVIA EN DIRECTO','PRÉ-VISUALIZAÇÃO EM DIRETO'),
  'LANGUE': phrase('LANGUE','LANGUAGE','SPRACHE','LINGUA','IDIOMA','IDIOMA'),
  'Langue de l’interface': phrase('Langue de l’interface','Interface language','Oberflächensprache','Lingua dell’interfaccia','Idioma de la interfaz','Idioma da interface'),
  'La langue choisie s’applique à toute l’interface KHE Booth.': phrase('La langue choisie s’applique à toute l’interface KHE Booth.','The selected language applies to the entire KHE Booth interface.','Die ausgewählte Sprache gilt für die gesamte KHE-Booth-Oberfläche.','La lingua selezionata si applica all’intera interfaccia KHE Booth.','El idioma seleccionado se aplica a toda la interfaz de KHE Booth.','O idioma selecionado aplica-se a toda a interface do KHE Booth.'),
  'Langue enregistrée.': phrase('Langue enregistrée.','Language saved.','Sprache gespeichert.','Lingua salvata.','Idioma guardado.','Idioma guardado.'),
  'ALERTES': phrase('ALERTES','ALERTS','WARNUNGEN','AVVISI','ALERTAS','ALERTAS'),
  'Notifications': phrase('Notifications','Notifications','Benachrichtigungen','Notifiche','Notificaciones','Notificações'),
  'Notifications activées': phrase('Notifications activées','Notifications enabled','Benachrichtigungen aktiviert','Notifiche attive','Notificaciones activadas','Notificações ativadas'),
  'Son': phrase('Son','Sound','Ton','Suono','Sonido','Som'),
  'Son de notification': phrase('Son de notification','Notification sound','Benachrichtigungston','Suono di notifica','Sonido de notificación','Som de notificação'),
  'Silencieux': phrase('Silencieux','Silent','Stumm','Silenzioso','Silencioso','Silencioso'),
  'Vibration si compatible': phrase('Vibration si compatible','Vibration when supported','Vibration falls unterstützt','Vibrazione se supportata','Vibración si es compatible','Vibração se compatível'),
  'Mode': phrase('Mode','Mode','Modus','Modalità','Modo','Modo'),
  'Intensité souhaitée': phrase('Intensité souhaitée','Desired intensity','Gewünschte Intensität','Intensità desiderata','Intensidad deseada','Intensidade pretendida'),
  'Courte': phrase('Courte','Short','Kurz','Breve','Corta','Curta'),
  'Double': phrase('Double','Double','Doppelt','Doppia','Doble','Dupla'),
  'Triple': phrase('Triple','Triple','Dreifach','Tripla','Triple','Tripla'),
  'Longue': phrase('Longue','Long','Lang','Lunga','Larga','Longa'),
  'Aucune': phrase('Aucune','None','Keine','Nessuna','Ninguna','Nenhuma'),
  'Légère': phrase('Légère','Light','Leicht','Leggera','Ligera','Leve'),
  'Moyenne': phrase('Moyenne','Medium','Mittel','Media','Media','Média'),
  'Forte': phrase('Forte','Strong','Stark','Forte','Fuerte','Forte'),
  'Tester son / vibration': phrase('Tester son / vibration','Test sound / vibration','Ton / Vibration testen','Prova suono / vibrazione','Probar sonido / vibración','Testar som / vibração'),
  'SITE PROMOTIONNEL': phrase('SITE PROMOTIONNEL','PROMOTIONAL SITE','PROMO-WEBSITE','SITO PROMOZIONALE','SITIO PROMOCIONAL','SITE PROMOCIONAL'),
  'Comportement par région': phrase('Comportement par région','Behaviour by region','Verhalten nach Region','Comportamento per regione','Comportamiento por región','Comportamento por região'),
  'Enregistrer les réglages régionaux': phrase('Enregistrer les réglages régionaux','Save regional settings','Regionale Einstellungen speichern','Salva impostazioni regionali','Guardar ajustes regionales','Guardar definições regionais'),
  'SITE ACTIF': phrase('SITE ACTIF','SITE ACTIVE','WEBSITE AKTIV','SITO ATTIVO','SITIO ACTIVO','SITE ATIVO'),
  'SITE MASQUÉ': phrase('SITE MASQUÉ','SITE HIDDEN','WEBSITE AUSGEBLENDET','SITO NASCOSTO','SITIO OCULTO','SITE OCULTO'),
  'VISIBILITÉ': phrase('VISIBILITÉ','VISIBILITY','SICHTBARKEIT','VISIBILITÀ','VISIBILIDAD','VISIBILIDADE'),
  'Site accessible': phrase('Site accessible','Site accessible','Website zugänglich','Sito accessibile','Sitio accesible','Site acessível'),
  'Afficher les prix': phrase('Afficher les prix','Show prices','Preise anzeigen','Mostra prezzi','Mostrar precios','Mostrar preços'),
  'Téléchargement': phrase('Téléchargement','Download','Download','Download','Descarga','Transferência'),
  'Avis clients': phrase('Avis clients','Client reviews','Kundenbewertungen','Recensioni clienti','Opiniones de clientes','Avaliações de clientes'),
  'Vidéos promotionnelles': phrase('Vidéos promotionnelles','Promotional videos','Werbevideos','Video promozionali','Vídeos promocionales','Vídeos promocionais'),
  'Devise imposée': phrase('Devise imposée','Forced currency','Erzwungene Währung','Valuta forzata','Moneda forzada','Moeda definida'),
  'Détection automatique': phrase('Détection automatique','Automatic detection','Automatische Erkennung','Rilevamento automatico','Detección automática','Deteção automática'),
  'MESSAGE LOCALISÉ': phrase('MESSAGE LOCALISÉ','LOCALIZED MESSAGE','LOKALISIERTE NACHRICHT','MESSAGGIO LOCALIZZATO','MENSAJE LOCALIZADO','MENSAGEM LOCALIZADA'),
  'Titre principal': phrase('Titre principal','Main title','Haupttitel','Titolo principale','Título principal','Título principal'),
  'Bouton principal': phrase('Bouton principal','Primary button','Hauptschaltfläche','Pulsante principale','Botón principal','Botão principal'),
  'Sous-titre': phrase('Sous-titre','Subtitle','Untertitel','Sottotitolo','Subtítulo','Subtítulo'),
  'Annonce régionale': phrase('Annonce régionale','Regional announcement','Regionale Ankündigung','Annuncio regionale','Anuncio regional','Anúncio regional'),
  'Suisse': phrase('Suisse','Switzerland','Schweiz','Svizzera','Suiza','Suíça'),
  'Zone euro': phrase('Zone euro','Eurozone','Eurozone','Zona euro','Zona euro','Zona euro'),
  'Afrique': phrase('Afrique','Africa','Afrika','Africa','África','África'),
  'Asie': phrase('Asie','Asia','Asien','Asia','Asia','Ásia'),
  'Amériques': phrase('Amériques','Americas','Amerika','Americhe','Américas','Américas'),
  'Autres régions': phrase('Autres régions','Other regions','Andere Regionen','Altre regioni','Otras regiones','Outras regiões'),
};

const normalize = (value:string) => value.trim().replace(/\s+/g,' ');
const aliases = new Map<string,string>();
for (const [source,translations] of Object.entries(WEB_PHRASES)) {
  aliases.set(normalize(source), source);
  for (const translated of Object.values(translations)) aliases.set(normalize(translated), source);
}

export function isWebLanguage(value:unknown):value is WebLanguage {
  return typeof value === 'string' && (WEB_LANGUAGES as readonly string[]).includes(value);
}

export function readWebLanguage():WebLanguage {
  if (typeof window === 'undefined') return 'fr';
  const value = window.localStorage.getItem(WEB_LANGUAGE_STORAGE_KEY);
  return isWebLanguage(value) ? value : 'fr';
}

export function setWebLanguage(language:WebLanguage) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WEB_LANGUAGE_STORAGE_KEY, language);
  window.dispatchEvent(new CustomEvent(WEB_LANGUAGE_EVENT,{detail:language}));
}

export function translateWebPhrase(value:string,language:WebLanguage):string {
  const trimmed = normalize(value);
  if (!trimmed) return value;
  const source = aliases.get(trimmed) ?? trimmed;
  return WEB_PHRASES[source]?.[language] ?? value;
}
