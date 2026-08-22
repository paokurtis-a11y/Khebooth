export type LegalRegion = 'CH' | 'EEA' | 'UK' | 'US' | 'GLOBAL';

export type LegalProfile = {
  region: LegalRegion;
  label: string;
  jurisdictionLabel: string;
  countryCode: string;
  subdivisionCode: string | null;
  frameworks: string[];
  privacyAddendum: string[];
  deletionAddendum: string[];
  termsAddendum: string[];
  revision: string;
  lastReviewed: string;
  exactNationalProfile: boolean;
};

const EEA_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO',
]);

const COUNTRY_NAMES: Record<string,string> = {
  CH:'Suisse',AT:'Autriche',BE:'Belgique',BG:'Bulgarie',HR:'Croatie',CY:'Chypre',CZ:'Tchéquie',DK:'Danemark',EE:'Estonie',FI:'Finlande',FR:'France',DE:'Allemagne',GR:'Grèce',HU:'Hongrie',IE:'Irlande',IT:'Italie',LV:'Lettonie',LT:'Lituanie',LU:'Luxembourg',MT:'Malte',NL:'Pays-Bas',PL:'Pologne',PT:'Portugal',RO:'Roumanie',SK:'Slovaquie',SI:'Slovénie',ES:'Espagne',SE:'Suède',IS:'Islande',LI:'Liechtenstein',NO:'Norvège',GB:'Royaume-Uni',US:'États-Unis',
};

const US_SUBDIVISION_NAMES: Record<string,string> = {
  CA:'Californie',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Floride',IA:'Iowa',IN:'Indiana',KY:'Kentucky',MD:'Maryland',MN:'Minnesota',MT:'Montana',NE:'Nebraska',NH:'New Hampshire',NJ:'New Jersey',OR:'Oregon',RI:'Rhode Island',TN:'Tennessee',TX:'Texas',UT:'Utah',VA:'Virginie',
};

export function normalizeCountryCode(value: string | null | undefined) {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : 'GLOBAL';
}

export function normalizeSubdivisionCode(value: string | null | undefined) {
  const code=String(value??'').trim().toUpperCase();
  return /^[A-Z0-9]{1,3}$/.test(code)?code:null;
}

export function resolveLegalRegion(countryCodeInput: string | null | undefined): LegalRegion {
  const countryCode = normalizeCountryCode(countryCodeInput);
  if (countryCode === 'CH') return 'CH';
  if (countryCode === 'GB') return 'UK';
  if (EEA_COUNTRIES.has(countryCode)) return 'EEA';
  if (countryCode === 'US') return 'US';
  return 'GLOBAL';
}

