#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const shouldOpenMetroTerminal = process.argv.includes('--with-metro-terminal');
const shouldRunAndroid = process.argv.includes('--run-android') || shouldOpenMetroTerminal;

function commandExists(command) {
  try {
    if (path.isAbsolute(command)) {
      fs.accessSync(command, fs.constants.X_OK);
      return true;
    }

    const probe = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${probe} ${command}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function getSdkCandidates() {
  const homeDir = os.homedir();
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === 'linux' ? path.join(homeDir, 'Android', 'Sdk') : '',
    process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Android', 'sdk') : '',
    process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
      : '',
  ];

  return candidates.filter((entry, index, list) => entry && list.indexOf(entry) === index);
}

function resolveAndroidTool(relativePath, commandName) {
  for (const sdkRoot of getSdkCandidates()) {
    const candidate = path.join(sdkRoot, relativePath);
    if (commandExists(candidate)) {
      return candidate;
    }

    if (process.platform === 'win32' && commandExists(`${candidate}.exe`)) {
      return `${candidate}.exe`;
    }
  }

  if (commandExists(commandName)) {
    return commandName;
  }

  if (process.platform === 'win32' && commandExists(`${commandName}.exe`)) {
    return `${commandName}.exe`;
  }

  return '';
}

const emulatorPath = resolveAndroidTool(path.join('emulator', 'emulator'), 'emulator');
const adbPath = resolveAndroidTool(path.join('platform-tools', 'adb'), 'adb');

function normalizeAvdName(rawValue) {
  return rawValue
    .trim()
    .replace(/\.avd$/i, '');
}

function parseAvdManagerOutput(text) {
  const names = [];
  const regex = /^\s*Name:\s*(.+)$/gm;
  let match;

  while ((match = regex.exec(text)) !== null) {
    names.push(normalizeAvdName(match[1]));
  }

  return names;
}

function getAvdDirectories() {
  const homeDir = os.homedir();
  const candidates = [
    process.env.ANDROID_AVD_HOME,
    path.join(homeDir, '.android', 'avd'),
    path.join(homeDir, '.config', '.android', 'avd'),
    path.join(homeDir, '.var', 'app', 'com.google.AndroidStudio', 'config', '.android', 'avd'),
    path.join(homeDir, '.var', 'app', 'com.google.AndroidStudio', 'cache', '.android', 'avd'),
    path.join(homeDir, '.local', 'share', 'Google', 'AndroidStudio', 'avd'),
  ];

  return candidates.filter((entry, index, list) => entry && list.indexOf(entry) === index);
}

function getAvdsFromDirectory() {
  const names = [];

  for (const directory of getAvdDirectories()) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    const files = fs.readdirSync(directory);
    for (const file of files) {
      if (file.toLowerCase().endsWith('.ini')) {
        names.push(normalizeAvdName(file.replace(/\.ini$/i, '')));
      }
    }
  }

  return names;
}

function getAvdHomeForName(avdName) {
  for (const directory of getAvdDirectories()) {
    const iniFile = path.join(directory, `${avdName}.ini`);
    if (fs.existsSync(iniFile)) {
      return directory;
    }
  }

  return '';
}

function uniqueValues(values) {
  return values.filter((value, index, list) => value && list.indexOf(value) === index);
}

function spawnDetached(command, args, env = process.env) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    cwd: projectRoot,
    env,
  });

  child.unref();
}

function hasCommand(command) {
  return commandExists(command);
}

function openMetroInTerminal() {
  const metroCommand = `cd "${projectRoot}" && npx react-native start`;

  if (process.platform === 'win32') {
    spawnDetached('cmd', ['/c', 'start', '"Metro"', 'cmd', '/k', `cd /d "${projectRoot}" && npx react-native start`]);
    console.log('🚇 Starting Metro in default Windows terminal');
    return true;
  }

  if (process.platform === 'darwin' && hasCommand('osascript')) {
    const escaped = metroCommand.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    spawnDetached('osascript', ['-e', `tell application "Terminal" to do script "${escaped}"`]);
    console.log('🚇 Starting Metro in Terminal.app');
    return true;
  }

  if (process.platform === 'linux' && hasCommand('xdg-terminal-exec')) {
    spawnDetached('xdg-terminal-exec', ['bash', '-lc', metroCommand]);
    console.log('🚇 Starting Metro in system default terminal');
    return true;
  }

  const terminalCandidates = [
    { command: process.env.REACT_NATIVE_TERMINAL, args: ['--', 'bash', '-lc', metroCommand] },
    { command: 'gnome-terminal', args: ['--', 'bash', '-lc', metroCommand] },
    { command: 'kgx', args: ['--', 'bash', '-lc', metroCommand] },
    { command: 'konsole', args: ['-e', 'bash', '-lc', metroCommand] },
    { command: 'xfce4-terminal', args: ['-x', 'bash', '-lc', metroCommand] },
    { command: 'xterm', args: ['-e', 'bash', '-lc', metroCommand] },
  ].filter((entry, index, list) => entry.command && list.findIndex((item) => item.command === entry.command) === index);

  for (const terminal of terminalCandidates) {
    if (!hasCommand(terminal.command)) {
      continue;
    }

    spawnDetached(terminal.command, terminal.args);
    console.log(`🚇 Starting Metro in ${terminal.command}`);
    return true;
  }

  return false;
}

