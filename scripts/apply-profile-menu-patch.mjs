import { readFileSync, writeFileSync } from 'node:fs';

const path = 'apps/mobile/src/main.tsx';
let source = readFileSync(path, 'utf8');

function replaceExact(label, before, after) {
  if (!source.includes(before)) {
    throw new Error(`Patch aborted: expected target not found for ${label}`);
  }
  source = source.replace(before, after);
}

replaceExact(
  'profile import',
  "import type { LocalMediaRecord, PersistedStationContext } from './offline/types';",
  "import type { LocalMediaRecord, PersistedStationContext } from './offline/types';\nimport { UserProfile } from './profile/user-profile';",
);

replaceExact(
  'profile state',
  "  const [studioOpen, setStudioOpen] = useState(false);",
  "  const [studioOpen, setStudioOpen] = useState(false);\n  const [profileOpen, setProfileOpen] = useState(false);",
);

replaceExact(
  'profile close on station deactivation',
  "      setCameraOpen(false); setGalleryOpen(false); setMenuOpen(false); setAboutOpen(false); setGuideOpen(false); setLanguageOpen(false); setSettingsOpen(false); setStudioOpen(false);",
  "      setCameraOpen(false); setGalleryOpen(false); setMenuOpen(false); setAboutOpen(false); setGuideOpen(false); setLanguageOpen(false); setSettingsOpen(false); setStudioOpen(false); setProfileOpen(false);",
);

replaceExact(
  'profile route',
  "  if (studioOpen) return <CreativeStudio onClose={() => setStudioOpen(false)} />;",
  "  if (studioOpen) return <CreativeStudio onClose={() => setStudioOpen(false)} />;\n  if (profileOpen) return <UserProfile onClose={() => setProfileOpen(false)} />;",
);

replaceExact(
  'menu profile and print entries',
  "                  <Text style={styles.menuBrand}>KHE BOOTH</Text><Text style={styles.menuSession}>{station.mode} • {eventName ?? 'Événement'}</Text>",
  "                  <Text style={styles.menuBrand}>KHE BOOTH</Text><Text style={styles.menuSession}>{station.mode} • {eventName ?? 'Événement'}</Text>\n                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setProfileOpen(true); }}><Text style={styles.menuItemText}>👤 Profil</Text></Pressable>\n                  {station.mode === 'CAPTURE' ? <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setGalleryOpen(true); }}><Text style={styles.menuItemText}>🖨 Imprimer • Photos</Text></Pressable> : null}",
);

writeFileSync(path, source);
console.log('Profile + Print menu patch applied successfully.');
