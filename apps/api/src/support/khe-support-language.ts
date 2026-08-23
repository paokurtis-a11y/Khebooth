export type SupportLanguage = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';

type Topic =
  | 'activation'
  | 'camera'
  | 'sharing'
  | 'sync'
  | 'offline'
  | 'remote'
  | 'print'
  | 'login'
  | 'billing'
  | 'enterprise'
  | 'crm'
  | 'notifications'
  | 'security'
  | 'urgent'
  | 'agent';

const LANGUAGE_MARKERS: Record<SupportLanguage, string[]> = {
  fr: ['bonjour', 'comment', 'mon ', 'ma ', 'mes ', 'avec', 'pour ', 'problème', 'probleme', 'tablette', 'mot de passe', 'facture', 'je ', 'ne '],
  en: ['hello', 'how ', 'my ', 'with ', 'please', 'problem', 'tablet', 'password', 'invoice', 'i ', 'cannot', "can't", "doesn't"],
  de: ['hallo', 'wie ', 'mein', 'meine', 'mit ', 'bitte', 'problem', 'tablet', 'passwort', 'rechnung', 'nicht', 'kann ', 'ich '],
  it: ['ciao', 'come ', 'mio', 'mia ', 'con ', 'per favore', 'problema', 'tablet', 'password', 'fattura', 'non ', 'posso', 'io '],
  es: ['hola', 'cómo', 'como ', 'mi ', 'con ', 'por favor', 'problema', 'tableta', 'contraseña', 'factura', 'no ', 'puedo', 'quiero'],
  pt: ['olá', 'ola ', 'como ', 'meu', 'minha', 'com ', 'por favor', 'problema', 'tablet', 'palavra-passe', 'senha', 'fatura', 'não', 'nao ', 'posso'],
};

const TOPIC_WORDS: Record<Topic, string[]> = {
  activation: ['activation', 'activer', 'activate', 'aktivieren', 'attivare', 'attivazione', 'activar', 'ativar', 'ativação', 'code station', 'station code'],
  camera: ['camera', 'caméra', 'kamera', 'fotocamera', 'cámara', 'câmara', 'photo', 'foto', 'video', 'vidéo', 'microphone', 'microfono', 'micrófono', 'microfone', 'capture'],
  sharing: ['sharing', 'partage', 'teilen', 'condividere', 'condivisione', 'compartir', 'partilhar', 'zweites tablet', 'second tablet', 'deuxième tablette', 'segunda tableta', 'segundo tablet'],
  sync: ['synchronisation', 'synchroniser', 'synchronize', 'synchronization', 'synchronisieren', 'sincronizzare', 'sincronizzazione', 'sincronizar', 'sincronização', 'sync', 'upload', 'media missing', 'média manquant'],
  offline: ['hors ligne', 'offline', 'kein internet', 'senza internet', 'sin internet', 'sem internet', 'réseau', 'network', 'netzwerk', 'rete', 'red ', 'rede '],
  remote: ['remote', 'distance', 'à distance', 'fernbedien', 'remoto', 'remota', 'approuver', 'approve', 'genehmigen', 'approvare', 'aprobar', 'aprovar'],
  print: ['imprimer', 'impression', 'print', 'printer', 'drucken', 'drucker', 'stampare', 'stampante', 'imprimir', 'impresora', 'impressora'],
  login: ['mot de passe', 'password', 'passwort', 'contraseña', 'palavra-passe', 'senha', 'connexion', 'login', 'anmelden', 'accesso', 'iniciar sesión', 'iniciar sessao', 'compte', 'account', 'konto', 'cuenta', 'conta', 'username'],
  billing: ['abonnement', 'subscription', 'billing', 'facture', 'invoice', 'rechnung', 'abbonamento', 'fattura', 'suscripción', 'factura', 'subscrição', 'fatura', 'paiement', 'payment', 'pagamento'],
  enterprise: ['enterprise', 'kyc', 'identité', 'identite', 'identity', 'identität', 'identita', 'identidad', 'identidade', 'onboarding', 'verification', 'vérification'],
  crm: ['crm', 'marketing', 'newsletter', 'client', 'customer', 'kunde', 'cliente', 'consentement', 'consent', 'einwilligung', 'consenso', 'consentimiento'],
  notifications: ['notification', 'notifications', 'cloche', 'bell', 'glocke', 'campanella', 'campana', 'sino', 'vibration', 'vibrazione', 'vibración', 'vibração', 'mise à jour', 'update'],
  security: ['sécurité', 'securite', 'security', 'sicherheit', 'sicurezza', 'seguridad', 'segurança', 'privacy', 'confidentialité', 'datenschutz', 'privacidad', 'privacidade', 'carte bancaire', 'credit card'],
  urgent: ['urgent', 'urgence', 'event running', 'live event', 'événement en cours', 'evento in corso', 'evento en curso', 'evento em curso', 'veranstaltung läuft', 'blocked now', 'bloqué maintenant'],
  agent: ['agent', 'humain', 'humaine', 'human', 'person', 'personne', 'mensch', 'berater', 'consulente', 'agente', 'humano', 'humana', 'pessoa', 'technicien', 'technician', 'techniker', 'tecnico', 'técnico', 'support'],
};

