#!/usr/bin/env node
'use strict';

/**
 * Generates the autolinking.json consumed by React Native Gradle Plugin (RNGP).
 *
 * RNGP's autolinkLibrariesFromCommand() calls `npx @react-native-community/cli config`,
 * but that command is fragile on EAS: pnpm's isolated node_modules and npx's package
 * resolution interact poorly, often producing output without project.android.packageName.
 *
 * This script produces identical output by calling expo-modules-autolinking directly
 * (always installed, pnpm-compatible) with a guaranteed packageName fallback.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

// ── Step 1: Run expo-modules-autolinking react-native-config ──────────────────
let config = null;
try {
  const expoAutolink = require.resolve(
    'expo-modules-autolinking',
    { paths: [require.resolve('expo/package.json', { paths: [projectRoot] })] }
  );

  const evalCode = `require(${JSON.stringify(expoAutolink)})(process.argv.slice(1))`;

  const result = spawnSync(
    process.execPath,
    ['--no-warnings', '--eval', evalCode, 'react-native-config', '--json', '--platform', 'android'],
    { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }
  );

  if (result.status === 0 && result.stdout) {
    config = JSON.parse(result.stdout.toString());
  }
} catch (_) {}

// ── Step 2: Guarantee packageName (build.gradle → manifest fallback) ──────────
let packageName =
  config &&
  config.project &&
  config.project.android &&
  config.project.android.packageName;

if (!packageName) {
  const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    const m = fs.readFileSync(buildGradlePath, 'utf8').match(/namespace\s*[=]*\s*["'](.+?)["']/);
    if (m) packageName = m[1];
  }
}

if (!packageName) {
  const manifestPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    const m = fs.readFileSync(manifestPath, 'utf8').match(/package="(.+?)"/);
    if (m) packageName = m[1];
  }
}

if (!packageName) {
  process.stderr.write('ERROR: generate-autolinking-config: could not determine Android packageName\n');
  process.exit(1);
}

// ── Step 3: Build final config ────────────────────────────────────────────────
const androidDir = path.join(projectRoot, 'android');

if (!config) {
  config = {
    root: projectRoot,
    reactNativePath: path.dirname(require.resolve('react-native/package.json', { paths: [projectRoot] })),
    dependencies: {},
    project: {},
  };
}

config.project = config.project || {};
config.project.android = Object.assign(
  {
    sourceDir: androidDir,
    appName: 'app',
    packageName,
    applicationId: packageName,
    mainActivity: '.MainActivity',
  },
  config.project.android || {},
  { packageName }  // always last so it can't be overridden to null/empty
);

if (!config.reactNativeVersion) {
  try {
    config.reactNativeVersion = require(
      require.resolve('react-native/package.json', { paths: [projectRoot] })
    ).version;
  } catch (_) {
    config.reactNativeVersion = '0.79';
  }
}

process.stdout.write(JSON.stringify(config));
