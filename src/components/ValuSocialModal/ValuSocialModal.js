/*
  ValuSocialModal
  2026-01-23: Created custom modal for ValuSocial promotional content.
              Features edge-to-edge cover image with floating close button,
              descriptive text content, and primary action button linking to
              https://live.valuverse.io/auth
  2026-01-23: Fixed sheet visibility by giving the modal a fixed height and
              keeping the modal mounted so layout doesn't collapse.
  2026-01-23: Refined copy, sizing, and button layout based on feedback.
*/

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SemiModal from '../SemiModal';
import GradientButton from '../GradientButton';
import { openUrl } from '../../utils/linking';

const VALUVERSE_AUTH_URL = 'https://live.valuverse.io/auth';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = 280;
const MODAL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.8);

const ValuSocialModal = ({ visible, onClose }) => {
  const handleJoinPress = () => {
    openUrl(VALUVERSE_AUTH_URL);
    onClose();
  };

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        flexHeight={0.01}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.container}>
          {/* Cover Image with Floating Close Button */}
          <View style={styles.imageContainer}>
            <Image
              source={require('../../images/customIcons/valusocial.png')}
              style={styles.coverImage}
              resizeMode="cover"
            />
            {/* Floating Close Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              activeOpacity={0.7}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color="#111"
              />
            </TouchableOpacity>
          </View>

          {/* Content Section */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Valu Social: Your Social Universe</Text>
            <Text style={styles.description}>
              Explore VR rooms, connect with communities, chat, video call, and get AI
              assistance, all while owning your digital identity.
              {'\n'}
              {'\n'}
              Built for the crypto community, your data stays yours. Experience social
              media on your terms.
            </Text>
          </ScrollView>

          {/* Action Button */}
          <SafeAreaView edges={['bottom']} style={styles.buttonContainer}>
            <GradientButton
              onPress={handleJoinPress}
              style={styles.actionButton}
              rightIcon={(
                <MaterialCommunityIcons
                  name="open-in-new"
                  size={18}
                  color="#FFFFFF"
                />
              )}
            >
              Join Valu Social
            </GradientButton>
          </SafeAreaView>
        </View>
      </SemiModal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 0,
    flex: 0,
    alignSelf: 'flex-end',
    width: '100%',
    height: MODAL_HEIGHT,
    maxHeight: MODAL_HEIGHT,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444444',
    letterSpacing: 0.1,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
  },
});

export default ValuSocialModal;
