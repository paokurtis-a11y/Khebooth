import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PACKAGE = '@nikhil-cephei/ffmpeg-kit-react-native';
const PACKAGE_PARTS = ['@nikhil-cephei', 'ffmpeg-kit-react-native'];

function findPackageRoot() {
  const candidates = [
    path.join(process.cwd(), 'node_modules', ...PACKAGE_PARTS),
    path.join(process.cwd(), '..', '..', 'node_modules', ...PACKAGE_PARTS),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
  }

  try {
    return path.dirname(require.resolve(`${PACKAGE}/package.json`));
  } catch {
    throw new Error(`${PACKAGE} is installed but its package root could not be resolved.`);
  }
}

function runNode(script, args) {
  execFileSync(process.execPath, [script, ...args], { stdio: 'inherit' });
}

function resolveCodegenCli(relativePath) {
  const searchRoots = [process.cwd(), path.join(process.cwd(), '..', '..')];
  return require.resolve(`@react-native/codegen/${relativePath}`, { paths: searchRoots });
}

function descriptorForType(type) {
  const clean = type.replace(/\bfinal\b/g, '').replace(/@\w+(?:\([^)]*\))?/g, '').trim();
  const simple = clean.replace(/<.*>/g, '').trim();
  const known = {
    Double: 'Ljava/lang/Double;',
    Integer: 'Ljava/lang/Integer;',
    Boolean: 'Ljava/lang/Boolean;',
    Long: 'Ljava/lang/Long;',
    Float: 'Ljava/lang/Float;',
    String: 'Ljava/lang/String;',
    Promise: 'Lcom/facebook/react/bridge/Promise;',
    ReadableArray: 'Lcom/facebook/react/bridge/ReadableArray;',
    ReadableMap: 'Lcom/facebook/react/bridge/ReadableMap;',
    WritableMap: 'Lcom/facebook/react/bridge/WritableMap;',
    WritableArray: 'Lcom/facebook/react/bridge/WritableArray;',
    double: 'D',
    int: 'I',
    boolean: 'Z',
    long: 'J',
    float: 'F',
  };
  if (known[simple]) return known[simple];
  if (simple.endsWith('[]')) return `[${descriptorForType(simple.slice(0, -2))}`;
  if (simple.includes('.')) return `L${simple.replaceAll('.', '/')};`;
  return `L${simple};`;
}

function methodDescriptors(specJava) {
  const descriptors = new Map();
  const methodPattern = /public abstract\s+[\w<>?,.\[\] ]+\s+(\w+)\s*\(([^)]*)\)\s*(?:throws [^{;]+)?;/g;
  let match;

  while ((match = methodPattern.exec(specJava)) !== null) {
    const [, name, rawParams] = match;
    const params = rawParams.trim()
      ? rawParams.split(',').map((param) => {
          const tokens = param.trim().split(/\s+/).filter((token) => token !== 'final' && !token.startsWith('@'));
          return tokens.slice(0, -1).join(' ');
        })
      : [];
    descriptors.set(name, `(${params.map(descriptorForType).join('')})V`);
  }

  return descriptors;
}

function patchGeneratedSpec(source) {
  let patched = source.replaceAll('NativeFFmpegKitSpec', 'NativeFFmpegKitReactNativeModuleSpec');
  const boxedParameters = [
    ['double sessionId', 'Double sessionId'],
    ['double waitTimeout', 'Double waitTimeout'],
    ['double signalValue', 'Double signalValue'],
    ['double level', 'Double level'],
    ['double sessionHistorySize', 'Double sessionHistorySize'],
    ['double sessionState', 'Double sessionState'],
    ['double logRedirectionStrategy', 'Double logRedirectionStrategy'],
    ['removeListeners(double count)', 'removeListeners(Integer count)'],
    ['boolean writable', 'Boolean writable'],
  ];

  for (const [from, to] of boxedParameters) patched = patched.replaceAll(from, to);
  return patched;
}

const packageRoot = findPackageRoot();
const sourceSpec = path.join(packageRoot, 'src', 'NativeFFmpegKit.js');
const nativeModule = path.join(
  packageRoot,
  'android',
  'src',
  'newarch',
  'java',
  'com',
  'arthenica',
  'ffmpegkit',
  'reactnative',
  'FFmpegKitReactNativeModule.java',
);
const javaSpecDestination = path.join(
  packageRoot,
  'android',
  'src',
  'main',
  'java',
  'com',
  'arthenica',
  'ffmpegkit',
  'reactnative',
  'NativeFFmpegKitReactNativeModuleSpec.java',
);
const jniDestination = path.join(packageRoot, 'android', 'build', 'generated', 'source', 'codegen', 'jni');

if (!existsSync(sourceSpec)) throw new Error(`FFmpeg TurboModule spec is missing: ${sourceSpec}`);
if (!existsSync(nativeModule)) throw new Error(`FFmpeg New Architecture module is missing: ${nativeModule}`);

const setupScript = path.join(packageRoot, 'scripts', 'setup.js');
if (existsSync(setupScript)) runNode(setupScript, []);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'khe-ffmpeg-codegen-'));
try {
  const schemaPath = path.join(temporaryRoot, 'schema.json');
  const outputPath = path.join(temporaryRoot, 'generated');
  mkdirSync(outputPath, { recursive: true });

  const combineCli = resolveCodegenCli('lib/cli/combine/combine-js-to-schema-cli.js');
  const generateCli = resolveCodegenCli('lib/cli/generators/generate-all.js');

  runNode(combineCli, [
    schemaPath,
    '--platform',
    'android',
    sourceSpec,
    '--libraryName',
    'FFmpegKitReactNativeSpec',
  ]);
  runNode(generateCli, [
    schemaPath,
    'FFmpegKitReactNativeSpec',
    outputPath,
    'com.arthenica.ffmpegkit.reactnative',
    'false',
  ]);

  const generatedJava = path.join(
    outputPath,
    'java',
    'com',
    'arthenica',
    'ffmpegkit',
    'reactnative',
    'NativeFFmpegKitSpec.java',
  );
  if (!existsSync(generatedJava)) throw new Error('React Native Codegen did not emit the FFmpeg Java spec.');

  const patchedJava = patchGeneratedSpec(readFileSync(generatedJava, 'utf8'));
  mkdirSync(path.dirname(javaSpecDestination), { recursive: true });
  writeFileSync(javaSpecDestination, patchedJava);

  const generatedJni = path.join(outputPath, 'jni');
  if (!existsSync(path.join(generatedJni, 'CMakeLists.txt'))) {
    throw new Error('React Native Codegen did not emit FFmpeg JNI sources.');
  }
  rmSync(jniDestination, { recursive: true, force: true });
  cpSync(generatedJni, jniDestination, { recursive: true });

  const generatedCpp = path.join(jniDestination, 'FFmpegKitReactNativeSpec-generated.cpp');
  if (existsSync(generatedCpp)) {
    const descriptors = methodDescriptors(patchedJava);
    let cpp = readFileSync(generatedCpp, 'utf8');
    for (const [name, descriptor] of descriptors) {
      const pattern = new RegExp(`(invokeJavaMethod\\(rt, \\w+Kind, "${name}",\\s*)"[^"]*"`, 'g');
      cpp = cpp.replace(pattern, `$1"${descriptor}"`);
    }
    writeFileSync(generatedCpp, cpp);
  }

  console.log(`[KHE] FFmpeg New Architecture bridge prepared for React Native 0.85 at ${packageRoot}`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
