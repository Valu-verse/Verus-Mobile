/*
  Updated HomeFAB:
  - Keeps two floating rounded-rect buttons: "Buy & sell" (primary) and "Manage assets" (outlined)
  - Replaces the hidden FAB.Group overlay with a bottom sheet ManageAssetsSheet
  - ManageAssetsSheet mirrors Buy/Sell sheet styling and auto-closes on selection
*/
import * as React from 'react';
import { Platform, View } from 'react-native';
import { Portal, Button } from 'react-native-paper';
import Colors from '../../../globals/colors';
import ManageAssetsSheet from './ManageAssetsSheet';

const HomeFAB = (props) => {
  const {
    handleAddCoin,
    handleVerusPay,
    handleEditCards,
    showConfigureHomeCards,
    handleAddPbaasCurrency,
    handleAddErc20Token,
    handleOpenOnOffRamp,
  } = props;

  const [isManageOpen, setIsManageOpen] = React.useState(false);

  

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
        {/* Primary button on the left */}
        <Button
          mode="contained"
          onPress={handleOpenOnOffRamp}
          style={{
            borderRadius: 22,
            backgroundColor: Colors.primaryColor,
            width: 160,
            elevation: Platform.OS === 'android' ? 6 : 0,
            shadowColor: Colors.primaryColor,
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          }}
          contentStyle={{ height: 44 }}
          uppercase={false}
          labelStyle={{ color: Colors.secondaryColor, fontWeight: '600', fontSize: 14, letterSpacing: 0, textTransform: 'none' }}
        >
          Buy & sell
        </Button>

        {/* Secondary button on the right */}
        <Button
          mode="outlined"
          onPress={() => setIsManageOpen(true)}
          style={{
            borderRadius: 22,
            borderColor: Colors.primaryColor,
            borderWidth: 1,
            backgroundColor: Colors.secondaryColor,
            width: 160,
            elevation: Platform.OS === 'android' ? 4 : 0,
            shadowColor: Colors.quinaryColor,
            shadowOpacity: 0.1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
          contentStyle={{ height: 44 }}
          uppercase={false}
          labelStyle={{ color: Colors.primaryColor, fontWeight: '600', fontSize: 14, letterSpacing: 0, textTransform: 'none' }}
        >
          Manage assets
        </Button>
      </View>
      
      {/* Manage Assets Bottom Sheet */}
      <ManageAssetsSheet
        visible={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        showConfigureHomeCards={showConfigureHomeCards}
        onBrowseAll={handleAddCoin}
        onAddErc20={handleAddErc20Token}
        onAddPbaas={handleAddPbaasCurrency}
        onArrangeCards={handleEditCards}
      />
    </Portal>
  );
};

export default HomeFAB; 