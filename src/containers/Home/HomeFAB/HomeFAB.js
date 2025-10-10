/*
  Updated HomeFAB:
  - Keeps two floating rounded-rect buttons: "Buy & sell" (primary) and "Manage assets" (outlined)
  - Replaces the hidden FAB.Group overlay with a bottom sheet ManageAssetsSheet
  - ManageAssetsSheet mirrors Buy/Sell sheet styling and auto-closes on selection
  - Removal of all elevation/shadows on buttons for a flat look
*/
import * as React from 'react';
import { Platform, View } from 'react-native';
import { Portal, Button } from 'react-native-paper';
import Colors from '../../../globals/colors';

const HomeFAB = (props) => {
  const {
    handleAddCoin,
    handleVerusPay,
    handleEditCards,
    showConfigureHomeCards,
    handleAddPbaasCurrency,
    handleAddErc20Token,
    handleOpenOnOffRamp,
    handleTransfer,
  } = props;

  

  return (
    <Portal>
      {/* Floating action buttons row */}
      <View
        pointerEvents={'auto'}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 34,
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          paddingHorizontal: 16,
        }}
      >
        {/* Secondary Transfer button on the left */}
        <Button
          mode="outlined"
          onPress={typeof handleTransfer === 'function' ? handleTransfer : () => {}}
          style={{
            borderRadius: 22,
            borderColor: Colors.primaryColor,
            borderWidth: 1,
            backgroundColor: Colors.secondaryColor,
            width: 160,
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
          }}
          contentStyle={{ height: 44 }}
          uppercase={false}
          labelStyle={{ color: Colors.primaryColor, fontWeight: '700', fontSize: 16, letterSpacing: 0, textTransform: 'none' }}
        >
          Transfer
        </Button>

        {/* Primary Buy & sell button on the right */}
        <Button
          mode="contained"
          onPress={handleOpenOnOffRamp}
          style={{
            borderRadius: 22,
            backgroundColor: Colors.primaryColor,
            width: 160,
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
          }}
          contentStyle={{ height: 44 }}
          uppercase={false}
          labelStyle={{ color: Colors.secondaryColor, fontWeight: '700', fontSize: 16, letterSpacing: 0, textTransform: 'none', textAlign: 'center' }}
        >
          Buy & sell
        </Button>
      </View>
      
      {/* Manage Assets Bottom Sheet removed from Dashboard */}
    </Portal>
  );
};

export default HomeFAB; 