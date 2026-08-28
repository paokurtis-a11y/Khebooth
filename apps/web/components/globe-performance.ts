export type ProjectedPoint<T> = { item: T; x: number; y: number; depth: number };
export type ProjectedCluster<T> = { key: string; items: T[]; x: number; y: number; depth: number };

export function clusterProjectedPoints<T>(points: ProjectedPoint<T>[], cellSize = 28): ProjectedCluster<T>[] {
  const buckets = new Map<string, { items: T[]; x: number; y: number; depth: number }>();
  for (const point of points) {
    const key = `${Math.round(point.x / cellSize)}:${Math.round(point.y / cellSize)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(point.item);
      bucket.x += point.x;
      bucket.y += point.y;
      bucket.depth += point.depth;
    } else {
      buckets.set(key, { items: [point.item], x: point.x, y: point.y, depth: point.depth });
    }
  }
  return Array.from(buckets, ([key, bucket]) => ({
    key,
    items: bucket.items,
    x: bucket.x / bucket.items.length,
    y: bucket.y / bucket.items.length,
    depth: bucket.depth / bucket.items.length,
  }));
}

export function labelBudget(viewportWidth: number): number {
  if (viewportWidth < 480) return 12;
  if (viewportWidth < 900) return 22;
  return 32;
}
