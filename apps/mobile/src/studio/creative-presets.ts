import type { CreativePlan, DesignTemplate } from './creative-studio';

export type CreativePresetCategory = 'SIGNATURE' | 'MARIAGE' | 'FETE' | 'GALA' | 'ENTREPRISE' | 'DOUX';

export interface CreativePreset {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  category: CreativePresetCategory;
  accent: string;
  secondary: string;
  backdrop: string;
  intensity: 'DOUX' | 'ÉQUILIBRÉ' | 'ÉNERGIQUE';
  effects: string[];
  plan: {
    template: DesignTemplate;
    title: string;
    subtitle: string;
    frameStyle: CreativePlan['frameStyle'];
    textPosition: CreativePlan['textPosition'];
    textStartSeconds: number;
    textEndSeconds: number | null;
    speed: CreativePlan['speed'];
    boomerang: boolean;
    reverse: boolean;
    freezeFrame: boolean;
    colorEffect: CreativePlan['colorEffect'];
  };
}

export const CREATIVE_PRESETS: CreativePreset[] = [
  {
    id: 'khe-gold-cinematic', name: 'KHE Gold Cinematic', eyebrow: 'SIGNATURE KHE', category: 'SIGNATURE',
    description: 'Un rendu premium doré, fluide et immédiatement reconnaissable.',
    accent: '#e7bf55', secondary: '#8b1720', backdrop: '#17130b', intensity: 'ÉQUILIBRÉ',
    effects: ['Ralenti 0,75×', 'Or cinématique', 'Freeze final'],
    plan: { template: 'CUSTOM', title: 'Votre moment KHE', subtitle: 'Élégance en mouvement', frameStyle: 'GOLD', textPosition: 'BOTTOM', textStartSeconds: .4, textEndSeconds: 6, speed: '0.75x', boomerang: false, reverse: false, freezeFrame: true, colorEffect: 'GOLD' },
  },
  {
    id: 'afro-energy-360', name: 'Afro Energy 360', eyebrow: 'RYTHME & ÉNERGIE', category: 'FETE',
    description: 'Couleurs vibrantes et mouvement aller-retour pour les soirées afro.',
    accent: '#ffbf35', secondary: '#df3b20', backdrop: '#241008', intensity: 'ÉNERGIQUE',
    effects: ['Vitesse 1,25×', 'Boomerang', 'Couleurs Party'],
    plan: { template: 'CUSTOM', title: 'AFRO ENERGY', subtitle: 'Feel the moment', frameStyle: 'GOLD', textPosition: 'BOTTOM', textStartSeconds: .2, textEndSeconds: 5.5, speed: '1.25x', boomerang: true, reverse: false, freezeFrame: true, colorEffect: 'PARTY' },
  },
  {
    id: 'red-carpet-glam', name: 'Red Carpet Glam', eyebrow: 'VIP EXPERIENCE', category: 'GALA',
    description: 'Noir et blanc, ralenti spectaculaire et pose finale digne d’un gala.',
    accent: '#f3f3f3', secondary: '#b31520', backdrop: '#111113', intensity: 'DOUX',
    effects: ['Slow motion 0,5×', 'Monochrome', 'Freeze VIP'],
    plan: { template: 'GALA', title: 'RED CARPET', subtitle: 'KHE VIP Experience', frameStyle: 'CLASSIC', textPosition: 'BOTTOM', textStartSeconds: .5, textEndSeconds: 6.5, speed: '0.5x', boomerang: false, reverse: false, freezeFrame: true, colorEffect: 'MONO' },
  },
  {
    id: 'wedding-sparkle', name: 'Wedding Sparkle', eyebrow: 'MARIAGE', category: 'MARIAGE',
    description: 'Une composition romantique, chaude et dorée pour les mariés.',
    accent: '#efd08a', secondary: '#fff3db', backdrop: '#2a1b18', intensity: 'DOUX',
    effects: ['Ralenti 0,75×', 'Teinte chaude', 'Cadre or'],
    plan: { template: 'WEDDING', title: 'Heureux mariage', subtitle: 'Notre plus beau souvenir', frameStyle: 'GOLD', textPosition: 'BOTTOM', textStartSeconds: .5, textEndSeconds: 7, speed: '0.75x', boomerang: false, reverse: false, freezeFrame: true, colorEffect: 'WARM' },
  },
  {
    id: 'party-boom', name: 'Party Boom', eyebrow: 'DANCE FLOOR', category: 'FETE',
    description: 'Un boomerang court, saturé et très dynamique pour faire la fête.',
    accent: '#4ce5ff', secondary: '#ef46ff', backdrop: '#160b24', intensity: 'ÉNERGIQUE',
    effects: ['Boomerang', 'Néon', 'Couleurs Party'],
    plan: { template: 'CUSTOM', title: 'PARTY TIME', subtitle: 'Let’s celebrate', frameStyle: 'NEON', textPosition: 'CENTER', textStartSeconds: .2, textEndSeconds: 4.8, speed: '1.25x', boomerang: true, reverse: false, freezeFrame: false, colorEffect: 'PARTY' },
  },
  {
    id: 'birthday-pop', name: 'Birthday Pop', eyebrow: 'ANNIVERSAIRE', category: 'FETE',
    description: 'Un style joyeux et coloré qui termine sur la meilleure pose.',
    accent: '#ffcb45', secondary: '#ff557d', backdrop: '#251129', intensity: 'ÉNERGIQUE',
    effects: ['Vitesse 1,25×', 'Polaroid', 'Freeze final'],
    plan: { template: 'BIRTHDAY', title: 'Joyeux anniversaire', subtitle: 'Un souvenir rien que pour vous', frameStyle: 'POLAROID', textPosition: 'BOTTOM', textStartSeconds: .3, textEndSeconds: 6, speed: '1.25x', boomerang: false, reverse: false, freezeFrame: true, colorEffect: 'PARTY' },
  },
  {
    id: 'neon-night', name: 'Neon Night', eyebrow: 'NIGHT CLUB', category: 'FETE',
    description: 'Bleu électrique, vitesse et boomerang pour une identité nocturne.',
    accent: '#33ddff', secondary: '#8d4dff', backdrop: '#081224', intensity: 'ÉNERGIQUE',
    effects: ['Vitesse 1,5×', 'Boomerang', 'Filtre Cool'],
    plan: { template: 'GALA', title: 'NEON NIGHT', subtitle: 'Move • Shine • Repeat', frameStyle: 'NEON', textPosition: 'CENTER', textStartSeconds: .2, textEndSeconds: 5, speed: '1.5x', boomerang: true, reverse: false, freezeFrame: false, colorEffect: 'COOL' },
  },
  {
    id: 'baby-dream', name: 'Baby Dream', eyebrow: 'BABY SHOWER', category: 'DOUX',
    description: 'Pastel, lent et tendre pour conserver une ambiance délicate.',
    accent: '#b8d9ff', secondary: '#ffd2e1', backdrop: '#18202c', intensity: 'DOUX',
    effects: ['Ralenti 0,75×', 'Polaroid', 'Teinte douce'],
    plan: { template: 'BABY', title: 'Bienvenue bébé', subtitle: 'Un merveilleux souvenir', frameStyle: 'POLAROID', textPosition: 'BOTTOM', textStartSeconds: .8, textEndSeconds: 7, speed: '0.75x', boomerang: false, reverse: false, freezeFrame: true, colorEffect: 'COOL' },
  },
  {
    id: 'corporate-brand', name: 'Corporate Brand', eyebrow: 'ENTREPRISE', category: 'ENTREPRISE',
    description: 'Sobre, lisible et professionnel pour mettre la marque au premier plan.',
    accent: '#d9e5f5', secondary: '#3a78bb', backdrop: '#101a27', intensity: 'ÉQUILIBRÉ',
    effects: ['Lecture 1×', 'Cadre classique', 'Filtre Cool'],
    plan: { template: 'CUSTOM', title: 'Votre marque', subtitle: 'Votre événement', frameStyle: 'CLASSIC', textPosition: 'BOTTOM', textStartSeconds: .4, textEndSeconds: 6, speed: '1x', boomerang: false, reverse: false, freezeFrame: true, colorEffect: 'COOL' },
  },
  {
    id: 'vintage-film', name: 'Vintage Film', eyebrow: 'RÉTRO CHIC', category: 'GALA',
    description: 'Une lecture inversée chaleureuse avec finition photo instantanée.',
    accent: '#d8b47b', secondary: '#82644b', backdrop: '#211913', intensity: 'DOUX',
    effects: ['Reverse', 'Teinte chaude', 'Polaroid'],
    plan: { template: 'CUSTOM', title: 'VINTAGE MOMENT', subtitle: 'Souvenirs intemporels', frameStyle: 'POLAROID', textPosition: 'BOTTOM', textStartSeconds: .6, textEndSeconds: 7, speed: '0.75x', boomerang: false, reverse: true, freezeFrame: true, colorEffect: 'WARM' },
  },
  {
    id: 'pure-360', name: 'Pure 360', eyebrow: 'ESSENTIEL', category: 'SIGNATURE',
    description: 'La vidéo originale mise en valeur sans mouvement artificiel.',
    accent: '#ffffff', secondary: '#77777f', backdrop: '#171719', intensity: 'ÉQUILIBRÉ',
    effects: ['Lecture naturelle', 'Image pure', 'Son original'],
    plan: { template: 'NONE', title: '', subtitle: '', frameStyle: 'NONE', textPosition: 'BOTTOM', textStartSeconds: 0, textEndSeconds: null, speed: '1x', boomerang: false, reverse: false, freezeFrame: false, colorEffect: 'NONE' },
  },
  {
    id: 'khe-grand-finale', name: 'KHE Grand Finale', eyebrow: 'SIGNATURE KHE', category: 'SIGNATURE',
    description: 'Une finale festive, dorée et rythmée pour terminer avec impact.',
    accent: '#f2c85b', secondary: '#d2192b', backdrop: '#1c0f12', intensity: 'ÉNERGIQUE',
    effects: ['Vitesse 1,25×', 'Boomerang', 'Freeze signature'],
    plan: { template: 'CUSTOM', title: 'KHE GRAND FINALE', subtitle: 'Votre événement, notre expertise', frameStyle: 'GOLD', textPosition: 'CENTER', textStartSeconds: .3, textEndSeconds: 5.5, speed: '1.25x', boomerang: true, reverse: false, freezeFrame: true, colorEffect: 'PARTY' },
  },
];

export function applyCreativePreset(current: CreativePlan, preset: CreativePreset): CreativePlan {
  return { ...current, ...preset.plan, presetId: preset.id };
}
