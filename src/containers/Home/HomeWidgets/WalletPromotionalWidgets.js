/*
  WalletPromotionalWidgets
  2026-01-23: Updated ValuSocial widget to open ValuSocialModal instead of navigating
              to a separate screen.
  2026-01-23: Implemented 30-day dismissal system with profile-specific storage.
              Widgets dismissed via X button stay hidden for 30 days per account.
*/

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList, Dimensions, LayoutAnimation, UIManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { VALU_SERVICE_ID } from '../../../utils/constants/services';
import ValuSocialModal from '../../../components/ValuSocialModal/ValuSocialModal';
import { requestAttestationData } from '../../../utils/auth/authBox';
import { ATTESTATIONS_PROVISIONED } from '../../../utils/constants/attestations';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY_PREFIX = 'wallet_promo';
const WIDGET_ATTESTATION = 'attestation';
const WIDGET_SOCIAL = 'social';
const WIDGET_USDC = 'usdc';
const WIDGET_DUMMY = 'dummy';
const DISMISSAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const CARD_HEIGHT = 100;
const CARD_SPACING = 12;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTAINER_PADDING = 16;

// Calculate card width to allow peeking
// Width = (Total Width - Padding - Spacing) / 2.2 (show ~2.2 cards)
const CARD_WIDTH = (SCREEN_WIDTH - (CONTAINER_PADDING * 2) - CARD_SPACING) / 2.2;

// Helper functions for AsyncStorage
const getStorageKey = (accountHash, widgetId) => 
  `${STORAGE_KEY_PREFIX}_${accountHash}_${widgetId}_dismissed_at`;

const saveDismissalTimestamp = async (accountHash, widgetId) => {
  if (!accountHash) return;
  try {
    const timestamp = Date.now().toString();
    const key = getStorageKey(accountHash, widgetId);
    await AsyncStorage.setItem(key, timestamp);
  } catch (error) {
    console.error('Error saving widget dismissal:', error);
  }
};

const loadDismissalTimestamp = async (accountHash, widgetId) => {
  if (!accountHash) return null;
  try {
    const key = getStorageKey(accountHash, widgetId);
    const timestamp = await AsyncStorage.getItem(key);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    console.error('Error loading widget dismissal:', error);
    return null;
  }
};

const clearDismissalTimestamp = async (accountHash, widgetId) => {
  if (!accountHash) return;
  try {
    const key = getStorageKey(accountHash, widgetId);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing widget dismissal:', error);
  }
};

const isWithinDismissalPeriod = (timestamp) => {
  if (!timestamp) return false;
  const now = Date.now();
  const elapsed = now - timestamp;
  return elapsed < DISMISSAL_DURATION_MS;
};