const PROFILES: Record<LegalRegion, Omit<LegalProfile, 'countryCode'|'subdivisionCode'|'jurisdictionLabel'|'exactNationalProfile'>> = {
  CH: {
    region: 'CH',
    label: 'Suisse',
    frameworks: ['LPD suisse (nLPD) et ordonnances applicables'],
    privacyAddendum: [
      'Pour les personnes concernées en Suisse, KHE Booth applique les principes de transparence, proportionnalité, sécurité et finalité prévus par la législation suisse sur la protection des données. Les demandes d’accès, de rectification et, lorsque les conditions légales sont réunies, de suppression ou de limitation sont traitées conformément au droit suisse applicable.',
      'Lorsque des données sont transférées à des prestataires situés à l’étranger, KHE Booth met en œuvre les garanties contractuelles et techniques appropriées lorsque la législation applicable l’exige.',
    ],
    deletionAddendum: ['En Suisse, les demandes de suppression sont traitées sous réserve des obligations légales de conservation et des intérêts prépondérants reconnus par le droit applicable.'],
    termsAddendum: ['Pour les utilisateurs et organisations établis en Suisse, les dispositions impératives du droit suisse demeurent applicables lorsqu’elles ne peuvent pas être écartées contractuellement.'],
    revision: '2026-08-22.CH.1',
    lastReviewed: '2026-08-22',
  },
  EEA: {
    region: 'EEA',
    label: 'Union européenne / Espace économique européen',
    frameworks: ['RGPD (UE) 2016/679', 'règles nationales complémentaires du pays concerné'],
    privacyAddendum: [
      'Lorsque le RGPD s’applique, le traitement repose selon la fonctionnalité sur l’exécution du contrat, le respect d’une obligation légale, l’intérêt légitime ou le consentement lorsque celui-ci est requis. Les personnes concernées peuvent disposer de droits d’accès, rectification, effacement, limitation, opposition et portabilité, ainsi que du droit d’introduire une réclamation auprès de l’autorité de contrôle compétente.',
      'Lorsque des données personnelles sont transférées hors de l’EEE vers un pays ne bénéficiant pas d’une décision d’adéquation, des garanties appropriées sont mises en place lorsque requises, par exemple des clauses contractuelles types ou un mécanisme légal équivalent.',
    ],
    deletionAddendum: ['Lorsque le RGPD s’applique, une demande d’effacement est évaluée au regard de l’article 17 et des exceptions légales applicables, notamment les obligations de conservation, la défense de droits en justice et certaines exigences de sécurité.'],
    termsAddendum: ['Pour les consommateurs de l’EEE, les droits impératifs de protection des consommateurs du pays de résidence habituelle demeurent applicables lorsqu’ils ne peuvent pas être écartés contractuellement.'],
    revision: '2026-08-22.EEA.1',
    lastReviewed: '2026-08-22',
  },
  UK: {
    region: 'UK',
    label: 'Royaume-Uni',
    frameworks: ['UK GDPR', 'Data Protection Act 2018'],
    privacyAddendum: ['Lorsque le droit britannique de la protection des données s’applique, les personnes concernées disposent des droits prévus par le UK GDPR et le Data Protection Act 2018, sous réserve des conditions et exceptions légales applicables.'],
    deletionAddendum: ['Les demandes d’effacement relevant du droit britannique sont évaluées au regard du UK GDPR et des exceptions prévues par la législation applicable.'],
    termsAddendum: ['Les droits impératifs des consommateurs au Royaume-Uni demeurent applicables lorsqu’ils ne peuvent pas être écartés contractuellement.'],
    revision: '2026-08-22.UK.1',
    lastReviewed: '2026-08-22',
  },
  US: {
    region: 'US',
    label: 'États-Unis',
    frameworks: ['lois fédérales applicables', 'lois de confidentialité de l’État détecté lorsqu’elles sont applicables aux seuils et activités de KHE Booth'],
    privacyAddendum: [
      'Aux États-Unis, les droits de confidentialité varient selon l’État de résidence et selon les seuils d’application de chaque loi. Lorsqu’une loi étatique applicable accorde des droits d’accès, correction, suppression, portabilité ou opposition à certains usages, KHE Booth traite les demandes conformément à cette loi.',
      'KHE Booth ne vend pas les données personnelles à des annonceurs. Si une législation applicable qualifie autrement certains transferts techniques, les mécanismes de choix requis sont proposés lorsqu’ils sont légalement nécessaires.',
    ],
    deletionAddendum: ['Les droits de suppression varient selon l’État et peuvent comporter des exceptions, notamment pour la sécurité, la prévention de la fraude, la tenue de registres et le respect d’obligations légales.'],
    termsAddendum: ['Les droits impératifs applicables dans l’État de résidence ou d’établissement de l’utilisateur demeurent applicables lorsqu’ils ne peuvent pas être écartés contractuellement.'],
    revision: '2026-08-22.US.1',
    lastReviewed: '2026-08-22',
  },
  GLOBAL: {
    region: 'GLOBAL',
    label: 'Version internationale',
    frameworks: ['lois impératives applicables dans le pays de l’utilisateur ou de l’organisation'],
    privacyAddendum: ['Lorsque des règles locales de protection des données s’appliquent, KHE Booth applique les droits et obligations impératifs correspondants dans la mesure où ils sont applicables au service et à l’utilisateur concerné.'],
    deletionAddendum: ['Les demandes de suppression sont traitées conformément aux règles impératives applicables dans la juridiction concernée, sous réserve des obligations légales de conservation et de sécurité.'],
    termsAddendum: ['Les dispositions impératives de la juridiction applicable demeurent applicables lorsqu’elles ne peuvent pas être écartées contractuellement.'],
    revision: '2026-08-22.GLOBAL.1',
    lastReviewed: '2026-08-22',
  },
};

export function legalProfileForLocation(countryInput: string | null | undefined, subdivisionInput?: string | null): LegalProfile {
  const countryCode=normalizeCountryCode(countryInput);
  const subdivisionCode=normalizeSubdivisionCode(subdivisionInput);
  const region=resolveLegalRegion(countryCode);
  const countryName=COUNTRY_NAMES[countryCode]??(countryCode==='GLOBAL'?'Localisation non déterminée':countryCode);
  const subdivisionName=countryCode==='US'&&subdivisionCode?(US_SUBDIVISION_NAMES[subdivisionCode]??subdivisionCode):subdivisionCode;
  const jurisdictionLabel=subdivisionName?`${countryName} — ${subdivisionName}`:countryName;
  const exactNationalProfile=region!=='GLOBAL';
  return {...PROFILES[region],countryCode,subdivisionCode,jurisdictionLabel,exactNationalProfile};
}

export function legalProfileForCountry(countryInput: string | null | undefined): LegalProfile {
  return legalProfileForLocation(countryInput,null);
}
