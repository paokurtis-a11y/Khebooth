export type MarketingLanguage='fr'|'en'|'de'|'it'|'es'|'pt';
export type MarketingPlanCode='DISCOVERY'|'STARTER'|'PRO'|'BUSINESS'|'ENTERPRISE';

export const MARKETING_LANGUAGES=[
  {code:'fr',label:'Français',short:'FR',flag:'🇫🇷'},
  {code:'en',label:'English',short:'EN',flag:'🇬🇧'},
  {code:'de',label:'Deutsch',short:'DE',flag:'🇩🇪'},
  {code:'it',label:'Italiano',short:'IT',flag:'🇮🇹'},
  {code:'es',label:'Español',short:'ES',flag:'🇪🇸'},
  {code:'pt',label:'Português',short:'PT',flag:'🇵🇹'},
] as const;

const COUNTRY_LANGUAGE:Record<string,MarketingLanguage>={
  FR:'fr',MC:'fr',LU:'fr',BE:'fr',CH:'fr',
  DE:'de',AT:'de',LI:'de',
  IT:'it',SM:'it',VA:'it',
  ES:'es',MX:'es',AR:'es',CL:'es',CO:'es',PE:'es',UY:'es',
  PT:'pt',BR:'pt',AO:'pt',MZ:'pt',
  GB:'en',US:'en',CA:'en',AU:'en',NZ:'en',IE:'en',
};
const SUPPORTED=new Set<MarketingLanguage>(MARKETING_LANGUAGES.map((item)=>item.code));

export function normalizeMarketingLanguage(value?:string|null):MarketingLanguage|null{
  const code=(value||'').trim().toLowerCase().split(/[-_]/)[0] as MarketingLanguage;
  return SUPPORTED.has(code)?code:null;
}

export function resolveMarketingLanguage(input:{requested?:string|null;saved?:string|null;locale?:string|null;country?:string|null}):MarketingLanguage{
  return normalizeMarketingLanguage(input.requested)
    ||normalizeMarketingLanguage(input.saved)
    ||COUNTRY_LANGUAGE[(input.country||'').toUpperCase()]
    ||normalizeMarketingLanguage(input.locale)
    ||'en';
}

