/*
  Updated DrawerHeader:
  - Keep white background; remove all branding/logo content
  - Retain spacing for a clean, minimal header area
*/
import React from 'react';
import { 
  View, 
  TouchableOpacity,
	SafeAreaView,
} from 'react-native';
import Colors from '../globals/colors';

const DrawerHeader = ({ navigateToScreen }) => (
  <TouchableOpacity onPress={() => navigateToScreen("Home")}>
    <SafeAreaView
      style={{
        backgroundColor: Colors.secondaryColor,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: Colors.secondaryColor,
          paddingLeft: 20,
					paddingBottom: 24,
          paddingTop: 24,
          alignItems: "center",
        }}
      >
        {/* Intentionally blank to keep a minimal, unbranded header */}
      </View>
    </SafeAreaView>
  </TouchableOpacity>
);

export default DrawerHeader;
