import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SocialProvider } from '../api/station-api';
import { SocialConnectionsClient, type SocialConnectionReadiness } from './social-connections-client';

const LABELS: Record<SocialProvider, string> = {
  WHATSAPP: 'WhatsApp Business', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', TIKTOK: 'TikTok', X: 'X', TELEGRAM: 'Telegram', YOUTUBE: 'YouTube',
};
const ORDER: SocialProvider[] = ['WHATSAPP','INSTAGRAM','FACEBOOK','TIKTOK','X','TELEGRAM','YOUTUBE'];

function statusLabel(item: SocialConnectionReadiness): string {
  if (item.accountConnected) return 'CONNECTÉ ✓';
  if (item.connectionStatus === 'SELECTION_REQUIRED') return 'CHOIX DU COMPTE';
  if (item.connectionStatus === 'AUTHORIZING') return 'AUTORISATION EN COURS';
  if (!item.developerConfigReady) return 'CONFIGURATION DÉVELOPPEUR REQUISE';
  if (item.connectionStatus === 'ERROR') return 'À RECONNECTER';
  return item.mode === 'OAUTH' ? 'PRÊT À CONNECTER' : 'PRÊT À VÉRIFIER';
}

export function SocialConnectionsPanel() {
  const client = useMemo(() => new SocialConnectionsClient(), []);
  const [providers, setProviders] = useState<SocialConnectionReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState('');

  async function refresh(silent = false): Promise<void> {
    if (!silent) setLoading(true);
    try {
      const response = await client.readiness();
      setProviders(response.providers);
      if (!silent) setMessage('');
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : 'État des connexions sociales indisponible.');
    } finally { if (!silent) setLoading(false); }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(true), 4_000);
    return () => clearInterval(timer);
  }, [client]);

  async function connect(item: SocialConnectionReadiness): Promise<void> {
    setWorking(item.provider); setMessage('');
    try {
      if (item.mode === 'OAUTH') {
        const started = await client.start(item.provider);
        const supported = await Linking.canOpenURL(started.authorizationUrl);
        if (!supported) throw new Error('Cette tablette ne peut pas ouvrir la page d’autorisation.');
        await Linking.openURL(started.authorizationUrl);
        setMessage(`Autorisez ${LABELS[item.provider]} dans la page ouverte puis revenez dans KHE Booth. L’état se mettra à jour automatiquement.`);
      } else {
        const result = await client.validate(item.provider);
        setMessage(`✓ ${LABELS[item.provider]} vérifié${result.externalAccountName ? ` : ${result.externalAccountName}` : ''}.`);
      }
      await refresh(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connexion impossible.'); }
    finally { setWorking(null); }
  }

  async function select(item: SocialConnectionReadiness, accountId: string, name: string): Promise<void> {
    setWorking(item.provider); setMessage('');
    try {
      await client.select(item.provider, accountId);
      setMessage(`✓ ${name} connecté à KHE Booth.`);
      await refresh(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sélection du compte impossible.'); }
    finally { setWorking(null); }
  }

  async function disconnect(item: SocialConnectionReadiness): Promise<void> {
    setWorking(item.provider); setMessage('');
    try {
      await client.disconnect(item.provider);
      setMessage(`${LABELS[item.provider]} déconnecté de KHE Booth. Les mots de passe du réseau n’ont jamais été stockés.`);
      await refresh(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Déconnexion impossible.'); }
    finally { setWorking(null); }
  }

  const ordered = ORDER.map(provider => providers.find(item => item.provider === provider)).filter(Boolean) as SocialConnectionReadiness[];

  return <View style={styles.card}>
    <View><Text style={styles.eyebrow}>KHE SOCIAL CONNECTIONS</Text><Text style={styles.title}>Connexions API réelles</Text><Text style={styles.help}>Le lien public et l’autorisation API sont séparés. KHE ne demande jamais votre mot de passe social et n’affiche jamais un access token.</Text></View>
    {loading ? <View style={styles.loading}><ActivityIndicator color="#d2ad4f"/><Text style={styles.help}>Vérification des fournisseurs…</Text></View> : null}
    {!loading ? ordered.map(item => <View key={item.provider} style={styles.provider}>
      <View style={styles.providerHeading}>
        <View style={{flex:1}}><Text style={styles.providerName}>{LABELS[item.provider]}</Text><Text style={[styles.status,item.accountConnected&&styles.connected]}>{statusLabel(item)}</Text></View>
        <View style={[styles.dot,item.accountConnected&&styles.dotConnected]} />
      </View>
      {item.externalAccountName ? <Text style={styles.account}>{item.externalAccountName}</Text> : null}
      {item.callbackUrl && item.developerConfigReady && !item.accountConnected ? <Text style={styles.callback}>Callback développeur : {item.callbackUrl}</Text> : null}
      {!item.developerConfigReady ? <Text style={styles.missing}>À ajouter côté serveur : {item.missingEnvironmentVariables.join(', ')}</Text> : null}
      {item.connectionStatus === 'SELECTION_REQUIRED' && item.candidates.length ? <View style={styles.candidates}>
        <Text style={styles.help}>Plusieurs comptes sont administrés. Choisissez celui de KHE Booth :</Text>
        {item.candidates.map(candidate => <Pressable key={candidate.pageId} disabled={working===item.provider} style={styles.candidate} onPress={()=>void select(item,candidate.pageId,candidate.pageName)}><Text style={styles.candidateText}>{candidate.pageName}{candidate.instagramAccountId?' • Instagram professionnel':''}</Text></Pressable>)}
      </View> : null}
      <View style={styles.actions}>
        {item.accountConnected ? <Pressable disabled={working===item.provider} style={styles.disconnect} onPress={()=>void disconnect(item)}><Text style={styles.disconnectText}>DÉCONNECTER</Text></Pressable> : item.developerConfigReady && item.connectionStatus !== 'SELECTION_REQUIRED' ? <Pressable disabled={working===item.provider} style={styles.connect} onPress={()=>void connect(item)}><Text style={styles.connectText}>{working===item.provider?'VÉRIFICATION…':item.mode==='OAUTH'?'CONNECTER LE COMPTE':'VÉRIFIER LA CONNEXION'}</Text></Pressable> : null}
      </View>
    </View>) : null}
    <Pressable style={styles.refresh} onPress={()=>void refresh()}><Text style={styles.refreshText}>↻ ACTUALISER LES CONNEXIONS</Text></Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>;
}

const styles=StyleSheet.create({
  card:{backgroundColor:'#111114',borderRadius:20,padding:16,gap:12,borderWidth:1,borderColor:'#284436'},eyebrow:{color:'#57c785',fontSize:10,fontWeight:'900',letterSpacing:1.6},title:{color:'#fff',fontSize:20,fontWeight:'900',marginTop:3},help:{color:'#aaa',fontSize:11,lineHeight:17},loading:{padding:15,alignItems:'center',gap:7},provider:{backgroundColor:'#18181c',borderRadius:15,padding:13,gap:7,borderWidth:1,borderColor:'#303037'},providerHeading:{flexDirection:'row',alignItems:'center',gap:10},providerName:{color:'#fff',fontSize:15,fontWeight:'900'},status:{color:'#d2ad4f',fontSize:9,fontWeight:'900',marginTop:3},connected:{color:'#57c785'},dot:{width:11,height:11,borderRadius:6,backgroundColor:'#d2ad4f'},dotConnected:{backgroundColor:'#57c785'},account:{color:'#d9eee0',fontWeight:'800',fontSize:12},callback:{color:'#7f8994',fontSize:9,lineHeight:14},missing:{color:'#ffbd8c',fontSize:10,lineHeight:15},actions:{flexDirection:'row',gap:8},connect:{backgroundColor:'#b31520',borderRadius:11,paddingHorizontal:12,paddingVertical:10},connectText:{color:'#fff',fontSize:9,fontWeight:'900'},disconnect:{borderWidth:1,borderColor:'#7b4a4a',borderRadius:11,paddingHorizontal:12,paddingVertical:10},disconnectText:{color:'#ffb3b3',fontSize:9,fontWeight:'900'},candidates:{gap:6},candidate:{borderWidth:1,borderColor:'#d2ad4f',borderRadius:10,padding:10},candidateText:{color:'#fff',fontWeight:'800',fontSize:11},refresh:{borderWidth:1,borderColor:'#55555d',borderRadius:12,padding:11,alignItems:'center'},refreshText:{color:'#ddd',fontWeight:'900',fontSize:9},message:{color:'#d8c69b',fontSize:11,lineHeight:17,fontWeight:'700'}
});