const WalletPromotionalWidgets = ({ hasValuProofOfPersonhood, onVisibilityChange }) => {
  const navigation = useNavigation();
  const activeAccount = useSelector((state) => state.authentication.activeAccount);
  const attestation = useSelector((state) => state.attestation);
  const activeCoinsForUser = useSelector((state) => state.coins.activeCoinsForUser);
  const accountHash = activeAccount?.accountHash ?? null;
  
  const [dismissedWidgets, setDismissedWidgets] = useState({
    [WIDGET_ATTESTATION]: true,
    [WIDGET_SOCIAL]: true,
    [WIDGET_USDC]: true,
    [WIDGET_DUMMY]: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [valuSocialModalVisible, setValuSocialModalVisible] = useState(false);
  const [valuProofOfPersonhoodAttestation, setValuProofOfPersonhoodAttestation] = useState(null);

  // Load the Proof of Personhood attestation when available
  useEffect(() => {
    const loadProofOfPersonhood = async () => {
      if (hasValuProofOfPersonhood && attestation?.attestations_provisioned) {
        try {
          const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
          if (attestationData) {
            const valuAttestation = Object.values(attestationData).find(item => 
              item && typeof item === 'object' && item.name === "Valu Proof of Personhood"
            );
            setValuProofOfPersonhoodAttestation(valuAttestation || null);
          }
        } catch (e) {
          console.warn('Could not load attestation:', e.message);
        }
      } else {
        setValuProofOfPersonhoodAttestation(null);
      }
    };
    loadProofOfPersonhood();
  }, [hasValuProofOfPersonhood, attestation]);

  useEffect(() => {
    const loadDismissalStates = async () => {
      if (!accountHash) {
        // No account logged in, show all widgets
        setDismissedWidgets({
          [WIDGET_ATTESTATION]: false,
          [WIDGET_SOCIAL]: false,
          [WIDGET_USDC]: false,
          [WIDGET_DUMMY]: false,
        });
        setLoaded(true);
        if (onVisibilityChange) onVisibilityChange(true);
        return;
      }

      // Load dismissal timestamps for each widget
      const widgetIds = [WIDGET_ATTESTATION, WIDGET_SOCIAL, WIDGET_USDC, WIDGET_DUMMY];
      const newState = {};

      for (const widgetId of widgetIds) {
        const timestamp = await loadDismissalTimestamp(accountHash, widgetId);
        
        if (timestamp && isWithinDismissalPeriod(timestamp)) {
          // Still within 30-day dismissal period
          newState[widgetId] = true;
        } else {
          // Either never dismissed or 30 days have passed
          newState[widgetId] = false;
          
          // Clear expired timestamp if it exists
          if (timestamp) {
            await clearDismissalTimestamp(accountHash, widgetId);
          }
        }
      }

      setDismissedWidgets(newState);
      setLoaded(true);
      
      // Notify parent of visibility
      const visibleCount = Object.values(newState).filter(d => !d).length;
      if (onVisibilityChange) onVisibilityChange(visibleCount > 0);
    };

    loadDismissalStates();
  }, [accountHash]);

  // Dismisses widget for 30 days (profile-specific)
  const handleDismiss = async (widgetKey) => {
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
    
    // Update UI state
    setDismissedWidgets(prev => {
      const newState = { ...prev, [widgetKey]: true };
      const visibleCount = Object.values(newState).filter(d => !d).length;
      if (onVisibilityChange) onVisibilityChange(visibleCount > 0);
      return newState;
    });

    // Save dismissal timestamp to storage (30-day timer starts now)
    await saveDismissalTimestamp(accountHash, widgetKey);
  };

  // True when the user has Ethereum USDC active in their wallet
  const hasUsdcEth = Array.isArray(activeCoinsForUser) && activeCoinsForUser.some((c) => c.id === 'USDC');

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
      action: () => {
        // If user has Proof of Personhood, navigate directly to view it
        if (hasValuProofOfPersonhood && valuProofOfPersonhoodAttestation) {
          navigation.navigate('ViewAttestation', { attestation: valuProofOfPersonhoodAttestation });
        } else {
          navigation.navigate('Service', {
            service: VALU_SERVICE_ID,
            subScreen: 'attestation'
          });
        }
      },
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
      action: () => setValuSocialModalVisible(true),
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
      id: WIDGET_USDC,
      text: "Bridge your USDC\nto Verus",
      action: () => navigation.navigate('SendWizard'),
      background: (
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="usdcGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2775CA" />
              <Stop offset="1" stopColor="#1A4F8F" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#usdcGradient)" rx={12} ry={12} />
        </Svg>
      )
    },
    {
      id: WIDGET_DUMMY,
      text: "Stay tuned\nfor more...",
      action: () => {},
      background: (
        <View style={{ flex: 1, backgroundColor: '#E0E0E0' }} />
      )
    }
  ].filter(w => !dismissedWidgets[w.id] && (w.id !== WIDGET_USDC || hasUsdcEth));

  if (widgets.length === 0) {
    return (
      <ValuSocialModal
        visible={valuSocialModalVisible}
        onClose={() => setValuSocialModalVisible(false)}
      />
    );
  }

  return (
    <>
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
      <ValuSocialModal
        visible={valuSocialModalVisible}
        onClose={() => setValuSocialModalVisible(false)}
      />
    </>
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
