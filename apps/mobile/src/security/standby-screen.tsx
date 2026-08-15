import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

interface StandbyScreenProps {
  verifyPassword: (password: string) => Promise<boolean>;
  onUnlocked: () => Promise<void> | void;
}

export function StandbyScreen({ verifyPassword, onUnlocked }: StandbyScreenProps) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Touchez Déverrouiller pour reprendre la régie.');
  const [busy, setBusy] = useState(false);
  const [authLabel, setAuthLabel] = useState('Empreinte / visage / verrouillage tablette');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (cancelled) return;
        const labels: string[] = [];
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) labels.push('empreinte');
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) labels.push('visage');
        if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) labels.push('iris');
        const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
        if (securityLevel >= LocalAuthentication.SecurityLevel.SECRET) labels.push('PIN / schéma système');
        if (labels.length) setAuthLabel(labels.join(' • '));
      } catch {
        // The KHE password remains available as a deterministic fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function unlockWithDevice(): Promise<void> {
    setBusy(true);
    setMessage('Authentification en cours…');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Déverrouiller KHE Booth',
        promptSubtitle: 'Votre événement, notre expertise !',
        promptDescription: 'Utilisez la sécurité configurée sur cette tablette.',
        disableDeviceFallback: false,
        cancelLabel: 'Utiliser le mot de passe KHE',
      });
      if (result.success) {
        await onUnlocked();
        return;
      }
      setMessage('Authentification non validée. Vous pouvez utiliser le mot de passe KHE ci-dessous.');
    } catch {
      setMessage('Authentification système indisponible. Utilisez le mot de passe KHE.');
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithPassword(): Promise<void> {
    if (!password) return;
    setBusy(true);
    try {
      if (await verifyPassword(password)) {
        setPassword('');
        await onUnlocked();
        return;
      }
      setMessage('Mot de passe KHE incorrect.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>KHE</Text>
        <Text style={styles.slogan}>Votre événement, notre expertise !</Text>
        <Text style={styles.standby}>MODE VEILLE SÉCURISÉ</Text>
      </View>

      <View style={styles.unlockCard}>
        <Text style={styles.unlockTitle}>Revenir à l’écran actif</Text>
        <Text style={styles.authMethods}>{authLabel}</Text>
        <Pressable disabled={busy} onPress={() => void unlockWithDevice()} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{busy ? 'Vérification…' : 'Déverrouiller'}</Text>
        </Pressable>

        <Text style={styles.or}>ou avec le mot de passe KHE</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Mot de passe KHE"
          placeholderTextColor="#777777"
          style={styles.input}
          onSubmitEditing={() => void unlockWithPassword()}
        />
        <Pressable disabled={busy || !password} onPress={() => void unlockWithPassword()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>VALIDER LE MOT DE PASSE</Text>
        </Pressable>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#090909', padding: 28, justifyContent: 'space-between' },
  brandBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#ffffff', fontSize: 86, lineHeight: 96, fontWeight: '900', letterSpacing: 6 },
  slogan: { color: '#ffffff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  standby: { color: '#a8a8a8', fontSize: 11, fontWeight: '900', letterSpacing: 2.4, marginTop: 18 },
  unlockCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 20, gap: 11 },
  unlockTitle: { fontSize: 20, fontWeight: '900' },
  authMethods: { fontSize: 11, lineHeight: 16, opacity: 0.6 },
  primaryButton: { backgroundColor: '#111111', borderRadius: 13, padding: 15, alignItems: 'center' },
  primaryText: { color: '#ffffff', fontWeight: '900' },
  or: { textAlign: 'center', fontSize: 11, opacity: 0.55, marginTop: 2 },
  input: { borderWidth: 1, borderColor: '#d0d0d0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  secondaryButton: { borderWidth: 1, borderColor: '#111111', borderRadius: 12, padding: 13, alignItems: 'center' },
  secondaryText: { fontWeight: '900', fontSize: 11 },
  message: { fontSize: 11, lineHeight: 16, opacity: 0.65 },
});