const ANSWERS: Record<SupportLanguage, Record<Topic | 'fallback', string>> = {
  fr: {
    activation: "Pour activer une station KHE Booth, ouvre l’événement dans le portail, génère un code d’activation puis saisis-le sur la tablette Capture ou Sharing. Vérifie qu’il n’est ni expiré ni déjà utilisé.",
    camera: "Vérifie d’abord les autorisations Caméra et Microphone de KHE Booth, puis relance le mode Capture. Si l’image reste noire, ferme et rouvre Capture après avoir confirmé les autorisations de l’appareil.",
    sharing: "La tablette Sharing doit rejoindre le même événement en mode SHARING. Vérifie que sa connexion a été approuvée ; les médias synchronisés apparaîtront ensuite dans la galerie de partage.",
    sync: "Si un média manque, garde la tablette Capture ouverte et connectée puis vérifie la file de synchronisation. Ne supprime pas l’application ni ses données avant confirmation du transfert.",
    offline: "KHE Booth peut continuer à capturer hors ligne. Lorsque Internet revient, laisse l’application ouverte afin de terminer les transferts et conserve les données locales jusqu’à confirmation de synchronisation.",
    remote: "Pour connecter ou piloter une seconde station, ouvre l’événement et approuve uniquement la demande de la tablette attendue. Les commandes à distance restent limitées à l’événement et à l’organisation concernés.",
    print: "Pour imprimer une photo, ouvre-la dans la galerie puis utilise l’action Imprimer. Vérifie que l’imprimante est déjà configurée et accessible depuis la tablette.",
    login: "Connecte-toi avec ton e-mail ou ton nom d’utilisateur KHE et ton mot de passe. Utilise « Mot de passe oublié » si nécessaire et ne communique jamais ton mot de passe au support.",
    billing: "Pour l’abonnement ou la facturation, ouvre Abonnement & facturation. Si un paiement est débité sans mise à jour de l’accès, transmets la conversation à un agent avec la date du paiement, sans numéro de carte.",
    enterprise: "Pour Enterprise, utilise le parcours sécurisé d’identification ou de revérification. Si le dossier reste bloqué après envoi, un agent KHE peut vérifier son statut sans te demander ton mot de passe.",
    crm: "Le CRM KHE conserve les informations utiles au suivi. Les e-mails marketing nécessitent un consentement enregistré et comportent un mécanisme de désabonnement.",
    notifications: "Les nouveautés et réponses support apparaissent dans les notifications. Tu peux régler les catégories, le son et la vibration dans Paramètres.",
    security: "Ne communique jamais ton mot de passe, un code sensible ou les données complètes d’une carte bancaire dans la messagerie. Le support peut diagnostiquer ton compte sans ces informations.",
    urgent: "Si l’événement est en cours, protège d’abord les médias capturés : ne désinstalle pas l’application et ne vide pas ses données. Vérifie alimentation, autorisations, réseau et synchronisation puis demande un agent si nécessaire.",
    agent: "Je peux transférer cette conversation à un agent KHE. L’historique restera attaché au ticket afin que tu n’aies pas à répéter le problème.",
    fallback: "Je n’ai pas encore une réponse assez fiable pour cette demande. Je peux transmettre la conversation à un agent KHE avec le contexte déjà fourni.",
  },
  en: {
    activation: 'To activate a KHE Booth station, open the event in the portal, generate an activation code and enter it on the Capture or Sharing tablet. Make sure it has not expired or already been used.',
    camera: 'Check KHE Booth Camera and Microphone permissions first, then restart Capture mode. If the image stays black, close and reopen Capture after confirming device permissions.',
    sharing: 'The Sharing tablet must join the same event in SHARING mode. Confirm that its connection has been approved; synchronized media will then appear in the sharing gallery.',
    sync: 'If media is missing, keep the Capture tablet open and connected and check the synchronization queue. Do not remove the app or its data before the transfer is confirmed.',
    offline: 'KHE Booth can keep capturing offline. When Internet returns, keep the app open so transfers can finish and keep local data until synchronization is confirmed.',
    remote: 'To connect or control a second station, open the event and approve only the expected tablet request. Remote commands remain limited to the relevant event and organization.',
    print: 'To print a photo, open it in the gallery and use Print. Make sure the printer is already configured and reachable from the tablet.',
    login: 'Sign in with your KHE email or username and password. Use “Forgot password” if needed, and never share your password with support.',
    billing: 'For subscriptions or billing, open Subscription & billing. If a payment was charged but access did not update, send the payment date to a KHE agent without sharing card details.',
    enterprise: 'For Enterprise, use the secure identity or re-verification flow. If the case remains blocked after submission, a KHE agent can check its status without asking for your password.',
    crm: 'KHE CRM stores the client information needed for follow-up. Marketing emails require recorded consent and include an unsubscribe mechanism.',
    notifications: 'Product news and support replies appear in Notifications. You can adjust categories, sound and vibration in Settings.',
    security: 'Never send your password, sensitive activation codes or full payment-card details in chat. Support can diagnose the account without that information.',
    urgent: 'If the event is live, protect captured media first: do not uninstall the app or clear its data. Check power, permissions, network and synchronization, then request an agent if needed.',
    agent: 'I can transfer this conversation to a KHE agent. The full history will remain attached to the ticket so you do not have to repeat the issue.',
    fallback: 'I do not yet have a reliable enough answer for this request. I can transfer the conversation to a KHE agent with the context already provided.',
  },
  de: {
    activation: 'Um eine KHE-Booth-Station zu aktivieren, öffne das Event im Portal, erstelle einen Aktivierungscode und gib ihn auf dem Capture- oder Sharing-Tablet ein. Prüfe, ob der Code noch gültig und unbenutzt ist.',
    camera: 'Prüfe zuerst die Kamera- und Mikrofonberechtigungen von KHE Booth und starte Capture neu. Bleibt das Bild schwarz, schließe und öffne Capture nach Bestätigung der Geräteberechtigungen erneut.',
    sharing: 'Das Sharing-Tablet muss demselben Event im SHARING-Modus beitreten. Prüfe, ob die Verbindung genehmigt wurde; synchronisierte Medien erscheinen danach in der Galerie.',
    sync: 'Fehlen Medien, lass das Capture-Tablet geöffnet und verbunden und prüfe die Synchronisierungswarteschlange. Lösche App oder Daten nicht, bevor der Transfer bestätigt ist.',
    offline: 'KHE Booth kann offline weiter aufnehmen. Sobald Internet wieder verfügbar ist, lass die App geöffnet, damit Übertragungen abgeschlossen werden, und behalte lokale Daten bis zur Bestätigung.',
    remote: 'Öffne zum Verbinden oder Steuern einer zweiten Station das Event und genehmige nur die erwartete Tablet-Anfrage. Fernbefehle bleiben auf Event und Organisation beschränkt.',
    print: 'Öffne das Foto in der Galerie und wähle Drucken. Stelle sicher, dass der Drucker bereits eingerichtet und vom Tablet aus erreichbar ist.',
    login: 'Melde dich mit deiner KHE-E-Mail oder deinem Benutzernamen und Passwort an. Nutze bei Bedarf „Passwort vergessen“ und teile dein Passwort niemals mit dem Support.',
    billing: 'Öffne für Abonnement oder Abrechnung den Bereich Abonnement & Abrechnung. Wurde eine Zahlung belastet, ohne dass der Zugriff aktualisiert wurde, nenne einem KHE-Agenten das Zahlungsdatum, aber keine Kartendaten.',
    enterprise: 'Nutze für Enterprise den sicheren Identitäts- oder erneuten Verifizierungsprozess. Bleibt der Vorgang blockiert, kann ein KHE-Agent den Status prüfen, ohne nach deinem Passwort zu fragen.',
    crm: 'Das KHE CRM speichert die für die Betreuung erforderlichen Kundendaten. Marketing-E-Mails benötigen eine dokumentierte Einwilligung und enthalten eine Abmeldemöglichkeit.',
    notifications: 'Produktneuigkeiten und Support-Antworten erscheinen unter Benachrichtigungen. Kategorien, Ton und Vibration lassen sich in den Einstellungen anpassen.',
    security: 'Sende niemals dein Passwort, sensible Aktivierungscodes oder vollständige Kartendaten im Chat. Der Support kann das Konto ohne diese Angaben prüfen.',
    urgent: 'Bei einem laufenden Event sichere zuerst die aufgenommenen Medien: App nicht deinstallieren und Daten nicht löschen. Prüfe Strom, Berechtigungen, Netzwerk und Synchronisierung und fordere bei Bedarf einen Agenten an.',
    agent: 'Ich kann diese Unterhaltung an einen KHE-Agenten übergeben. Der gesamte Verlauf bleibt am Ticket, damit du das Problem nicht wiederholen musst.',
    fallback: 'Für diese Anfrage habe ich noch keine ausreichend zuverlässige Antwort. Ich kann die Unterhaltung mit dem bisherigen Kontext an einen KHE-Agenten übergeben.',
  },
  it: {
    activation: 'Per attivare una stazione KHE Booth, apri l’evento nel portale, genera un codice di attivazione e inseriscilo sul tablet Capture o Sharing. Verifica che non sia scaduto o già utilizzato.',
    camera: 'Controlla prima le autorizzazioni Fotocamera e Microfono di KHE Booth, quindi riavvia la modalità Capture. Se l’immagine resta nera, chiudi e riapri Capture dopo aver confermato le autorizzazioni.',
    sharing: 'Il tablet Sharing deve entrare nello stesso evento in modalità SHARING. Verifica che la connessione sia stata approvata; i media sincronizzati appariranno poi nella galleria.',
    sync: 'Se manca un media, lascia aperto e connesso il tablet Capture e controlla la coda di sincronizzazione. Non eliminare l’app o i suoi dati prima della conferma del trasferimento.',
    offline: 'KHE Booth può continuare a catturare offline. Quando Internet torna disponibile, lascia aperta l’app per completare i trasferimenti e conserva i dati locali fino alla conferma.',
    remote: 'Per collegare o controllare una seconda stazione, apri l’evento e approva solo la richiesta del tablet previsto. I comandi remoti restano limitati all’evento e all’organizzazione interessati.',
    print: 'Per stampare una foto, aprila nella galleria e usa Stampa. Verifica che la stampante sia già configurata e raggiungibile dal tablet.',
    login: 'Accedi con e-mail o nome utente KHE e password. Usa “Password dimenticata” se necessario e non condividere mai la password con il supporto.',
    billing: 'Per abbonamento o fatturazione, apri Abbonamento & fatturazione. Se un pagamento è stato addebitato ma l’accesso non si aggiorna, comunica a un agente KHE la data del pagamento senza dati della carta.',
    enterprise: 'Per Enterprise, usa il percorso sicuro di identificazione o riverifica. Se la pratica resta bloccata dopo l’invio, un agente KHE può controllarne lo stato senza chiedere la password.',
    crm: 'Il CRM KHE conserva le informazioni cliente necessarie al follow-up. Le e-mail marketing richiedono un consenso registrato e includono la possibilità di disiscrizione.',
    notifications: 'Novità prodotto e risposte del supporto appaiono nelle Notifiche. Puoi regolare categorie, suono e vibrazione nelle Impostazioni.',
    security: 'Non inviare mai password, codici di attivazione sensibili o dati completi della carta nella chat. Il supporto può diagnosticare l’account senza queste informazioni.',
    urgent: 'Se l’evento è in corso, proteggi prima i media catturati: non disinstallare l’app e non cancellarne i dati. Controlla alimentazione, autorizzazioni, rete e sincronizzazione, poi richiedi un agente se serve.',
    agent: 'Posso trasferire questa conversazione a un agente KHE. La cronologia resterà collegata al ticket, così non dovrai ripetere il problema.',
    fallback: 'Non ho ancora una risposta abbastanza affidabile per questa richiesta. Posso trasferire la conversazione a un agente KHE con il contesto già fornito.',
  },
  es: {
    activation: 'Para activar una estación KHE Booth, abre el evento en el portal, genera un código de activación e introdúcelo en la tableta Capture o Sharing. Comprueba que no haya caducado ni se haya usado ya.',
    camera: 'Comprueba primero los permisos de Cámara y Micrófono de KHE Booth y reinicia Capture. Si la imagen sigue negra, cierra y vuelve a abrir Capture después de confirmar los permisos del dispositivo.',
    sharing: 'La tableta Sharing debe unirse al mismo evento en modo SHARING. Comprueba que su conexión esté aprobada; los medios sincronizados aparecerán después en la galería.',
    sync: 'Si falta un medio, mantén abierta y conectada la tableta Capture y revisa la cola de sincronización. No elimines la app ni sus datos antes de confirmar la transferencia.',
    offline: 'KHE Booth puede seguir capturando sin conexión. Cuando vuelva Internet, mantén la app abierta para completar las transferencias y conserva los datos locales hasta confirmar la sincronización.',
    remote: 'Para conectar o controlar una segunda estación, abre el evento y aprueba solo la solicitud de la tableta esperada. Los comandos remotos quedan limitados al evento y la organización correspondientes.',
    print: 'Para imprimir una foto, ábrela en la galería y usa Imprimir. Comprueba que la impresora ya esté configurada y accesible desde la tableta.',
    login: 'Inicia sesión con tu correo o nombre de usuario KHE y contraseña. Usa “Contraseña olvidada” si hace falta y nunca compartas tu contraseña con soporte.',
    billing: 'Para suscripción o facturación, abre Suscripción & facturación. Si se cobró un pago pero el acceso no se actualizó, indica a un agente KHE la fecha del pago sin compartir datos de la tarjeta.',
    enterprise: 'Para Enterprise, utiliza el flujo seguro de identificación o reverificación. Si el expediente sigue bloqueado, un agente KHE puede comprobar su estado sin pedirte la contraseña.',
    crm: 'El CRM de KHE conserva la información del cliente necesaria para el seguimiento. Los correos de marketing requieren consentimiento registrado e incluyen un mecanismo de baja.',
    notifications: 'Las novedades y respuestas de soporte aparecen en Notificaciones. Puedes ajustar categorías, sonido y vibración en Configuración.',
    security: 'No envíes nunca tu contraseña, códigos de activación sensibles ni datos completos de una tarjeta en el chat. Soporte puede diagnosticar la cuenta sin esa información.',
    urgent: 'Si el evento está en curso, protege primero los medios capturados: no desinstales la app ni borres sus datos. Comprueba alimentación, permisos, red y sincronización y solicita un agente si es necesario.',
    agent: 'Puedo transferir esta conversación a un agente KHE. El historial completo seguirá asociado al ticket para que no tengas que repetir el problema.',
    fallback: 'Todavía no tengo una respuesta suficientemente fiable para esta solicitud. Puedo transferir la conversación a un agente KHE con el contexto ya proporcionado.',
  },
  pt: {
    activation: 'Para ativar uma estação KHE Booth, abra o evento no portal, gere um código de ativação e introduza-o no tablet Capture ou Sharing. Confirme que não expirou nem foi utilizado.',
    camera: 'Verifique primeiro as permissões de Câmara e Microfone do KHE Booth e reinicie o modo Capture. Se a imagem continuar preta, feche e volte a abrir Capture depois de confirmar as permissões.',
    sharing: 'O tablet Sharing deve entrar no mesmo evento em modo SHARING. Confirme que a ligação foi aprovada; os conteúdos sincronizados aparecerão depois na galeria.',
    sync: 'Se faltar um conteúdo, mantenha o tablet Capture aberto e ligado e verifique a fila de sincronização. Não elimine a app nem os respetivos dados antes da confirmação da transferência.',
    offline: 'O KHE Booth pode continuar a captar offline. Quando a Internet voltar, mantenha a app aberta para terminar as transferências e conserve os dados locais até confirmar a sincronização.',
    remote: 'Para ligar ou controlar uma segunda estação, abra o evento e aprove apenas o pedido do tablet esperado. Os comandos remotos ficam limitados ao evento e à organização correspondentes.',
    print: 'Para imprimir uma fotografia, abra-a na galeria e use Imprimir. Confirme que a impressora já está configurada e acessível a partir do tablet.',
    login: 'Inicie sessão com o e-mail ou nome de utilizador KHE e a palavra-passe. Use “Esqueci a palavra-passe” se necessário e nunca partilhe a palavra-passe com o suporte.',
    billing: 'Para subscrição ou faturação, abra Subscrição & faturação. Se um pagamento foi debitado sem atualização do acesso, informe um agente KHE da data do pagamento sem fornecer dados do cartão.',
    enterprise: 'Para Enterprise, utilize o fluxo seguro de identificação ou reverificação. Se o processo continuar bloqueado, um agente KHE pode verificar o estado sem pedir a sua palavra-passe.',
    crm: 'O CRM KHE guarda as informações de cliente necessárias ao acompanhamento. Os e-mails de marketing exigem consentimento registado e incluem uma opção de cancelamento.',
    notifications: 'As novidades e respostas do suporte aparecem nas Notificações. Pode ajustar categorias, som e vibração nas Definições.',
    security: 'Nunca envie a palavra-passe, códigos de ativação sensíveis ou dados completos do cartão no chat. O suporte consegue diagnosticar a conta sem essas informações.',
    urgent: 'Se o evento estiver em curso, proteja primeiro os conteúdos captados: não desinstale a app nem apague os dados. Verifique alimentação, permissões, rede e sincronização e peça um agente se necessário.',
    agent: 'Posso transferir esta conversa para um agente KHE. Todo o histórico continuará associado ao ticket para não ter de repetir o problema.',
    fallback: 'Ainda não tenho uma resposta suficientemente fiável para este pedido. Posso transferir a conversa para um agente KHE com o contexto já fornecido.',
  },
};

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function detectSupportLanguage(question: string): SupportLanguage {
  const raw = question.toLowerCase();
  const q = normalize(question);
  const scores = (Object.keys(LANGUAGE_MARKERS) as SupportLanguage[]).map((language) => ({
    language,
    score: LANGUAGE_MARKERS[language].reduce((total, marker) => total + (q.includes(normalize(marker)) ? 1 : 0), 0),
  }));
  if (/[äöüß]/i.test(raw)) scores.find((item) => item.language === 'de')!.score += 2;
  if (/[¿¡ñ]/i.test(raw)) scores.find((item) => item.language === 'es')!.score += 2;
  if (/[ãõ]/i.test(raw)) scores.find((item) => item.language === 'pt')!.score += 2;
  const best = scores.sort((a, b) => b.score - a.score)[0];
  return best.score > 0 ? best.language : 'fr';
}

export function wantsHumanAgent(question: string) {
  const q = normalize(question);
  return TOPIC_WORDS.agent.some((word) => q.includes(normalize(word)));
}

export function kheSupportAnswer(question: string): { answer: string; confident: boolean; language: SupportLanguage } {
  const language = detectSupportLanguage(question);
  const q = normalize(question);
  let best: { topic: Topic; score: number } | null = null;
  for (const topic of Object.keys(TOPIC_WORDS) as Topic[]) {
    const score = TOPIC_WORDS[topic].reduce((total, word) => total + (q.includes(normalize(word)) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  if (best) return { answer: ANSWERS[language][best.topic], confident: true, language };
  return { answer: ANSWERS[language].fallback, confident: false, language };
}
