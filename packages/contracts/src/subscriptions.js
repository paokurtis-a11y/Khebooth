// Metro/React Native source-resolution bridge.
// The TypeScript package is compiled with NodeNext, so index.ts intentionally
// references ./subscriptions.js for the emitted Node ESM output. Metro follows
// the source tree during Expo bundling and needs a real .js target at that path.
// Re-export the TypeScript source so both runtimes resolve the same contracts.
export * from './subscriptions.ts';