function startMetroInBackground() {
  const logsDir = path.join(projectRoot, '.logs');
  const outFile = path.join(logsDir, 'metro.log');

  fs.mkdirSync(logsDir, { recursive: true });
  const outputFd = fs.openSync(outFile, 'a');

  const child = spawn('npx', ['react-native', 'start'], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', outputFd, outputFd],
  });

  child.unref();
  console.log(`🚇 Starting Metro in background (logs: ${path.relative(projectRoot, outFile)})`);
}

function runAndroidApp() {
  return new Promise((resolve, reject) => {
    console.log('📦 Building and launching Android app...');

    const child = spawn('npx', [
      'react-native',
      'run-android',
      '--main-activity',
      'SplashActivity',
      '--no-packager',
    ], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`react-native run-android exited with code ${code}`));
      }
    });
  });
}

// Check if an emulator is already running
function isEmulatorRunning() {
  try {
    if (!adbPath) {
      return false;
    }

    const devices = execSync(`"${adbPath}" devices`, { encoding: 'utf8' });
    const lines = devices.split('\n').filter(line => line.includes('emulator'));
    return lines.some(line => line.includes('device') && !line.includes('offline'));
  } catch (error) {
    return false;
  }
}

// Get list of available AVDs
function getAvailableAvds() {
  const collected = [];

  try {
    if (emulatorPath) {
      const avds = execSync(`"${emulatorPath}" -list-avds`, { encoding: 'utf8' });
      collected.push(...avds.trim().split('\n').filter(Boolean).map(normalizeAvdName));
    }
  } catch (error) {
    console.warn('⚠️ `emulator -list-avds` failed:', error.message);
  }

  try {
    const avdmanagerPath = resolveAndroidTool(path.join('cmdline-tools', 'latest', 'bin', 'avdmanager'), 'avdmanager');
    if (avdmanagerPath) {
      const output = execSync(`"${avdmanagerPath}" list avd`, { encoding: 'utf8' });
      collected.push(...parseAvdManagerOutput(output));
    }
  } catch (error) {
    console.warn('⚠️ `avdmanager list avd` failed:', error.message);
  }

  collected.push(...getAvdsFromDirectory());
  return uniqueValues(collected);
}

// Wait for emulator to be fully booted
function waitForEmulator(timeout = 120000) {
  console.log('⏳ Waiting for emulator to boot...');
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      try {
        const bootComplete = execSync(`"${adbPath}" shell getprop sys.boot_completed`, { 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        
        if (bootComplete === '1') {
          clearInterval(checkInterval);
          console.log('✅ Emulator is ready!');
          resolve();
        }
      } catch (error) {
        // Emulator not ready yet, continue waiting
      }

      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for emulator to boot'));
      }
    }, 2000);
  });
}

async function startEmulator() {
  if (process.env.SKIP_EMULATOR_START === '1') {
    console.log('ℹ️ Skipping emulator startup (SKIP_EMULATOR_START=1)');
    return;
  }

  if (!emulatorPath || !adbPath) {
    console.error('❌ Could not find Android emulator/adb tools. Install Android SDK and ensure emulator + platform-tools are available.');
    process.exit(1);
  }

  // Check if emulator is already running
  if (isEmulatorRunning()) {
    console.log('✅ Emulator is already running');
  } else {
    console.log('🚀 Starting emulator...');

    // Get available AVDs
    const avds = getAvailableAvds();

    if (avds.length === 0) {
      console.error('❌ No AVDs found. Checked emulator, avdmanager, and common AVD directories.');
      console.error('   If Android Studio can run an AVD, set AVD_NAME explicitly, e.g. `AVD_NAME=Your_AVD_Name yarn start`');
      process.exit(1);
    }

    const avdName = process.env.AVD_NAME || avds[0];
    console.log(`📱 Starting AVD: ${avdName}`);

    const avdHome = process.env.ANDROID_AVD_HOME || getAvdHomeForName(avdName);
    if (avdHome) {
      console.log(`📂 Using AVD directory: ${avdHome}`);
    }

    // Start emulator in background
    const emulator = spawn(emulatorPath, ['-avd', avdName], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        ...(avdHome ? { ANDROID_AVD_HOME: avdHome } : {}),
      },
    });

    emulator.unref();

    // Wait for emulator to boot
    try {
      await waitForEmulator();
    } catch (error) {
      console.error('❌', error.message);
      process.exit(1);
    }
  }

  if (shouldOpenMetroTerminal) {
    const openedTerminal = openMetroInTerminal();
    if (!openedTerminal) {
      startMetroInBackground();
    }
  }

  if (shouldRunAndroid) {
    try {
      await runAndroidApp();
    } catch (error) {
      console.error('❌ Android run failed:', error.message);
      process.exit(1);
    }
  }
}

startEmulator().catch(error => {
  console.error('❌ Failed to start emulator:', error);
  process.exit(1);
});
