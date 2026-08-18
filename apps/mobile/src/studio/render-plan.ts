import * as SecureStore from 'expo-secure-store';
import type { CreativePlan, MusicAsset } from './creative-studio';
import { loadCreativePlan } from './creative-studio';

export interface CaptureRenderJob {
  version: 1;
  captureIndex: number;
  createdAt: string;
  sourceUri: string;
  outputUri: string | null;
  state: 'PLANNED' | 'RENDERING' | 'READY' | 'FAILED';
  plan: CreativePlan;
  selectedMusic: MusicAsset | null;
  error: string | null;
}

const CAPTURE_INDEX_KEY = 'khe.creative.capture-index.v1';
const RENDER_JOB_PREFIX = 'khe.creative.render-job.v1.';

async function nextCaptureIndex(): Promise<number> {
  const raw = await SecureStore.getItemAsync(CAPTURE_INDEX_KEY);
  const current = Number.parseInt(raw ?? '0', 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  await SecureStore.setItemAsync(CAPTURE_INDEX_KEY, String(next));
  return next;
}

export function selectMusicForCapture(plan: CreativePlan, captureIndex: number): MusicAsset | null {
  if (plan.audioMode !== 'MUSIC_ONLY' || plan.music.length === 0) return null;
  const every = Math.max(1, plan.musicRotationEvery || 3);
  const musicIndex = Math.floor((Math.max(1, captureIndex) - 1) / every) % plan.music.length;
  return plan.music[musicIndex] ?? null;
}

export async function planCaptureRender(localId: string, sourceUri: string): Promise<CaptureRenderJob> {
  const plan = await loadCreativePlan();
  const captureIndex = await nextCaptureIndex();
  const job: CaptureRenderJob = {
    version: 1,
    captureIndex,
    createdAt: new Date().toISOString(),
    sourceUri,
    outputUri: null,
    state: 'PLANNED',
    plan,
    selectedMusic: selectMusicForCapture(plan, captureIndex),
    error: null,
  };
  await SecureStore.setItemAsync(`${RENDER_JOB_PREFIX}${localId}`, JSON.stringify(job));
  return job;
}

export async function loadCaptureRenderJob(localId: string): Promise<CaptureRenderJob | null> {
  const raw = await SecureStore.getItemAsync(`${RENDER_JOB_PREFIX}${localId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as CaptureRenderJob; } catch { return null; }
}

export async function updateCaptureRenderJob(localId: string, patch: Partial<CaptureRenderJob>): Promise<void> {
  const current = await loadCaptureRenderJob(localId);
  if (!current) return;
  await SecureStore.setItemAsync(`${RENDER_JOB_PREFIX}${localId}`, JSON.stringify({ ...current, ...patch }));
}

export function renderSummary(job: CaptureRenderJob): string {
  const effects: string[] = [job.plan.speed];
  if (job.plan.background) effects.push('Fond personnalisé');
  if (job.plan.boomerang) effects.push('Boomerang');
  if (job.plan.reverse) effects.push('Reverse');
  if (job.plan.freezeFrame) effects.push('Freeze');
  if (job.plan.colorEffect !== 'NONE') effects.push(job.plan.colorEffect);
  if (job.plan.frameStyle !== 'NONE') effects.push(`Cadre ${job.plan.frameStyle}`);
  if (job.plan.title.trim()) effects.push('Texte');
  effects.push(job.selectedMusic ? `Musique: ${job.selectedMusic.name}` : 'Micro');
  return effects.join(' • ');
}
