import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void; }
interface State { error: Error | null; retryKey: number; }

export class SharingErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };
  static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }
  private retry = (): void => { this.setState((current) => ({ error: null, retryKey: current.retryKey + 1 })); };
  render() {
    if (this.state.error) return <View style={styles.card}><Text style={styles.eyebrow}>RÉGIE SHARING</Text><Text style={styles.title}>La station a été protégée</Text><Text style={styles.help}>Le rapport filtré a été transmis automatiquement au support KHE. KHE Booth reste ouvert : relancez uniquement la régie SHARING.</Text><Text style={styles.detail} numberOfLines={3}>{this.state.error.message}</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={this.retry}><Text style={styles.retryText}>RELANCER SHARING</Text></Pressable></View>;
    return <View key={this.state.retryKey}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111113', borderRadius: 20, borderWidth: 1, borderColor: '#7c3a40', padding: 18, gap: 10 },
  eyebrow: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }, title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  help: { color: '#d0ccd0', fontSize: 12, lineHeight: 18 }, detail: { color: '#ac8f92', fontSize: 10, lineHeight: 15 },
  retry: { backgroundColor: '#b31520', borderRadius: 12, padding: 13, alignItems: 'center' }, retryText: { color: '#fff', fontWeight: '900' },
});
