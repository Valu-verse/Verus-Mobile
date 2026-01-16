/*
  Updated HomeFAB:
  - Keeps two floating rounded-rect buttons: "Buy & sell" (primary) and "Manage assets" (outlined)
  - Replaces the hidden FAB.Group overlay with a bottom sheet ManageAssetsSheet
  - ManageAssetsSheet mirrors Buy/Sell sheet styling and auto-closes on selection
  - Removal of all elevation/shadows on buttons for a flat look
  - Added opaque white background and smooth gradient fade for scroll-under
  - Added promotional widgets (Proof of Personhood / Valu Social) above the button bar
*/
import * as React from 'react';
import { Platform, View } from 'react-native';
import { Portal, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Colors from '../../../globals/colors';
import WalletPromotionalWidgets from '../HomeWidgets/WalletPromotionalWidgets';
import GradientButton from '../../../components/GradientButton';

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
    hasValuProofOfPersonhood,
    onWidgetVisibilityChange,
  } = props;

  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 20);
  const gradientHeight = 48;

  return (
    <Portal>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {/* Gradient Fade */}
        <Svg height={gradientHeight} width="100%" style={{ marginBottom: -1 }}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={gradientHeight} fill="url(#grad)" />
        </Svg>

        {/* Opaque Background Container for Widgets & Buttons */}
        <View style={{ backgroundColor: '#FFFFFF' }}>
          {/* Promotional Widgets */}
          <WalletPromotionalWidgets 
            hasValuProofOfPersonhood={hasValuProofOfPersonhood} 
            onVisibilityChange={onWidgetVisibilityChange}
          />

          {/* Button Row */}
          <View
            style={{
              paddingTop: 10,
              paddingBottom: bottomPadding,
              flexDirection: 'row',
              justifyContent: 'space-evenly',
              paddingHorizontal: 16,
            }}
          >
            {/* Secondary Transfer button on the left */}
            <Button
              mode="contained"
              onPress={typeof handleTransfer === 'function' ? handleTransfer : () => {}}
              style={{
                borderRadius: 22,
                borderWidth: 0,
                backgroundColor: '#EBF6FF',
                width: 160,
                elevation: 0,
                shadowColor: 'transparent',
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
              }}
              buttonColor="#EBF6FF"
              textColor={Colors.primaryColor}
              contentStyle={{ height: 44 }}
              uppercase={false}
              labelStyle={{ color: Colors.primaryColor, fontWeight: '700', fontSize: 16, letterSpacing: 0, textTransform: 'none' }}
            >
              Transfer
            </Button>

            {/* Primary Buy & sell button on the right */}
            <GradientButton
              onPress={handleOpenOnOffRamp}
              style={{
                width: 160,
                height: 44,
                borderRadius: 22,
              }}
            >
              Buy & sell
            </GradientButton>
          </View>
        </View>
      </View>
    </Portal>
  );
};

export default HomeFAB;
