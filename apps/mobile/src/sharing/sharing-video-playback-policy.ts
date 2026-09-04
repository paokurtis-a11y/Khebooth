export function shouldMountSharingVideoPlayer(active: boolean, uri: string | null): boolean {
  return active && Boolean(uri);
}
