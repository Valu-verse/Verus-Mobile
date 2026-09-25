import React from 'react';
import {View, Dimensions} from 'react-native';
import {Text, Button} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {TwentyFourWordIcon, ScanQrIcon, EnterKeyIcon} from '../../../../../images/customIcons';
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
        <Button
          icon={({ size, color }) => (
            <TwentyFourWordIcon
              width={size + 10}
              height={size + 10}
            />
          )}
          labelStyle={{
            fontSize: 16,
            fontWeight: "bold"
          }}
          contentStyle={{
            height: 80,
            width: 300,
            justifyContent: "flex-start",
            paddingLeft: 16,
          }}
          style={{
            borderColor: Colors.primaryColor,
            marginTop: 8
          }}
          mode="outlined"
          onPress={() => navigation.navigate("ImportSeed")}>
          {"Import 24-word seed"}
        </Button>
        <Button
          icon={({ size, color }) => (
            <ScanQrIcon
              width={size + 10}
              height={size + 10}
            />
          )}
          labelStyle={{
            fontSize: 16,
            fontWeight: "bold"
          }}
          contentStyle={{
            height: 80,
            width: 300,
            justifyContent: "flex-start",
            paddingLeft: 16,
          }}
          style={{
            borderColor: Colors.primaryColor,
            marginTop: 8
          }}
          mode="outlined"
          onPress={() => navigation.navigate("ScanQr")}>
          {"Scan QR-Code"}
        </Button>
        <Button
          icon={({size, color}) => (
            <MaterialCommunityIcons
              name="credit-card-wireless"
              size={size + 10}
              color={color}
            />
          )}
          labelStyle={{
            fontSize: 16,
            fontWeight: "bold"
          }}
          contentStyle={{
            height: 80,
            width: 300,
            justifyContent: "flex-start",
            paddingLeft: 16,
          }}
          style={{
            borderColor: Colors.primaryColor,
            marginTop: 8
          }}
          mode="outlined"
          onPress={() => navigation.navigate("ImportNfc")}>
          {"Import using NFC"}
        </Button>
        <Button
          icon={({ size, color }) => (
            <EnterKeyIcon
              width={size + 10}
              height={size + 10}
            />
          )}
          labelStyle={{
            fontSize: 16,
            fontWeight: "bold"
          }}
          contentStyle={{
            height: 80,
            width: 300,
            justifyContent: "flex-start",
            paddingLeft: 16,
          }}
          style={{
            borderColor: Colors.primaryColor,
            marginTop: 8
          }}
          mode="outlined"
          onPress={() => navigation.navigate("ImportText")}>
          {"Enter Key/Seed"}
        </Button>
      </View>
    </SafeAreaView>
  );
}
