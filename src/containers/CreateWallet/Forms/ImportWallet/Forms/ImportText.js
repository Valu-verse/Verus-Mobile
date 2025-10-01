/*
  Updated ImportText screen:
  - Top-aligned layout with left-aligned title (black) matching ChooseName.js
  - Modern multiline text input for seed/key with proper styling
  - Show/Hide toggle with icon for better UX
  - Removed "Scan QR" button as requested
  - Primary button matches design system (#CFEAF2 when disabled)
*/
import React, {useState} from 'react';
import {
  View,
  Dimensions,
  TouchableWithoutFeedback,
  TextInput as RNTextInput,
  Platform,
  Keyboard,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {Text, Button, IconButton} from 'react-native-paper';
import {createAlert} from '../../../../../actions/actions/alert/dispatchers/alert';
import TallButton from '../../../../../components/LargerButton';
import ScanSeed from '../../../../../components/ScanSeed';
import Colors from '../../../../../globals/colors';
import {SMALL_DEVICE_HEGHT} from '../../../../../utils/constants/constants';

export default function ImportText({
  qr,
  setImportedSeed,
  importedSeed,
  onComplete,
}) {
  const {height} = Dimensions.get('window');

  const [showSeed, setShowSeed] = useState(false);
  const [scanQr, setScanQr] = useState(qr === true);
  const [isFocused, setIsFocused] = useState(false);

  const handleScan = seed => {
    setScanQr(false);
    setImportedSeed(seed);
  };

  const handleImport = () => {
    if (!importedSeed || importedSeed.length < 1) {
      createAlert('Error', 'Please enter a seed, WIF key or spending key.');
    } else onComplete();
  };

  return scanQr ? (
    <ScanSeed cancel={() => setScanQr(false)} onScan={seed => handleScan(seed)} />
  ) : (
    <SafeAreaView style={{flex: 1, backgroundColor: Colors.secondaryColor}}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.secondaryColor,
            paddingHorizontal: 24,
            paddingTop: height < SMALL_DEVICE_HEGHT ? 40 : 60,
          }}>
          {/* Title - top-aligned, left-aligned, black */}
          <Text
            style={{
              textAlign: 'left',
              color: '#1A1A1A',
              fontSize: 32,
              fontWeight: '700',
              letterSpacing: -0.5,
              marginBottom: 12,
            }}>
            {'Import seed or key'}
          </Text>

          {/* Subtitle - left-aligned, improved typography */}
          <Text
            style={{
              textAlign: 'left',
              fontSize: 16,
              lineHeight: 22,
              color: '#555',
              marginBottom: 24,
            }}>
            {'Enter your 24-word seed or private key.'}
          </Text>

          {/* Input section */}
          <View style={{marginBottom: 16}}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#1A1A1A',
                }}>
                {'Seed or key'}
              </Text>
              {importedSeed && importedSeed.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowSeed(!showSeed)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  }}>
                  <IconButton
                    icon={showSeed ? 'eye-off' : 'eye'}
                    iconColor={Colors.primaryColor}
                    size={18}
                    style={{margin: 0}}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: Colors.primaryColor,
                      fontWeight: '600',
                    }}>
                    {showSeed ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <RNTextInput
              value={importedSeed}
              onChangeText={setImportedSeed}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Paste your seed phrase or key here..."
              placeholderTextColor="#999"
              returnKeyType="done"
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              secureTextEntry={!showSeed}
              multiline={showSeed && Platform.OS !== 'ios'}
              numberOfLines={showSeed && Platform.OS !== 'ios' ? 4 : 1}
              onSubmitEditing={handleImport}
              style={{
                minHeight: showSeed && Platform.OS !== 'ios' ? 120 : 56,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isFocused ? Colors.primaryColor : '#E0E0E0',
                paddingHorizontal: 16,
                paddingVertical: 16,
                fontSize: 16,
                color: '#1A1A1A',
                backgroundColor: '#FAFAFA',
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Spacer */}
          <View style={{flex: 1}} />

          {/* Import button */}
          <TallButton
            onPress={handleImport}
            mode="contained"
            labelStyle={[
              {
                color: Colors.secondaryColor,
                fontWeight: '600',
                fontSize: 18,
                letterSpacing: 0,
                textTransform: 'none',
              },
              (!importedSeed || importedSeed.length === 0) && {
                color: '#F0F9FC',
              },
            ]}
            contentStyle={{height: 56}}
            disabled={!importedSeed || importedSeed.length === 0}
            style={[
              {
                width: '100%',
                borderRadius: 24,
                backgroundColor: Colors.primaryColor,
                elevation: 0,
                shadowColor: 'transparent',
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: {width: 0, height: 0},
                marginBottom: 24,
              },
              (!importedSeed || importedSeed.length === 0) && {
                backgroundColor: '#CFEAF2',
              },
            ]}>
            {'Import'}
          </TallButton>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
