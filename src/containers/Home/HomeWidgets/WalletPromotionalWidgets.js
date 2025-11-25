import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList, Dimensions, LayoutAnimation, UIManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { VALU_SERVICE_ID } from '../../../utils/constants/services';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY_PREFIX = 'wallet_promo_widget_dismissed_';
const WIDGET_ATTESTATION = 'attestation';
const WIDGET_SOCIAL = 'social';
const WIDGET_DUMMY = 'dummy';

const CARD_HEIGHT = 100;
const CARD_SPACING = 12;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTAINER_PADDING = 16;

// Calculate card width to allow peeking
// Width = (Total Width - Padding - Spacing) / 2.2 (show ~2.2 cards)
const CARD_WIDTH = (SCREEN_WIDTH - (CONTAINER_PADDING * 2) - CARD_SPACING) / 2.2;

const WalletPromotionalWidgets = ({ hasValuProofOfPersonhood, onVisibilityChange }) => {
  const navigation = useNavigation();
  const [dismissedWidgets, setDismissedWidgets] = useState({
    [WIDGET_ATTESTATION]: true,
    [WIDGET_SOCIAL]: true,
    [WIDGET_DUMMY]: true,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Always reset state to show widgets when component mounts (e.g., new session/sign-in)
    const newState = {
      [WIDGET_ATTESTATION]: false,
      [WIDGET_SOCIAL]: false,
      [WIDGET_DUMMY]: false,
    };
    
    setDismissedWidgets(newState);
    setLoaded(true);
    
    if (onVisibilityChange) onVisibilityChange(true);
  }, []);

  // This handles per-session dismissal (in memory only)
  const handleDismiss = (widgetKey) => {
    // Configure layout animation with a spring for more dynamic movement
    LayoutAnimation.configureNext({
      duration: 500,
      create: {
        type: LayoutAnimation.Types.spring,
        property: LayoutAnimation.Properties.scaleXY,
        springDamping: 0.6,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.5, // More bounce
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.scaleXY, // Shrink away instead of fade
        duration: 200,
      },
    });
    
    setDismissedWidgets(prev => {
      const newState = { ...prev, [widgetKey]: true };
      const visibleCount = Object.values(newState).filter(d => !d).length;
      if (onVisibilityChange) onVisibilityChange(visibleCount > 0);
      return newState;
    });
  };

  const attestationText = hasValuProofOfPersonhood
    ? 'View my Proof of Personhood'
    : 'Get your Proof of Personhood';

  const renderItem = ({ item }) => {
    return (
      <View style={[styles.cardContainer, { width: CARD_WIDTH }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.card}
          onPress={item.action}
        >
          <View style={styles.cardBackground} pointerEvents="none">
            {item.background}
          </View>
          <Text style={styles.cardText}>{item.text}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          onPress={() => handleDismiss(item.id)}
        >
          <View style={styles.closeCircle}>
            <MaterialCommunityIcons name="close" size={14} color="#666" />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (!loaded) return null;

  const widgets = [
    {
      id: WIDGET_ATTESTATION,
      text: attestationText,
      action: () => navigation.navigate('Service', {
        service: VALU_SERVICE_ID,
        subScreen: 'attestation'
      }),
      background: (
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="valuGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#00C8FF" />
              <Stop offset="1" stopColor="#0077A9" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#valuGradient)" rx={12} ry={12} />
        </Svg>
      )
    },
    {
      id: WIDGET_SOCIAL,
      text: "Immerse yourself\nin Valu Social",
      action: () => navigation.navigate('ValuSocial'),
      background: (
        <>
          <Image
            source={require('../../../images/customIcons/valusocial.png')}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="socialGradient" x1="0" y1="0.5" x2="0" y2="1">
                <Stop offset="0" stopColor="black" stopOpacity="0" />
                <Stop offset="0.8" stopColor="black" stopOpacity="0.6" />
                <Stop offset="1" stopColor="black" stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#socialGradient)" />
          </Svg>
        </>
      )
    },
    {
      id: WIDGET_DUMMY,
      text: "Future Promo\nComing Soon",
      action: () => {},
      background: (
        <View style={{ flex: 1, backgroundColor: '#E0E0E0' }} />
      )
    }
  ].filter(w => !dismissedWidgets[w.id]);

  if (widgets.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={widgets}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        snapToAlignment="start"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  cardContainer: {
    height: CARD_HEIGHT,
    position: 'relative',
    marginTop: 8, 
  },
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 12,
    justifyContent: 'flex-end',
    backgroundColor: '#F5F5F5',
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 10,
  },
  closeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E6E6',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default WalletPromotionalWidgets;
