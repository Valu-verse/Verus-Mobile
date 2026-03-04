#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

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

function resolveAdbPath() {
  for (const sdkRoot of getSdkCandidates()) {
    const candidate = path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (commandExists(candidate)) {
      return candidate;
    }
  }

  if (commandExists('adb')) {
    return 'adb';
  }

  if (process.platform === 'win32' && commandExists('adb.exe')) {
    return 'adb.exe';
  }

  return '';
}

function getRunningEmulators(adbPath) {
  const output = execSync(`"${adbPath}" devices`, { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith('emulator-'))
    .map((line) => line.split(/\s+/)[0]);
}

function stopEmulators() {
  const adbPath = resolveAdbPath();

  if (!adbPath) {
    console.error('❌ Could not find adb. Set ANDROID_HOME/ANDROID_SDK_ROOT or add platform-tools to PATH.');
    process.exit(1);
  }

  let emulators = [];
  try {
    emulators = getRunningEmulators(adbPath);
  } catch (error) {
    console.error('❌ Failed to query adb devices:', error.message);
    process.exit(1);
  }

  if (emulators.length === 0) {
    console.log('ℹ️ No running emulator found.');
    return;
  }

  for (const serial of emulators) {
    try {
      execSync(`"${adbPath}" -s ${serial} emu kill`, { stdio: 'ignore' });
      console.log(`🛑 Stopped ${serial}`);
    } catch (error) {
      console.error(`❌ Failed to stop ${serial}: ${error.message}`);
    }
  }
}

stopEmulators();
