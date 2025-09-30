import React from 'react';
import {View, Dimensions, SafeAreaView} from 'react-native';
import {Text, List} from 'react-native-paper';
import Colors from '../../../../../globals/colors';

export default function ImportIntro({navigation, label}) {
  const {height} = Dimensions.get('window');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.secondaryColor }}>
      <View style={{ flex: 1, backgroundColor: Colors.secondaryColor, paddingHorizontal: 24, paddingTop: 40 }}>
        <Text style={{ textAlign: 'left', color: '#1A1A1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 12 }}>
          {label ? label : 'Import your wallet'}
        </Text>
        <Text style={{ textAlign: 'left', fontSize: 16, lineHeight: 22, color: '#555', marginBottom: 24 }}>
          {'Choose how you want to bring an existing wallet into this profile.'}
        </Text>

        {/* Options styled like BuySellSheet choices */}
        <View style={{ paddingBottom: 12 }}>
          <List.Item
            title="Import 24‑word seed"
            description="Enter your BIP39 recovery phrase"
            onPress={() => navigation.navigate('ImportSeed')}
            left={(props) => (
              <List.Icon {...props} icon="script-text-outline" color={'black'} />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
            descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
            style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
          />

          <List.Item
            title="Scan QR code"
            description="Scan a wallet QR to import"
            onPress={() => navigation.navigate('ScanQr')}
            left={(props) => (
              <List.Icon {...props} icon="qrcode-scan" color={'black'} />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
            descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
            style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
          />

          <List.Item
            title="Enter key or seed text"
            description="Paste a private key or seed manually"
            onPress={() => navigation.navigate('ImportText')}
            left={(props) => (
              <List.Icon {...props} icon="key-variant" color={'black'} />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
            descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
            style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
          />
        </View>

        <View style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}
