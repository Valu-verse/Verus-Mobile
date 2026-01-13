#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

const ANDROID_HOME = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

if (!ANDROID_HOME) {
  console.error('❌ ANDROID_HOME or ANDROID_SDK_ROOT not set');
  process.exit(1);
}

const emulatorPath = path.join(ANDROID_HOME, 'emulator', 'emulator');
const adbPath = path.join(ANDROID_HOME, 'platform-tools', 'adb');

// Check if an emulator is already running
function isEmulatorRunning() {
  try {
    const devices = execSync(`"${adbPath}" devices`, { encoding: 'utf8' });
    const lines = devices.split('\n').filter(line => line.includes('emulator'));
    return lines.some(line => line.includes('device') && !line.includes('offline'));
  } catch (error) {
    return false;
  }
}

// Get list of available AVDs
function getAvailableAvds() {
  try {
    const avds = execSync(`"${emulatorPath}" -list-avds`, { encoding: 'utf8' });
    return avds.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('❌ Failed to list AVDs:', error.message);
    return [];
  }
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
  // Check if emulator is already running
  if (isEmulatorRunning()) {
    console.log('✅ Emulator is already running');
    return;
  }

  console.log('🚀 Starting emulator...');

  // Get available AVDs
  const avds = getAvailableAvds();
  
  if (avds.length === 0) {
    console.error('❌ No AVDs found. Please create one using Android Studio.');
    process.exit(1);
  }

  const avdName = process.env.AVD_NAME || avds[0];
  console.log(`📱 Starting AVD: ${avdName}`);

  // Start emulator in background
  const emulator = spawn(emulatorPath, ['-avd', avdName], {
    detached: true,
    stdio: 'ignore'
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

startEmulator().catch(error => {
  console.error('❌ Failed to start emulator:', error);
  process.exit(1);
});
