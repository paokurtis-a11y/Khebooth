import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface UserProfileData {
  firstName: string;
  lastName: string;
  displayName: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  bio: string;
  avatarUri: string | null;
}

const PROFILE_KEY = 'khe.profile.v1';
const EMPTY_PROFILE: UserProfileData = {
  firstName: '', lastName: '', displayName: '', company: '', role: '', email: '', phone: '', city: '', country: '', bio: '', avatarUri: null,
};

async function loadProfile(): Promise<UserProfileData> {
  const raw = await SecureStore.getItemAsync(PROFILE_KEY);
  if (!raw) return EMPTY_PROFILE;
  try { return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<UserProfileData>) }; } catch { return EMPTY_PROFILE; }
}

async function saveProfile(profile: UserProfileData): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} multiline={multiline} style={[styles.input, multiline && styles.multiline]} />
    </View>
  );
}

export function UserProfile({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfileData>(EMPTY_PROFILE);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void loadProfile().then(setProfile); }, []);

  const completion = useMemo(() => {
    const fields = [profile.displayName, profile.company, profile.role, profile.email, profile.city, profile.country, profile.bio, profile.avatarUri ?? ''];
    return Math.round((fields.filter((value) => value.trim().length > 0).length / fields.length) * 100);
  }, [profile]);

  function patch(patchValue: Partial<UserProfileData>): void {
    setProfile((current) => ({ ...current, ...patchValue }));
    setMessage('');
  }

  async function chooseAvatar(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/*'], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const directory = new Directory(Paths.document, 'profile');
      await directory.create({ idempotent: true, intermediates: true });
      const extension = asset.name?.split('.').pop()?.toLowerCase() || 'jpg';
      const source = new File(asset.uri);
      const destination = new File(directory, `avatar.${extension}`);
      if (destination.exists) destination.delete();
      await source.copy(destination);
      patch({ avatarUri: destination.uri });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer la photo de profil.');
    }
  }

  async function persist(): Promise<void> {
    setSaving(true);
    try {
      const normalized: UserProfileData = { ...profile, displayName: profile.displayName.trim() || `${profile.firstName} ${profile.lastName}`.trim() };
      await saveProfile(normalized);
      setProfile(normalized);
      setMessage('Profil KHE enregistré sur cette tablette.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.title}>Mon profil</Text><Text style={styles.help}>Personnalisez votre espace. Toutes les informations sont facultatives et modifiables.</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable></View>

        <View style={styles.identityCard}>
          <Pressable style={styles.avatarButton} onPress={() => void chooseAvatar()}>
            {profile.avatarUri ? <Image source={{ uri: profile.avatarUri }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarPlaceholderText}>＋</Text></View>}
          </Pressable>
          <View style={{ flex: 1 }}><Text style={styles.profileName}>{profile.displayName || profile.firstName || 'Votre profil KHE'}</Text><Text style={styles.profileMeta}>{profile.company || 'Ajoutez votre entreprise'}{profile.role ? ` • ${profile.role}` : ''}</Text><Text style={styles.completion}>Profil complété à {completion}%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View></View>
        </View>

        <View style={styles.grid}>
          <Field label="Prénom" value={profile.firstName} onChange={(value) => patch({ firstName: value })} placeholder="Votre prénom" />
          <Field label="Nom" value={profile.lastName} onChange={(value) => patch({ lastName: value })} placeholder="Votre nom" />
          <Field label="Nom affiché" value={profile.displayName} onChange={(value) => patch({ displayName: value })} placeholder="Nom visible dans KHE" />
          <Field label="Entreprise" value={profile.company} onChange={(value) => patch({ company: value })} placeholder="Nom de votre entreprise" />
          <Field label="Rôle" value={profile.role} onChange={(value) => patch({ role: value })} placeholder="DJ, organisateur, photobooth…" />
          <Field label="E-mail" value={profile.email} onChange={(value) => patch({ email: value })} placeholder="contact@exemple.ch" />
          <Field label="Téléphone" value={profile.phone} onChange={(value) => patch({ phone: value })} placeholder="+41 …" />
          <Field label="Ville" value={profile.city} onChange={(value) => patch({ city: value })} placeholder="Ville" />
          <Field label="Pays" value={profile.country} onChange={(value) => patch({ country: value })} placeholder="Pays" />
          <Field label="À propos de vous" value={profile.bio} onChange={(value) => patch({ bio: value })} placeholder="Présentez votre activité et votre univers…" multiline />
        </View>

        <View style={styles.tipCard}><Text style={styles.tipTitle}>Votre espace, votre identité</Text><Text style={styles.tipText}>La photo, le nom d’affichage et l’entreprise pourront ensuite être réutilisés dans les designs, impressions et écrans de régie. Aucun champ personnel n’est obligatoire pour utiliser CAPTURE ou SHARING.</Text></View>

        <Pressable disabled={saving} style={[styles.saveButton, saving && styles.disabled]} onPress={() => void persist()}><Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer mon profil'}</Text></Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f3f0' }, content: { padding: 22, paddingTop: 30, paddingBottom: 52, gap: 18 },
  header: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, brand: { fontSize: 11, letterSpacing: 3, fontWeight: '900' }, title: { fontSize: 32, fontWeight: '900', marginTop: 3 }, help: { marginTop: 5, opacity: 0.6, lineHeight: 19 },
  close: { borderWidth: 1, borderColor: '#bcbcbc', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 }, closeText: { fontWeight: '800' },
  identityCard: { backgroundColor: '#111111', borderRadius: 24, padding: 18, flexDirection: 'row', gap: 16, alignItems: 'center' }, avatarButton: { width: 86, height: 86 }, avatar: { width: 86, height: 86, borderRadius: 43 }, avatarPlaceholder: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }, avatarPlaceholderText: { fontSize: 34, fontWeight: '300' },
  profileName: { color: '#ffffff', fontSize: 20, fontWeight: '900' }, profileMeta: { color: '#bdbdbd', marginTop: 3 }, completion: { color: '#ffffff', fontSize: 10, marginTop: 11, fontWeight: '800' }, progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#444444', marginTop: 5, overflow: 'hidden' }, progressFill: { height: 5, backgroundColor: '#ffffff' },
  grid: { gap: 12 }, field: { gap: 6 }, label: { fontSize: 11, fontWeight: '900', letterSpacing: 0.7 }, input: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#dddddd', paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 }, multiline: { minHeight: 110, textAlignVertical: 'top' },
  tipCard: { backgroundColor: '#e7e5df', borderRadius: 18, padding: 16 }, tipTitle: { fontWeight: '900', fontSize: 15 }, tipText: { marginTop: 5, opacity: 0.65, lineHeight: 18 },
  saveButton: { backgroundColor: '#111111', borderRadius: 16, padding: 16, alignItems: 'center' }, saveText: { color: '#ffffff', fontWeight: '900' }, disabled: { opacity: 0.5 }, message: { backgroundColor: '#ffffff', borderRadius: 13, padding: 13, lineHeight: 18 },
});