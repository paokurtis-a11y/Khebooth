import type { FinalMediaRenderInput, FinalMediaRenderResult } from './media-renderer';

type RendererModule = typeof import('./media-renderer');
export type RendererLoader = () => Promise<RendererModule>;

export function createLazyFinalMediaRenderer(
  loadRenderer: RendererLoader = () => import('./media-renderer'),
): (input: FinalMediaRenderInput) => Promise<FinalMediaRenderResult> {
  let modulePromise: Promise<RendererModule> | null = null;
  return async (input) => {
    modulePromise ??= loadRenderer();
    const { renderFinalMedia } = await modulePromise;
    return renderFinalMedia(input);
  };
}