export const MARKETING_COPY={
  fr:{
    selectors:{currency:'Devise',currencyLong:'Devise et pays',language:'Langue'},
    nav:{features:'Fonctionnalités',how:'Mode d’emploi',pricing:'Tarifs',reviews:'Avis',faq:'FAQ',subscription:'Mon abonnement',login:'Connexion'},
    unavailable:{title:'Service momentanément indisponible dans votre région.',body:'Notre équipe prépare l’accès à KHE Booth dans cette zone. La connexion à un compte existant reste disponible.',login:'Se connecter'},
    hero:{kicker:'KURTIS HYPNOTIC EVENTS PRÉSENTE',title:'Transformez chaque événement en un moment que l’on partage.',subtitle:'Capture, création, cloud et partage avec les invités sont réunis dans KHE Booth.',primary:'Commencer avec KHE Booth',download:'Télécharger l’application',stations:'stations',profile:'profil synchronisé',automation:'automatisation',experience:'KHE EXPERIENCE',capture:'Capturez.\nSynchronisez.\nPartagez.'},
    features:{kicker:'PLATEFORME SAAS',title:'Tout est synchronisé.',intro:'Sélectionnez une rubrique pour découvrir son fonctionnement, ses avantages et l’action recommandée.',items:[
      {title:'CAPTURE',summary:'Photos et vidéos, même hors connexion.',detail:'Capturez vos contenus même lorsque la connexion est instable. Les médias restent disponibles sur la station, puis se synchronisent dès que le réseau revient.',benefits:['Formats photo et vidéo adaptés aux événements','Continuité de service hors connexion','Synchronisation sécurisée avec votre espace KHE'],cta:'Choisir une offre avec Capture'},
      {title:'SHARING',summary:'Galerie cloud accessible depuis une seconde station.',detail:'Séparez la capture et le partage : une station filme pendant qu’une autre permet aux invités de consulter et de recevoir leurs médias.',benefits:['Galerie cloud actualisée rapidement','Expérience fluide avec deux stations','Partage sans interrompre la capture'],cta:'Activer le partage instantané'},
      {title:'STUDIO',summary:'Design, effets et musique.',detail:'Préparez une identité visuelle cohérente pour chaque événement grâce aux cadres, effets, textes et ambiances sonores de votre choix.',benefits:['Modèles réutilisables pour chaque événement','Personnalisation aux couleurs du client','Préparation avant l’arrivée sur le terrain'],cta:'Créer mon expérience Studio'},
      {title:'QR',summary:'Partage sécurisé avec les invités.',detail:'Chaque parcours de partage utilise un accès conçu pour les invités afin de limiter les manipulations et d’accélérer la remise des médias.',benefits:['Accès simple depuis un téléphone','Lien adapté à chaque événement','Partage plus rapide et mieux encadré'],cta:'Découvrir le partage par QR code'},
      {title:'ABONNEMENT',summary:'Paiements et statuts automatisés.',detail:'Choisissez une formule adaptée à votre rythme d’activité et suivez votre abonnement, vos paiements et vos capacités depuis un seul espace.',benefits:['Offres claires selon votre niveau d’activité','Devise et paiement adaptés au marché','Gestion centralisée de l’abonnement'],cta:'Comparer les abonnements'},
      {title:'MARKETING',summary:'Analyses, campagnes et rapports PDF.',detail:'Transformez les données de consultation et de conversion en décisions concrètes afin d’améliorer vos offres et vos campagnes.',benefits:['Indicateurs de visites et de conversion','Segmentation par intention et zone consentie','Rapports utiles au suivi commercial'],cta:'Développer ma visibilité'},
    ]},
    pricing:{kicker:'TARIFS LOCALISÉS',title:'Choisissez votre abonnement.',intro:'Sélectionnez une formule pour afficher ses avantages, puis ajoutez-la au panier.',currency:'Devise',country:'Pays',popular:'POPULAIRE',discount:'OFFRE',custom:'Sur mesure',instead:'au lieu de',free:'Voir l’offre gratuite',quote:'Demander une offre',details:'Voir les détails de l’offre',payments:'Paiements',twint:'Les paiements TWINT sont affichés en CHF.',select:'Sélectionner cette offre',selected:'Offre sélectionnée'},
    reviews:{kicker:'AVIS VÉRIFIÉS',title:'Les clients KHE Booth témoignent.',intro:'La publication est réservée aux abonnés dont le paiement a été vérifié.',empty:'Les premiers avis vérifiés apparaîtront ici.',experience:'Expérience KHE Booth',verified:'Abonné vérifié',leave:'Laisser un avis vérifié'},
    faq:{kicker:'FAQ',title:'Questions fréquentes.',items:[
      {question:'L’abonnement est-il renouvelé automatiquement ?',answer:'Oui, pour les abonnements récurrents compatibles et après votre accord explicite. L’abonnement peut être résilié depuis la rubrique « Mon abonnement ».'},
      {question:'TWINT est-il disponible ?',answer:'TWINT est disponible pour les paiements ponctuels en CHF. Les paiements récurrents avec TWINT nécessitent un contrat marchand compatible.'},
      {question:'Comment la devise est-elle choisie ?',answer:'KHE Booth détecte le pays du visiteur et affiche une devise locale prise en charge. Le client peut ensuite sélectionner manuellement une autre devise.'},
    ]},
    final:{kicker:'PRÊT ?',title:'Activez KHE Booth maintenant.',body:'Découvrez les fonctionnalités, choisissez la formule adaptée à votre activité et préparez votre prochaine expérience événementielle.',choose:'Choisir mon abonnement',download:'Télécharger l’application'},
    footer:{solution:'Une solution de Kurtis Hypnotic Events.',reviews:'Avis'},
    cart:{label:'Panier',emptyLabel:'Panier vide',panel:'Votre panier',title:'VOTRE PANIER',one:'1 offre sélectionnée',none:'Aucune offre sélectionnée',close:'Fermer le panier',note:'Un seul abonnement peut être sélectionné à la fois. Le choix d’une autre offre remplacera la précédente.',checkout:'Continuer vers l’abonnement',remove:'Retirer cette offre',empty:'Comparez les formules et ajoutez celle qui correspond à votre activité.',offers:'Voir les offres',add:'Ajouter au panier',added:'Offre ajoutée',article:'1 article'},
    how:{kicker:'MODE D’EMPLOI VISUEL',title:'Comprenez KHE Booth en quelques secondes.',intro:'Une présentation simple qui montre concrètement ce que vous pourrez réaliser avec l’application.',steps:[
      {kicker:'01 · ACTIVEZ',title:'Associez vos tablettes',text:'Activez une station CAPTURE et une station SHARING avec le code KHE de votre événement.'},
      {kicker:'02 · PERSONNALISEZ',title:'Préparez votre design',text:'Dans Studio, choisissez votre identité, vos textes, vos cadres et votre ambiance visuelle.'},
      {kicker:'03 · CAPTUREZ',title:'Lancez l’expérience',text:'CAPTURE se concentre sur la photo ou la vidéo pendant que SHARING reste disponible pour les invités.'},
      {kicker:'04 · PARTAGEZ',title:'Remettez le souvenir',text:'La galerie, le QR code sécurisé et le cloud transforment la prise de vue en un souvenir immédiatement accessible.'},
    ],design:'Votre design',hidden:'Interface masquée automatiquement',ready:'Souvenir prêt'},
    reel:{aria:'Démonstrations KHE Booth',kicker:'KHE BOOTH EN ACTION',title:'Découvrez l’expérience avant de la télécharger.',intro:'Quatre démonstrations tournent automatiquement dans un ordre différent à chaque visite. Sélectionnez un numéro pour changer de séquence.',sequence:'Voir la séquence',clips:[
      {title:'Un événement. Deux stations. Zéro friction.',subtitle:'CAPTURE filme, SHARING distribue et KHE maintient les deux expériences synchronisées.',badge:'CAPTURE ↔ SHARING'},
      {title:'Votre univers visuel prend vie.',subtitle:'Les cadres, textes, couleurs et éléments graphiques sont préparés dans Studio puis appliqués à la capture.',badge:'STUDIO CRÉATIF'},
      {title:'Le souvenir arrive entre les mains de l’invité.',subtitle:'QR code sécurisé, galerie cloud et partage rapide : moins d’attente, plus d’émotion.',badge:'PARTAGE INVITÉ'},
      {title:'Pilotez l’événement comme une régie.',subtitle:'Clients, abonnements, statistiques et opérations sont réunis dans KHE Booth.',badge:'PILOTAGE KHE'},
    ],typography:'Cadres • typographies • couleurs',souvenir:'Votre souvenir',shareReady:'Prêt à partager',clients:'CLIENTS',shares:'PARTAGES'},
  },
  en:{
    selectors:{currency:'Currency',currencyLong:'Currency and country',language:'Language'},
    nav:{features:'Features',how:'How it works',pricing:'Pricing',reviews:'Reviews',faq:'FAQ',subscription:'My subscription',login:'Sign in'},
    unavailable:{title:'Service is temporarily unavailable in your region.',body:'Our team is preparing KHE Booth access in this area. Existing customers can still sign in.',login:'Sign in'},
    hero:{kicker:'KURTIS HYPNOTIC EVENTS PRESENTS',title:'Turn every event into a moment worth sharing.',subtitle:'Capture, creation, cloud and guest sharing come together in KHE Booth.',primary:'Get started with KHE Booth',download:'Download the app',stations:'stations',profile:'synced profile',automation:'automation',experience:'KHE EXPERIENCE',capture:'Capture.\nSync.\nShare.'},
    features:{kicker:'SAAS PLATFORM',title:'Everything stays in sync.',intro:'Select a topic to explore how it works, its benefits and the recommended next step.',items:[
      {title:'CAPTURE',summary:'Photos and videos, even offline.',detail:'Capture content even when the connection is unstable. Media remains available on the station and syncs when the network returns.',benefits:['Photo and video formats for events','Continuity when offline','Secure sync with your KHE workspace'],cta:'Choose a plan with Capture'},
      {title:'SHARING',summary:'Cloud gallery on a second station.',detail:'Separate capture from sharing: one station records while another lets guests view and receive their media.',benefits:['Quickly updated cloud gallery','Smooth two-station experience','Sharing without interrupting capture'],cta:'Enable instant sharing'},
      {title:'STUDIO',summary:'Design, effects and music.',detail:'Prepare a consistent visual identity for each event with your chosen frames, effects, text and audio.',benefits:['Reusable event templates','Client brand customisation','Preparation before the event'],cta:'Create my Studio experience'},
      {title:'QR',summary:'Secure guest sharing.',detail:'Each sharing journey uses a guest-friendly access flow that reduces handling and speeds up media delivery.',benefits:['Easy access from a phone','Event-specific guest link','Faster, controlled sharing'],cta:'Explore QR sharing'},
      {title:'SUBSCRIPTION',summary:'Automated payments and status.',detail:'Choose a plan that fits your activity and manage subscription status, payments and capacity in one place.',benefits:['Clear plans for every activity level','Market-aware currency and payments','Centralised subscription management'],cta:'Compare subscriptions'},
      {title:'MARKETING',summary:'Analytics, campaigns and PDF reports.',detail:'Turn viewing and conversion data into practical decisions that improve your offers and campaigns.',benefits:['Visit and conversion indicators','Intent and consented location segments','Actionable commercial reports'],cta:'Grow my visibility'},
    ]},
    pricing:{kicker:'LOCAL PRICING',title:'Choose your subscription.',intro:'Select a plan to view its benefits, then add it to your cart.',currency:'Currency',country:'Country',popular:'POPULAR',discount:'OFFER',custom:'Custom',instead:'instead of',free:'View free plan',quote:'Request a quote',details:'View plan details',payments:'Payments',twint:'TWINT payments are displayed in CHF.',select:'Select this plan',selected:'Plan selected'},
    reviews:{kicker:'VERIFIED REVIEWS',title:'KHE Booth customers share their experience.',intro:'Only subscribers with a verified payment can publish a review.',empty:'The first verified reviews will appear here.',experience:'KHE Booth experience',verified:'Verified subscriber',leave:'Leave a verified review'},
    faq:{kicker:'FAQ',title:'Frequently asked questions.',items:[
      {question:'Does the subscription renew automatically?',answer:'Yes, for compatible recurring subscriptions and only after your explicit consent. You can cancel it from “My subscription”.'},
      {question:'Is TWINT available?',answer:'TWINT is available for one-time payments in CHF. Recurring TWINT payments require a compatible merchant agreement.'},
      {question:'How is the currency selected?',answer:'KHE Booth detects the visitor’s country and displays a supported local currency. Customers can then choose another currency manually.'},
    ]},
    final:{kicker:'READY?',title:'Activate KHE Booth now.',body:'Explore the features, choose the plan that fits your business and prepare your next event experience.',choose:'Choose my subscription',download:'Download the app'},
    footer:{solution:'A Kurtis Hypnotic Events solution.',reviews:'Reviews'},
    cart:{label:'Cart',emptyLabel:'Empty cart',panel:'Your cart',title:'YOUR CART',one:'1 plan selected',none:'No plan selected',close:'Close cart',note:'Only one subscription can be selected at a time. Choosing another plan will replace the current one.',checkout:'Continue to subscription',remove:'Remove this plan',empty:'Compare the plans and add the one that fits your activity.',offers:'View plans',add:'Add to cart',added:'Plan added',article:'1 item'},
    how:{kicker:'VISUAL GUIDE',title:'Understand KHE Booth in seconds.',intro:'A simple visual guide showing what you can achieve with the app.',steps:[
      {kicker:'01 · ACTIVATE',title:'Pair your tablets',text:'Activate one CAPTURE station and one SHARING station with your event’s KHE code.'},
      {kicker:'02 · CUSTOMISE',title:'Prepare your design',text:'In Studio, choose your identity, text, frames and visual atmosphere.'},
      {kicker:'03 · CAPTURE',title:'Start the experience',text:'CAPTURE focuses on photos or videos while SHARING remains available to guests.'},
      {kicker:'04 · SHARE',title:'Deliver the memory',text:'The gallery, secure QR code and cloud turn each shot into a memory that is immediately accessible.'},
    ],design:'Your design',hidden:'Interface hidden automatically',ready:'Memory ready'},
    reel:{aria:'KHE Booth demonstrations',kicker:'KHE BOOTH IN ACTION',title:'See the experience before you download it.',intro:'Four demonstrations rotate automatically in a different order on every visit. Select a number to change sequence.',sequence:'View sequence',clips:[
      {title:'One event. Two stations. Zero friction.',subtitle:'CAPTURE records, SHARING delivers and KHE keeps both experiences in sync.',badge:'CAPTURE ↔ SHARING'},
      {title:'Your visual world comes to life.',subtitle:'Frames, text, colours and graphics are prepared in Studio and applied to capture.',badge:'CREATIVE STUDIO'},
      {title:'The memory reaches the guest.',subtitle:'Secure QR code, cloud gallery and fast sharing mean less waiting and more emotion.',badge:'GUEST SHARING'},
      {title:'Run your event like a control room.',subtitle:'Customers, subscriptions, analytics and operations come together in KHE Booth.',badge:'KHE CONTROL'},
    ],typography:'Frames • typography • colours',souvenir:'Your memory',shareReady:'Ready to share',clients:'CUSTOMERS',shares:'SHARES'},
  },
  de:{
    selectors:{currency:'Währung',currencyLong:'Währung und Land',language:'Sprache'},
    nav:{features:'Funktionen',how:'So funktioniert es',pricing:'Preise',reviews:'Bewertungen',faq:'FAQ',subscription:'Mein Abonnement',login:'Anmelden'},
    unavailable:{title:'Der Dienst ist in Ihrer Region vorübergehend nicht verfügbar.',body:'Unser Team bereitet den Zugang zu KHE Booth in dieser Region vor. Bestehende Kunden können sich weiterhin anmelden.',login:'Anmelden'},
    hero:{kicker:'KURTIS HYPNOTIC EVENTS PRÄSENTIERT',title:'Machen Sie jedes Event zu einem Moment, den man gerne teilt.',subtitle:'Aufnahme, Gestaltung, Cloud und Gästefreigabe vereint in KHE Booth.',primary:'Mit KHE Booth starten',download:'App herunterladen',stations:'Stationen',profile:'synchronisiertes Profil',automation:'Automatisierung',experience:'KHE EXPERIENCE',capture:'Aufnehmen.\nSynchronisieren.\nTeilen.'},
    features:{kicker:'SAAS-PLATTFORM',title:'Alles bleibt synchronisiert.',intro:'Wählen Sie einen Bereich, um Funktionsweise, Vorteile und den empfohlenen nächsten Schritt zu entdecken.',items:[
      {title:'CAPTURE',summary:'Fotos und Videos, auch offline.',detail:'Erfassen Sie Inhalte auch bei instabiler Verbindung. Medien bleiben auf der Station verfügbar und werden synchronisiert, sobald das Netzwerk zurück ist.',benefits:['Eventgerechte Foto- und Videoformate','Unterbrechungsfreier Offline-Betrieb','Sichere Synchronisierung mit Ihrem KHE-Bereich'],cta:'Tarif mit Capture wählen'},
      {title:'SHARING',summary:'Cloud-Galerie auf einer zweiten Station.',detail:'Trennen Sie Aufnahme und Freigabe: Eine Station zeichnet auf, während Gäste an einer zweiten ihre Medien ansehen und erhalten.',benefits:['Schnell aktualisierte Cloud-Galerie','Reibungsloses Zwei-Stationen-Erlebnis','Teilen ohne Unterbrechung der Aufnahme'],cta:'Sofortiges Teilen aktivieren'},
      {title:'STUDIO',summary:'Design, Effekte und Musik.',detail:'Bereiten Sie mit Rahmen, Effekten, Texten und Audio eine einheitliche visuelle Identität für jedes Event vor.',benefits:['Wiederverwendbare Eventvorlagen','Anpassung an die Kundenmarke','Vorbereitung vor dem Event'],cta:'Studio-Erlebnis erstellen'},
      {title:'QR',summary:'Sicheres Teilen mit Gästen.',detail:'Ein gastfreundlicher Freigabeprozess reduziert Handgriffe und beschleunigt die Medienbereitstellung.',benefits:['Einfacher Zugriff per Smartphone','Eventspezifischer Gästelink','Schnelleres, kontrolliertes Teilen'],cta:'QR-Freigabe entdecken'},
      {title:'ABONNEMENT',summary:'Automatisierte Zahlungen und Status.',detail:'Wählen Sie einen passenden Tarif und verwalten Sie Status, Zahlungen und Kapazitäten zentral.',benefits:['Klare Tarife für jede Aktivitätsstufe','Marktgerechte Währung und Zahlungen','Zentrale Abonnementverwaltung'],cta:'Abonnements vergleichen'},
      {title:'MARKETING',summary:'Analysen, Kampagnen und PDF-Berichte.',detail:'Nutzen Sie Besuchs- und Konversionsdaten für konkrete Entscheidungen zur Verbesserung Ihrer Angebote und Kampagnen.',benefits:['Besuchs- und Konversionskennzahlen','Segmente nach Absicht und freigegebener Region','Verwertbare Vertriebsberichte'],cta:'Sichtbarkeit steigern'},
    ]},
    pricing:{kicker:'LOKALE PREISE',title:'Wählen Sie Ihr Abonnement.',intro:'Wählen Sie einen Tarif, um seine Vorteile anzuzeigen, und legen Sie ihn dann in den Warenkorb.',currency:'Währung',country:'Land',popular:'BELIEBT',discount:'ANGEBOT',custom:'Individuell',instead:'statt',free:'Kostenlosen Tarif ansehen',quote:'Angebot anfordern',details:'Tarifdetails ansehen',payments:'Zahlungen',twint:'TWINT-Zahlungen werden in CHF angezeigt.',select:'Diesen Tarif auswählen',selected:'Tarif ausgewählt'},
    reviews:{kicker:'VERIFIZIERTE BEWERTUNGEN',title:'KHE Booth-Kunden berichten.',intro:'Nur Abonnenten mit bestätigter Zahlung können eine Bewertung veröffentlichen.',empty:'Die ersten verifizierten Bewertungen erscheinen hier.',experience:'KHE Booth-Erlebnis',verified:'Verifizierter Abonnent',leave:'Verifizierte Bewertung abgeben'},
    faq:{kicker:'FAQ',title:'Häufig gestellte Fragen.',items:[
      {question:'Verlängert sich das Abonnement automatisch?',answer:'Ja, bei kompatiblen wiederkehrenden Abonnements und nur nach Ihrer ausdrücklichen Zustimmung. Sie können es unter „Mein Abonnement“ kündigen.'},
      {question:'Ist TWINT verfügbar?',answer:'TWINT ist für Einmalzahlungen in CHF verfügbar. Wiederkehrende TWINT-Zahlungen erfordern einen kompatiblen Händlervertrag.'},
      {question:'Wie wird die Währung ausgewählt?',answer:'KHE Booth erkennt das Land des Besuchers und zeigt eine unterstützte lokale Währung an. Danach kann eine andere Währung manuell gewählt werden.'},
    ]},
    final:{kicker:'BEREIT?',title:'Aktivieren Sie KHE Booth jetzt.',body:'Entdecken Sie die Funktionen, wählen Sie den passenden Tarif und bereiten Sie Ihr nächstes Event-Erlebnis vor.',choose:'Abonnement wählen',download:'App herunterladen'},
    footer:{solution:'Eine Lösung von Kurtis Hypnotic Events.',reviews:'Bewertungen'},
    cart:{label:'Warenkorb',emptyLabel:'Warenkorb leer',panel:'Ihr Warenkorb',title:'IHR WARENKORB',one:'1 Tarif ausgewählt',none:'Kein Tarif ausgewählt',close:'Warenkorb schließen',note:'Es kann jeweils nur ein Abonnement ausgewählt werden. Ein anderer Tarif ersetzt die aktuelle Auswahl.',checkout:'Weiter zum Abonnement',remove:'Tarif entfernen',empty:'Vergleichen Sie die Tarife und wählen Sie den passenden für Ihre Tätigkeit.',offers:'Tarife ansehen',add:'In den Warenkorb',added:'Tarif hinzugefügt',article:'1 Artikel'},
    how:{kicker:'VISUELLE ANLEITUNG',title:'KHE Booth in wenigen Sekunden verstehen.',intro:'Eine einfache visuelle Anleitung zeigt, was Sie mit der App umsetzen können.',steps:[
      {kicker:'01 · AKTIVIEREN',title:'Tablets verbinden',text:'Aktivieren Sie eine CAPTURE- und eine SHARING-Station mit dem KHE-Code Ihres Events.'},
      {kicker:'02 · GESTALTEN',title:'Design vorbereiten',text:'Wählen Sie in Studio Identität, Texte, Rahmen und visuelle Atmosphäre.'},
      {kicker:'03 · AUFNEHMEN',title:'Erlebnis starten',text:'CAPTURE konzentriert sich auf Fotos oder Videos, während SHARING für Gäste verfügbar bleibt.'},
      {kicker:'04 · TEILEN',title:'Erinnerung übergeben',text:'Galerie, sicherer QR-Code und Cloud machen jede Aufnahme sofort zugänglich.'},
    ],design:'Ihr Design',hidden:'Oberfläche automatisch ausgeblendet',ready:'Erinnerung bereit'},
    reel:{aria:'KHE Booth-Demonstrationen',kicker:'KHE BOOTH IN AKTION',title:'Erleben Sie KHE Booth vor dem Download.',intro:'Vier Demonstrationen wechseln automatisch in unterschiedlicher Reihenfolge. Wählen Sie eine Nummer, um die Sequenz zu ändern.',sequence:'Sequenz anzeigen',clips:[
      {title:'Ein Event. Zwei Stationen. Keine Reibung.',subtitle:'CAPTURE nimmt auf, SHARING verteilt und KHE hält beide Erlebnisse synchron.',badge:'CAPTURE ↔ SHARING'},
      {title:'Ihre visuelle Welt wird lebendig.',subtitle:'Rahmen, Texte, Farben und Grafiken werden in Studio vorbereitet und auf die Aufnahme angewendet.',badge:'KREATIV-STUDIO'},
      {title:'Die Erinnerung erreicht den Gast.',subtitle:'Sicherer QR-Code, Cloud-Galerie und schnelle Freigabe bedeuten weniger Warten und mehr Emotion.',badge:'GÄSTE-FREIGABE'},
      {title:'Steuern Sie Ihr Event wie eine Regie.',subtitle:'Kunden, Abonnements, Analysen und Abläufe sind in KHE Booth vereint.',badge:'KHE-STEUERUNG'},
    ],typography:'Rahmen • Typografie • Farben',souvenir:'Ihre Erinnerung',shareReady:'Bereit zum Teilen',clients:'KUNDEN',shares:'FREIGABEN'},
  },
  it:{
    selectors:{currency:'Valuta',currencyLong:'Valuta e Paese',language:'Lingua'},
    nav:{features:'Funzionalità',how:'Come funziona',pricing:'Prezzi',reviews:'Recensioni',faq:'FAQ',subscription:'Il mio abbonamento',login:'Accedi'},
    unavailable:{title:'Il servizio è temporaneamente non disponibile nella tua area.',body:'Il nostro team sta preparando l’accesso a KHE Booth in questa zona. I clienti esistenti possono comunque accedere.',login:'Accedi'},
    hero:{kicker:'KURTIS HYPNOTIC EVENTS PRESENTA',title:'Trasforma ogni evento in un momento da condividere.',subtitle:'Acquisizione, creazione, cloud e condivisione con gli ospiti riuniti in KHE Booth.',primary:'Inizia con KHE Booth',download:'Scarica l’app',stations:'postazioni',profile:'profilo sincronizzato',automation:'automazione',experience:'KHE EXPERIENCE',capture:'Acquisisci.\nSincronizza.\nCondividi.'},
    features:{kicker:'PIATTAFORMA SAAS',title:'Tutto resta sincronizzato.',intro:'Seleziona un argomento per scoprirne funzionamento, vantaggi e azione consigliata.',items:[
      {title:'CAPTURE',summary:'Foto e video, anche offline.',detail:'Acquisisci contenuti anche con una connessione instabile. I file restano disponibili sulla postazione e si sincronizzano al ritorno della rete.',benefits:['Formati foto e video per eventi','Continuità anche offline','Sincronizzazione sicura con il tuo spazio KHE'],cta:'Scegli un piano con Capture'},
      {title:'SHARING',summary:'Galleria cloud su una seconda postazione.',detail:'Separa acquisizione e condivisione: una postazione registra mentre l’altra consente agli ospiti di vedere e ricevere i propri contenuti.',benefits:['Galleria cloud aggiornata rapidamente','Esperienza fluida su due postazioni','Condivisione senza interrompere l’acquisizione'],cta:'Attiva la condivisione istantanea'},
      {title:'STUDIO',summary:'Design, effetti e musica.',detail:'Prepara un’identità visiva coerente per ogni evento con cornici, effetti, testi e audio.',benefits:['Modelli riutilizzabili','Personalizzazione del marchio cliente','Preparazione prima dell’evento'],cta:'Crea la mia esperienza Studio'},
      {title:'QR',summary:'Condivisione sicura con gli ospiti.',detail:'Un percorso semplice per gli ospiti riduce le operazioni e accelera la consegna dei contenuti.',benefits:['Accesso semplice da smartphone','Link specifico per l’evento','Condivisione più rapida e controllata'],cta:'Scopri la condivisione QR'},
      {title:'ABBONAMENTO',summary:'Pagamenti e stati automatizzati.',detail:'Scegli un piano adatto alla tua attività e gestisci stato, pagamenti e capacità in un unico spazio.',benefits:['Piani chiari per ogni livello di attività','Valuta e pagamenti adatti al mercato','Gestione centralizzata dell’abbonamento'],cta:'Confronta gli abbonamenti'},
      {title:'MARKETING',summary:'Analisi, campagne e report PDF.',detail:'Trasforma i dati di consultazione e conversione in decisioni concrete per migliorare offerte e campagne.',benefits:['Indicatori di visite e conversioni','Segmenti per intenzione e area consentita','Report commerciali utilizzabili'],cta:'Aumenta la mia visibilità'},
    ]},
    pricing:{kicker:'PREZZI LOCALI',title:'Scegli il tuo abbonamento.',intro:'Seleziona un piano per visualizzarne i vantaggi, quindi aggiungilo al carrello.',currency:'Valuta',country:'Paese',popular:'POPOLARE',discount:'OFFERTA',custom:'Su misura',instead:'invece di',free:'Vedi piano gratuito',quote:'Richiedi un preventivo',details:'Vedi dettagli del piano',payments:'Pagamenti',twint:'I pagamenti TWINT sono mostrati in CHF.',select:'Seleziona questo piano',selected:'Piano selezionato'},
    reviews:{kicker:'RECENSIONI VERIFICATE',title:'I clienti KHE Booth raccontano la loro esperienza.',intro:'Solo gli abbonati con pagamento verificato possono pubblicare una recensione.',empty:'Le prime recensioni verificate appariranno qui.',experience:'Esperienza KHE Booth',verified:'Abbonato verificato',leave:'Lascia una recensione verificata'},
    faq:{kicker:'FAQ',title:'Domande frequenti.',items:[
      {question:'L’abbonamento si rinnova automaticamente?',answer:'Sì, per gli abbonamenti ricorrenti compatibili e solo dopo il tuo consenso esplicito. Puoi annullarlo da “Il mio abbonamento”.'},
      {question:'TWINT è disponibile?',answer:'TWINT è disponibile per pagamenti una tantum in CHF. I pagamenti ricorrenti TWINT richiedono un contratto commerciante compatibile.'},
      {question:'Come viene scelta la valuta?',answer:'KHE Booth rileva il Paese del visitatore e mostra una valuta locale supportata. Il cliente può poi sceglierne manualmente un’altra.'},
    ]},
    final:{kicker:'PRONTO?',title:'Attiva KHE Booth ora.',body:'Scopri le funzionalità, scegli il piano adatto alla tua attività e prepara la tua prossima esperienza evento.',choose:'Scegli il mio abbonamento',download:'Scarica l’app'},
    footer:{solution:'Una soluzione di Kurtis Hypnotic Events.',reviews:'Recensioni'},
    cart:{label:'Carrello',emptyLabel:'Carrello vuoto',panel:'Il tuo carrello',title:'IL TUO CARRELLO',one:'1 piano selezionato',none:'Nessun piano selezionato',close:'Chiudi carrello',note:'È possibile selezionare un solo abbonamento alla volta. La scelta di un altro piano sostituirà quello attuale.',checkout:'Continua all’abbonamento',remove:'Rimuovi questo piano',empty:'Confronta i piani e aggiungi quello adatto alla tua attività.',offers:'Vedi piani',add:'Aggiungi al carrello',added:'Piano aggiunto',article:'1 articolo'},
    how:{kicker:'GUIDA VISIVA',title:'Comprendi KHE Booth in pochi secondi.',intro:'Una guida visiva semplice mostra cosa puoi realizzare con l’app.',steps:[
      {kicker:'01 · ATTIVA',title:'Associa i tablet',text:'Attiva una postazione CAPTURE e una SHARING con il codice KHE dell’evento.'},
      {kicker:'02 · PERSONALIZZA',title:'Prepara il design',text:'In Studio scegli identità, testi, cornici e atmosfera visiva.'},
      {kicker:'03 · ACQUISISCI',title:'Avvia l’esperienza',text:'CAPTURE si concentra su foto o video mentre SHARING resta disponibile agli ospiti.'},
      {kicker:'04 · CONDIVIDI',title:'Consegna il ricordo',text:'Galleria, QR sicuro e cloud rendono ogni scatto immediatamente accessibile.'},
    ],design:'Il tuo design',hidden:'Interfaccia nascosta automaticamente',ready:'Ricordo pronto'},
    reel:{aria:'Dimostrazioni KHE Booth',kicker:'KHE BOOTH IN AZIONE',title:'Guarda l’esperienza prima di scaricarla.',intro:'Quattro dimostrazioni ruotano automaticamente in un ordine diverso a ogni visita. Seleziona un numero per cambiare sequenza.',sequence:'Mostra sequenza',clips:[
      {title:'Un evento. Due postazioni. Zero attrito.',subtitle:'CAPTURE registra, SHARING distribuisce e KHE mantiene entrambe le esperienze sincronizzate.',badge:'CAPTURE ↔ SHARING'},
      {title:'Il tuo universo visivo prende vita.',subtitle:'Cornici, testi, colori e grafiche vengono preparati in Studio e applicati all’acquisizione.',badge:'STUDIO CREATIVO'},
      {title:'Il ricordo raggiunge l’ospite.',subtitle:'QR sicuro, galleria cloud e condivisione rapida: meno attesa, più emozione.',badge:'CONDIVISIONE OSPITI'},
      {title:'Gestisci l’evento come una regia.',subtitle:'Clienti, abbonamenti, analisi e operazioni sono riuniti in KHE Booth.',badge:'CONTROLLO KHE'},
    ],typography:'Cornici • tipografie • colori',souvenir:'Il tuo ricordo',shareReady:'Pronto da condividere',clients:'CLIENTI',shares:'CONDIVISIONI'},
  },
  es:{
    selectors:{currency:'Moneda',currencyLong:'Moneda y país',language:'Idioma'},
    nav:{features:'Funciones',how:'Cómo funciona',pricing:'Precios',reviews:'Opiniones',faq:'FAQ',subscription:'Mi suscripción',login:'Iniciar sesión'},
    unavailable:{title:'El servicio no está disponible temporalmente en tu región.',body:'Nuestro equipo está preparando el acceso a KHE Booth en esta zona. Los clientes actuales pueden seguir iniciando sesión.',login:'Iniciar sesión'},
    hero:{kicker:'KURTIS HYPNOTIC EVENTS PRESENTA',title:'Convierte cada evento en un momento para compartir.',subtitle:'Captura, creación, nube y uso compartido con invitados reunidos en KHE Booth.',primary:'Empezar con KHE Booth',download:'Descargar la aplicación',stations:'estaciones',profile:'perfil sincronizado',automation:'automatización',experience:'KHE EXPERIENCE',capture:'Captura.\nSincroniza.\nComparte.'},
    features:{kicker:'PLATAFORMA SAAS',title:'Todo permanece sincronizado.',intro:'Selecciona un tema para conocer su funcionamiento, sus ventajas y el siguiente paso recomendado.',items:[
      {title:'CAPTURE',summary:'Fotos y vídeos, incluso sin conexión.',detail:'Captura contenido aunque la conexión sea inestable. Los archivos permanecen en la estación y se sincronizan cuando vuelve la red.',benefits:['Formatos de foto y vídeo para eventos','Continuidad sin conexión','Sincronización segura con tu espacio KHE'],cta:'Elegir un plan con Capture'},
      {title:'SHARING',summary:'Galería en la nube en una segunda estación.',detail:'Separa captura y entrega: una estación graba mientras otra permite a los invitados ver y recibir sus contenidos.',benefits:['Galería actualizada rápidamente','Experiencia fluida con dos estaciones','Entrega sin interrumpir la captura'],cta:'Activar el uso compartido instantáneo'},
      {title:'STUDIO',summary:'Diseño, efectos y música.',detail:'Prepara una identidad visual coherente para cada evento con marcos, efectos, textos y audio.',benefits:['Plantillas reutilizables','Personalización de marca','Preparación antes del evento'],cta:'Crear mi experiencia Studio'},
      {title:'QR',summary:'Entrega segura para invitados.',detail:'Un recorrido sencillo para invitados reduce las operaciones y acelera la entrega de contenidos.',benefits:['Acceso sencillo desde el móvil','Enlace específico para el evento','Entrega más rápida y controlada'],cta:'Descubrir el uso compartido por QR'},
      {title:'SUSCRIPCIÓN',summary:'Pagos y estados automatizados.',detail:'Elige un plan adaptado a tu actividad y gestiona estado, pagos y capacidad desde un único espacio.',benefits:['Planes claros para cada nivel','Moneda y pagos adaptados al mercado','Gestión centralizada de la suscripción'],cta:'Comparar suscripciones'},
      {title:'MARKETING',summary:'Análisis, campañas e informes PDF.',detail:'Convierte los datos de consulta y conversión en decisiones prácticas para mejorar ofertas y campañas.',benefits:['Indicadores de visitas y conversión','Segmentos por intención y zona consentida','Informes comerciales útiles'],cta:'Aumentar mi visibilidad'},
    ]},
    pricing:{kicker:'PRECIOS LOCALES',title:'Elige tu suscripción.',intro:'Selecciona un plan para ver sus ventajas y después añádelo al carrito.',currency:'Moneda',country:'País',popular:'POPULAR',discount:'OFERTA',custom:'A medida',instead:'en lugar de',free:'Ver plan gratuito',quote:'Solicitar presupuesto',details:'Ver detalles del plan',payments:'Pagos',twint:'Los pagos TWINT se muestran en CHF.',select:'Seleccionar este plan',selected:'Plan seleccionado'},
    reviews:{kicker:'OPINIONES VERIFICADAS',title:'Los clientes de KHE Booth comparten su experiencia.',intro:'Solo los suscriptores con un pago verificado pueden publicar una opinión.',empty:'Las primeras opiniones verificadas aparecerán aquí.',experience:'Experiencia KHE Booth',verified:'Suscriptor verificado',leave:'Dejar una opinión verificada'},
    faq:{kicker:'FAQ',title:'Preguntas frecuentes.',items:[
      {question:'¿La suscripción se renueva automáticamente?',answer:'Sí, para suscripciones recurrentes compatibles y solo tras tu consentimiento explícito. Puedes cancelarla desde “Mi suscripción”.'},
      {question:'¿Está disponible TWINT?',answer:'TWINT está disponible para pagos únicos en CHF. Los pagos recurrentes con TWINT requieren un contrato comercial compatible.'},
      {question:'¿Cómo se elige la moneda?',answer:'KHE Booth detecta el país del visitante y muestra una moneda local compatible. El cliente puede elegir otra moneda manualmente.'},
    ]},
    final:{kicker:'¿LISTO?',title:'Activa KHE Booth ahora.',body:'Descubre las funciones, elige el plan que se adapta a tu actividad y prepara tu próxima experiencia para eventos.',choose:'Elegir mi suscripción',download:'Descargar la aplicación'},
    footer:{solution:'Una solución de Kurtis Hypnotic Events.',reviews:'Opiniones'},
    cart:{label:'Carrito',emptyLabel:'Carrito vacío',panel:'Tu carrito',title:'TU CARRITO',one:'1 plan seleccionado',none:'Ningún plan seleccionado',close:'Cerrar carrito',note:'Solo puede seleccionarse una suscripción a la vez. Al elegir otro plan se sustituirá el actual.',checkout:'Continuar a la suscripción',remove:'Eliminar este plan',empty:'Compara los planes y añade el que se adapte a tu actividad.',offers:'Ver planes',add:'Añadir al carrito',added:'Plan añadido',article:'1 artículo'},
    how:{kicker:'GUÍA VISUAL',title:'Comprende KHE Booth en segundos.',intro:'Una guía visual sencilla muestra lo que puedes hacer con la aplicación.',steps:[
      {kicker:'01 · ACTIVA',title:'Vincula tus tabletas',text:'Activa una estación CAPTURE y otra SHARING con el código KHE del evento.'},
      {kicker:'02 · PERSONALIZA',title:'Prepara tu diseño',text:'En Studio, elige identidad, textos, marcos y ambiente visual.'},
      {kicker:'03 · CAPTURA',title:'Inicia la experiencia',text:'CAPTURE se centra en fotos o vídeos mientras SHARING sigue disponible para los invitados.'},
      {kicker:'04 · COMPARTE',title:'Entrega el recuerdo',text:'La galería, el QR seguro y la nube hacen que cada captura esté disponible al instante.'},
    ],design:'Tu diseño',hidden:'Interfaz oculta automáticamente',ready:'Recuerdo listo'},
    reel:{aria:'Demostraciones de KHE Booth',kicker:'KHE BOOTH EN ACCIÓN',title:'Mira la experiencia antes de descargarla.',intro:'Cuatro demostraciones cambian automáticamente de orden en cada visita. Selecciona un número para cambiar de secuencia.',sequence:'Ver secuencia',clips:[
      {title:'Un evento. Dos estaciones. Cero fricción.',subtitle:'CAPTURE graba, SHARING entrega y KHE mantiene ambas experiencias sincronizadas.',badge:'CAPTURE ↔ SHARING'},
      {title:'Tu universo visual cobra vida.',subtitle:'Marcos, textos, colores y gráficos se preparan en Studio y se aplican a la captura.',badge:'STUDIO CREATIVO'},
      {title:'El recuerdo llega al invitado.',subtitle:'QR seguro, galería en la nube y entrega rápida: menos espera y más emoción.',badge:'ENTREGA A INVITADOS'},
      {title:'Controla el evento como una cabina técnica.',subtitle:'Clientes, suscripciones, análisis y operaciones se reúnen en KHE Booth.',badge:'CONTROL KHE'},
    ],typography:'Marcos • tipografías • colores',souvenir:'Tu recuerdo',shareReady:'Listo para compartir',clients:'CLIENTES',shares:'ENTREGAS'},
  },
  pt:{
    selectors:{currency:'Moeda',currencyLong:'Moeda e país',language:'Idioma'},
    nav:{features:'Funcionalidades',how:'Como funciona',pricing:'Preços',reviews:'Avaliações',faq:'FAQ',subscription:'A minha subscrição',login:'Entrar'},
    unavailable:{title:'O serviço está temporariamente indisponível na sua região.',body:'A nossa equipa está a preparar o acesso ao KHE Booth nesta zona. Os clientes atuais podem continuar a iniciar sessão.',login:'Entrar'},
    hero:{kicker:'KURTIS HYPNOTIC EVENTS APRESENTA',title:'Transforme cada evento num momento para partilhar.',subtitle:'Captação, criação, cloud e partilha com convidados reunidos no KHE Booth.',primary:'Começar com o KHE Booth',download:'Descarregar a aplicação',stations:'estações',profile:'perfil sincronizado',automation:'automatização',experience:'KHE EXPERIENCE',capture:'Capture.\nSincronize.\nPartilhe.'},
    features:{kicker:'PLATAFORMA SAAS',title:'Tudo permanece sincronizado.',intro:'Selecione um tema para conhecer o funcionamento, as vantagens e o próximo passo recomendado.',items:[
      {title:'CAPTURE',summary:'Fotografias e vídeos, mesmo offline.',detail:'Capture conteúdos mesmo com uma ligação instável. Os ficheiros permanecem na estação e sincronizam quando a rede regressa.',benefits:['Formatos de fotografia e vídeo para eventos','Continuidade offline','Sincronização segura com o seu espaço KHE'],cta:'Escolher um plano com Capture'},
      {title:'SHARING',summary:'Galeria cloud numa segunda estação.',detail:'Separe a captação da partilha: uma estação grava enquanto outra permite aos convidados ver e receber os conteúdos.',benefits:['Galeria atualizada rapidamente','Experiência fluida com duas estações','Partilha sem interromper a captação'],cta:'Ativar a partilha instantânea'},
      {title:'STUDIO',summary:'Design, efeitos e música.',detail:'Prepare uma identidade visual coerente para cada evento com molduras, efeitos, textos e áudio.',benefits:['Modelos reutilizáveis','Personalização da marca do cliente','Preparação antes do evento'],cta:'Criar a minha experiência Studio'},
      {title:'QR',summary:'Partilha segura com convidados.',detail:'Um percurso simples para convidados reduz operações e acelera a entrega dos conteúdos.',benefits:['Acesso simples pelo telemóvel','Ligação específica do evento','Partilha mais rápida e controlada'],cta:'Descobrir a partilha por QR'},
      {title:'SUBSCRIÇÃO',summary:'Pagamentos e estados automatizados.',detail:'Escolha um plano adequado à sua atividade e gira estado, pagamentos e capacidade num único espaço.',benefits:['Planos claros para cada nível','Moeda e pagamentos adequados ao mercado','Gestão centralizada da subscrição'],cta:'Comparar subscrições'},
      {title:'MARKETING',summary:'Análises, campanhas e relatórios PDF.',detail:'Transforme dados de consulta e conversão em decisões práticas para melhorar ofertas e campanhas.',benefits:['Indicadores de visitas e conversões','Segmentos por intenção e zona consentida','Relatórios comerciais úteis'],cta:'Aumentar a minha visibilidade'},
    ]},
    pricing:{kicker:'PREÇOS LOCAIS',title:'Escolha a sua subscrição.',intro:'Selecione um plano para ver as vantagens e depois adicione-o ao carrinho.',currency:'Moeda',country:'País',popular:'POPULAR',discount:'OFERTA',custom:'À medida',instead:'em vez de',free:'Ver plano gratuito',quote:'Pedir proposta',details:'Ver detalhes do plano',payments:'Pagamentos',twint:'Os pagamentos TWINT são apresentados em CHF.',select:'Selecionar este plano',selected:'Plano selecionado'},
    reviews:{kicker:'AVALIAÇÕES VERIFICADAS',title:'Os clientes KHE Booth partilham a sua experiência.',intro:'Apenas subscritores com pagamento verificado podem publicar uma avaliação.',empty:'As primeiras avaliações verificadas aparecerão aqui.',experience:'Experiência KHE Booth',verified:'Subscritor verificado',leave:'Deixar uma avaliação verificada'},
    faq:{kicker:'FAQ',title:'Perguntas frequentes.',items:[
      {question:'A subscrição é renovada automaticamente?',answer:'Sim, para subscrições recorrentes compatíveis e apenas após o seu consentimento explícito. Pode cancelá-la em “A minha subscrição”.'},
      {question:'O TWINT está disponível?',answer:'O TWINT está disponível para pagamentos únicos em CHF. Pagamentos recorrentes com TWINT exigem um contrato comercial compatível.'},
      {question:'Como é escolhida a moeda?',answer:'O KHE Booth deteta o país do visitante e apresenta uma moeda local suportada. O cliente pode escolher manualmente outra moeda.'},
    ]},
    final:{kicker:'PRONTO?',title:'Ative o KHE Booth agora.',body:'Descubra as funcionalidades, escolha o plano adequado à sua atividade e prepare a próxima experiência de evento.',choose:'Escolher a minha subscrição',download:'Descarregar a aplicação'},
    footer:{solution:'Uma solução da Kurtis Hypnotic Events.',reviews:'Avaliações'},
    cart:{label:'Carrinho',emptyLabel:'Carrinho vazio',panel:'O seu carrinho',title:'O SEU CARRINHO',one:'1 plano selecionado',none:'Nenhum plano selecionado',close:'Fechar carrinho',note:'Só pode selecionar uma subscrição de cada vez. A escolha de outro plano substituirá o atual.',checkout:'Continuar para a subscrição',remove:'Remover este plano',empty:'Compare os planos e adicione o que corresponde à sua atividade.',offers:'Ver planos',add:'Adicionar ao carrinho',added:'Plano adicionado',article:'1 artigo'},
    how:{kicker:'GUIA VISUAL',title:'Compreenda o KHE Booth em segundos.',intro:'Um guia visual simples mostra o que pode fazer com a aplicação.',steps:[
      {kicker:'01 · ATIVE',title:'Associe os seus tablets',text:'Ative uma estação CAPTURE e uma SHARING com o código KHE do evento.'},
      {kicker:'02 · PERSONALIZE',title:'Prepare o seu design',text:'No Studio, escolha identidade, textos, molduras e ambiente visual.'},
      {kicker:'03 · CAPTURE',title:'Inicie a experiência',text:'CAPTURE concentra-se em fotografias ou vídeos enquanto SHARING permanece disponível para os convidados.'},
      {kicker:'04 · PARTILHE',title:'Entregue a recordação',text:'A galeria, o QR seguro e a cloud tornam cada captação imediatamente acessível.'},
    ],design:'O seu design',hidden:'Interface ocultada automaticamente',ready:'Recordação pronta'},
    reel:{aria:'Demonstrações KHE Booth',kicker:'KHE BOOTH EM AÇÃO',title:'Veja a experiência antes de descarregar.',intro:'Quatro demonstrações rodam automaticamente numa ordem diferente em cada visita. Selecione um número para mudar de sequência.',sequence:'Ver sequência',clips:[
      {title:'Um evento. Duas estações. Zero atrito.',subtitle:'CAPTURE grava, SHARING distribui e KHE mantém as duas experiências sincronizadas.',badge:'CAPTURE ↔ SHARING'},
      {title:'O seu universo visual ganha vida.',subtitle:'Molduras, textos, cores e elementos gráficos são preparados no Studio e aplicados à captação.',badge:'STUDIO CRIATIVO'},
      {title:'A recordação chega ao convidado.',subtitle:'QR seguro, galeria cloud e partilha rápida: menos espera e mais emoção.',badge:'PARTILHA COM CONVIDADOS'},
      {title:'Controle o evento como uma régie.',subtitle:'Clientes, subscrições, análises e operações estão reunidos no KHE Booth.',badge:'CONTROLO KHE'},
    ],typography:'Molduras • tipografias • cores',souvenir:'A sua recordação',shareReady:'Pronto a partilhar',clients:'CLIENTES',shares:'PARTILHAS'},
  },
} as const;

