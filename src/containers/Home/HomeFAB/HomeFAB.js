/*
  Updated HomeFAB:
  - Replaces single circular FAB with two floating rounded-rect buttons
    • "Add currency" (outlined/secondary) opens the same FAB.Group actions overlay
    • "Buy & sell" (primary) currently no-op placeholder
  - Keeps FAB.Group for overlay/backdrop + actions, hides its anchor
*/
import * as React from 'react';
import { Platform, View } from 'react-native';
import { FAB, Portal, Button } from 'react-native-paper';
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
  } = props;

  const [state, setState] = React.useState({ open: false });

  const onStateChange = ({ open }) => setState({ open });

  const { open } = state;

  const actions = !showConfigureHomeCards
      ? [
          {
            icon: 'format-list-bulleted',
            label: 'Browse all',
            onPress: handleAddCoin,
          },
          {
            icon: 'rocket-launch',
            label: 'Add ERC-20 token',
            onPress: handleAddErc20Token,
          },
          {
            icon: 'rocket-launch',
            label: 'Add ecosystem currency',
            onPress: handleAddPbaasCurrency,
          }
        ]
      : [
          {
            icon: 'swap-horizontal-variant',
            label: 'Arrange cards',
            onPress: handleEditCards,
          },
          {
            icon: 'format-list-bulleted',
            label: 'Browse all',
            onPress: handleAddCoin,
          },
          {
            icon: 'ethereum',
            label: 'Add ERC-20 token',
            onPress: handleAddErc20Token,
          },
          {
            icon: 'rocket-launch',
            label: 'Add ecosystem currency',
            onPress: handleAddPbaasCurrency,
          },
        ];

  return (
    <Portal>
      {/* Hidden anchor, still provides overlay + actions when state.open = true */}
      <FAB.Group
        fabStyle={{
          backgroundColor: Colors.primaryColor,
          opacity: 0, // Hide anchor while preserving overlay/actions behavior
        }}
        open={open}
        icon={open ? "minus" : "plus"}
        actions={actions}
        onStateChange={onStateChange}
      />

      {/* Floating action buttons row */}
      <View
        pointerEvents={open ? 'none' : 'auto'}
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
          onPress={() => setState({ open: true })}
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
          Manage coins
        </Button>
      </View>
    </Portal>
  );
};

export default HomeFAB; 