const PLAN_COPY:Record<MarketingLanguage,Record<MarketingPlanCode,{name:string;tagline:string;features:string[]}>>={
  fr:{
    DISCOVERY:{name:'Découverte',tagline:'Découvrez KHE Booth avant de passer à une utilisation connectée.',features:['1 événement actif','CAPTURE locale','Galerie locale','Studio créatif essentiel','Support standard']},
    STARTER:{name:'Starter',tagline:'Pour les indépendants et les petites prestations régulières.',features:['Tout Découverte','CAPTURE + SHARING','Synchronisation cloud','QR invité sécurisé','Jusqu’à 5 événements actifs']},
    PRO:{name:'Pro',tagline:'Pour les professionnels de l’événementiel qui souhaitent exploiter pleinement KHE Booth.',features:['Tout Starter','Événements illimités','Studio créatif complet','Audio et rendus avancés','Image de marque avancée','Support prioritaire Pro']},
    BUSINESS:{name:'Business',tagline:'Pour les agences et les équipes qui gèrent plusieurs clients et opérateurs.',features:['Tout Pro','Utilisateurs multiples','Gestion avancée des clients','Marketing et analyses','Tableaux de bord','Automatisations avancées']},
    ENTERPRISE:{name:'Enterprise',tagline:'Pour les réseaux, franchises, grandes agences et déploiements sur mesure.',features:['Tout Business','Gestion multisite','SLA et support dédié','Intégrations personnalisées','Déploiement sur mesure','Accompagnement commercial']},
  },
  en:{
    DISCOVERY:{name:'Discovery',tagline:'Explore KHE Booth before moving to a connected workflow.',features:['1 active event','Local CAPTURE','Local gallery','Essential creative Studio','Standard support']},
    STARTER:{name:'Starter',tagline:'For independent professionals and small recurring events.',features:['Everything in Discovery','CAPTURE + SHARING','Cloud sync','Secure guest QR','Up to 5 active events']},
    PRO:{name:'Pro',tagline:'For event professionals who want to use the full core power of KHE Booth.',features:['Everything in Starter','Unlimited events','Complete creative Studio','Advanced audio and rendering','Advanced branding','Priority Pro support']},
    BUSINESS:{name:'Business',tagline:'For agencies and teams managing multiple customers and operators.',features:['Everything in Pro','Multiple users','Advanced customer management','Marketing and analytics','Dashboards','Advanced automation']},
    ENTERPRISE:{name:'Enterprise',tagline:'For networks, franchises, major agencies and custom deployments.',features:['Everything in Business','Multi-site management','SLA and dedicated support','Custom integrations','Custom deployment','Commercial onboarding']},
  },
  de:{
    DISCOVERY:{name:'Entdecken',tagline:'Lernen Sie KHE Booth kennen, bevor Sie auf einen vernetzten Betrieb wechseln.',features:['1 aktives Event','Lokale CAPTURE','Lokale Galerie','Grundlegendes Kreativ-Studio','Standard-Support']},
    STARTER:{name:'Starter',tagline:'Für Selbstständige und kleinere regelmäßige Events.',features:['Alles aus Entdecken','CAPTURE + SHARING','Cloud-Synchronisierung','Sicherer Gäste-QR','Bis zu 5 aktive Events']},
    PRO:{name:'Pro',tagline:'Für Eventprofis, die die zentralen Möglichkeiten von KHE Booth voll nutzen möchten.',features:['Alles aus Starter','Unbegrenzte Events','Vollständiges Kreativ-Studio','Erweiterte Audio- und Renderingfunktionen','Erweitertes Branding','Priorisierter Pro-Support']},
    BUSINESS:{name:'Business',tagline:'Für Agenturen und Teams mit mehreren Kunden und Operatoren.',features:['Alles aus Pro','Mehrere Benutzer','Erweiterte Kundenverwaltung','Marketing und Analysen','Dashboards','Erweiterte Automatisierung']},
    ENTERPRISE:{name:'Enterprise',tagline:'Für Netzwerke, Franchise-Systeme, große Agenturen und individuelle Bereitstellungen.',features:['Alles aus Business','Multi-Site-Verwaltung','SLA und eigener Support','Individuelle Integrationen','Individuelle Bereitstellung','Kommerzielle Begleitung']},
  },
  it:{
    DISCOVERY:{name:'Scoperta',tagline:'Scopri KHE Booth prima di passare a un utilizzo connesso.',features:['1 evento attivo','CAPTURE locale','Galleria locale','Studio creativo essenziale','Supporto standard']},
    STARTER:{name:'Starter',tagline:'Per professionisti indipendenti e piccoli eventi ricorrenti.',features:['Tutto Scoperta','CAPTURE + SHARING','Sincronizzazione cloud','QR ospite sicuro','Fino a 5 eventi attivi']},
    PRO:{name:'Pro',tagline:'Per professionisti degli eventi che vogliono sfruttare appieno KHE Booth.',features:['Tutto Starter','Eventi illimitati','Studio creativo completo','Audio e rendering avanzati','Branding avanzato','Supporto prioritario Pro']},
    BUSINESS:{name:'Business',tagline:'Per agenzie e team che gestiscono più clienti e operatori.',features:['Tutto Pro','Utenti multipli','Gestione clienti avanzata','Marketing e analisi','Dashboard','Automazioni avanzate']},
    ENTERPRISE:{name:'Enterprise',tagline:'Per reti, franchising, grandi agenzie e installazioni su misura.',features:['Tutto Business','Gestione multisito','SLA e supporto dedicato','Integrazioni personalizzate','Installazione su misura','Accompagnamento commerciale']},
  },
  es:{
    DISCOVERY:{name:'Descubrimiento',tagline:'Descubre KHE Booth antes de pasar a un uso conectado.',features:['1 evento activo','CAPTURE local','Galería local','Studio creativo esencial','Soporte estándar']},
    STARTER:{name:'Starter',tagline:'Para profesionales independientes y pequeños eventos recurrentes.',features:['Todo Descubrimiento','CAPTURE + SHARING','Sincronización en la nube','QR seguro para invitados','Hasta 5 eventos activos']},
    PRO:{name:'Pro',tagline:'Para profesionales de eventos que quieren aprovechar plenamente KHE Booth.',features:['Todo Starter','Eventos ilimitados','Studio creativo completo','Audio y renderizado avanzados','Marca avanzada','Soporte prioritario Pro']},
    BUSINESS:{name:'Business',tagline:'Para agencias y equipos que gestionan varios clientes y operadores.',features:['Todo Pro','Múltiples usuarios','Gestión avanzada de clientes','Marketing y análisis','Paneles de control','Automatizaciones avanzadas']},
    ENTERPRISE:{name:'Enterprise',tagline:'Para redes, franquicias, grandes agencias y despliegues a medida.',features:['Todo Business','Gestión multisitio','SLA y soporte dedicado','Integraciones personalizadas','Despliegue a medida','Acompañamiento comercial']},
  },
  pt:{
    DISCOVERY:{name:'Descoberta',tagline:'Descubra o KHE Booth antes de passar para uma utilização ligada.',features:['1 evento ativo','CAPTURE local','Galeria local','Studio criativo essencial','Suporte standard']},
    STARTER:{name:'Starter',tagline:'Para profissionais independentes e pequenos eventos recorrentes.',features:['Tudo Descoberta','CAPTURE + SHARING','Sincronização cloud','QR seguro para convidados','Até 5 eventos ativos']},
    PRO:{name:'Pro',tagline:'Para profissionais de eventos que pretendem aproveitar plenamente o KHE Booth.',features:['Tudo Starter','Eventos ilimitados','Studio criativo completo','Áudio e renderização avançados','Imagem de marca avançada','Suporte prioritário Pro']},
    BUSINESS:{name:'Business',tagline:'Para agências e equipas que gerem vários clientes e operadores.',features:['Tudo Pro','Vários utilizadores','Gestão avançada de clientes','Marketing e análises','Painéis de controlo','Automatizações avançadas']},
    ENTERPRISE:{name:'Enterprise',tagline:'Para redes, franchising, grandes agências e implementações à medida.',features:['Tudo Business','Gestão multisite','SLA e suporte dedicado','Integrações personalizadas','Implementação à medida','Acompanhamento comercial']},
  },
};

export function getMarketingCopy(language:MarketingLanguage){return MARKETING_COPY[language];}
export function getMarketingPlan(language:MarketingLanguage,code:string,fallback:{name:string;tagline:string;features:string[]}){
  return PLAN_COPY[language][code.toUpperCase() as MarketingPlanCode]||fallback;
}
