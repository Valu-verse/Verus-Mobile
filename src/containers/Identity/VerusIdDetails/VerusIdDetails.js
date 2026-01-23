/*
  VerusIdDetails
  - 2026-01-23: Created new full-screen VerusID detail view to replace the bottom sheet modal.
    Displays identity information using VerusIdObjectData component and shows attestations
    linked to this specific VerusID. Uses React Navigation header with Back button matching
    SendWizard style. Includes BottomFadeOverlay for smooth scrolling under tab bar.
    Conditionally renders accordion only when attestations exist; shows centered empty state otherwise.
*/
import React, { useCallback, useEffect, useState, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Button, List, Divider } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';

import Colors from '../../../globals/colors';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';
import VerusIdObjectData from '../../../components/VerusIdObjectData';
import MissingInfoRedirect from '../../../components/MissingInfoRedirect/MissingInfoRedirect';
import BottomFadeOverlay from '../../../components/BottomFadeOverlay';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { getFriendlyNameMap, getIdentity } from '../../../utils/api/channels/verusid/callCreators';
import { unlinkVerusId } from '../../../actions/actions/services/dispatchers/verusid/verusid';
import { updateVerusIdWallet } from '../../../actions/actions/channels/verusid/dispatchers/VerusidWalletReduxManager';
import { clearChainLifecycle, refreshActiveChainLifecycles } from '../../../actions/actions/intervals/dispatchers/lifecycleManager';
import { setServiceLoading, setUserCoins } from '../../../actions/actionCreators';
import { createAlert } from '../../../actions/actions/alert/dispatchers/alert';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { VERUSID_SERVICE_ID } from '../../../utils/constants/services';
import { convertFqnToDisplayFormat } from '../../../utils/fullyqualifiedname';
import { openUrl } from '../../../utils/linking';
import { requestAttestationData } from '../../../utils/auth/authBox';
import { ATTESTATIONS_PROVISIONED } from '../../../utils/constants/attestations';

const VerusIdDetails = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  // Route params
  const { chain, iAddress, displayName } = route.params || {};

  // Redux state
  const activeAccount = useObjectSelector(state => state.authentication.activeAccount);
  const activeCoinList = useObjectSelector(state => state.coins.activeCoinList);

  // Local state
  const [verusId, setVerusId] = useState(null);
  const [friendlyNames, setFriendlyNames] = useState(null);
  const [attestations, setAttestations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const [failedMessage, setFailedMessage] = useState('Failed to load VerusID');
  const [attestationsExpanded, setAttestationsExpanded] = useState(true);

  // Bottom fade dimensions
  const bottomPadding = Math.max(insets.bottom, 20);
  const bottomFadeHeight = 48;

  // Get VerusID title for header
  const verusIdTitle = useMemo(() => {
    if (verusId) {
      const fullTitle = convertFqnToDisplayFormat(verusId.fullyqualifiedname);
      return fullTitle.length < 20 ? fullTitle : displayName || 'VerusID';
    }
    return displayName || 'VerusID';
  }, [verusId, displayName]);

  // Render details button for header right
  const renderDetailsButton = useCallback(() => (
    <TouchableOpacity
      onPress={() => {
        if (verusId) {
          const url = `https://verus.io/verusid-lookup/${verusId.fullyqualifiedname}`;
          openUrl(url);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel="View details"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.headerDetailsButton}
    >
      <Text style={styles.headerDetailsText}>Details</Text>
    </TouchableOpacity>
  ), [verusId]);

  // Set up navigation header (matching SendWizard style)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: verusIdTitle,
      headerRight: renderDetailsButton,
      headerBackTitle: 'Back',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'white',
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTitleStyle: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.quaternaryColor,
      },
    });
  }, [navigation, verusIdTitle, renderDetailsButton]);

  // Load VerusID data
  const loadVerusIdData = useCallback(async () => {
    try {
      const coinObj = CoinDirectory.getBasicCoinObj(chain);
      const identityRes = await getIdentity(coinObj.system_id, iAddress);
      
      if (identityRes.error) {
        throw new Error(identityRes.error.message);
      }

      const identity = identityRes.result;
      setVerusId(identity);

      // Load friendly names
      const names = await getFriendlyNameMap(coinObj.system_id, identity);
      setFriendlyNames(names);

      return identity;
    } catch (e) {
      setFailedToLoad(true);
      setFailedMessage(e.message || 'Failed to load VerusID');
      throw e;
    }
  }, [chain, iAddress]);

  // Load attestations linked to this VerusID
  const loadAttestations = useCallback(async () => {
    try {
      const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
      
      if (attestationData && typeof attestationData === 'object') {
        // Filter attestations by identityId matching iAddress
        const linkedAttestations = Object.entries(attestationData)
          .filter(([key, att]) => {
            if (!att || typeof att !== 'object') return false;
            // Match by identityId (i-Address) if present
            if (att.identityId && att.identityId === iAddress) return true;
            return false;
          })
          .map(([key, att]) => ({ ...att, _key: key }));

        setAttestations(linkedAttestations);
      } else {
        setAttestations([]);
      }
    } catch (e) {
      console.warn('Failed to load attestations:', e.message);
      setAttestations([]);
    }
  }, [iAddress]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadVerusIdData(), loadAttestations()]);
      } catch (e) {
        // Error already handled in loadVerusIdData
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [loadVerusIdData, loadAttestations]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadVerusIdData(), loadAttestations()]);
    } catch (e) {
      // Error handling done in load functions
    } finally {
      setRefreshing(false);
    }
  }, [loadVerusIdData, loadAttestations]);

  // Unlink identity
  const unlinkIdentity = useCallback(async () => {
    dispatch(setServiceLoading(true, VERUSID_SERVICE_ID));
    try {
      const coinObj = CoinDirectory.findCoinObj(chain);
      await unlinkVerusId(iAddress, coinObj.id);

      await updateVerusIdWallet();
      clearChainLifecycle(coinObj.id);

      if (activeAccount) {
        const setUserCoinsAction = setUserCoins(activeCoinList, activeAccount.id);
        dispatch(setUserCoinsAction);
        refreshActiveChainLifecycles(setUserCoinsAction.payload.activeCoinsForUser);
      }

      // Navigate back after unlinking
      navigation.goBack();
    } catch (e) {
      createAlert('Error', e.message);
    } finally {
      dispatch(setServiceLoading(false, VERUSID_SERVICE_ID));
    }
  }, [dispatch, activeAccount, activeCoinList, chain, iAddress, navigation]);

  // View attestation details
  const viewAttestationDetails = useCallback((attestation) => {
    navigation.navigate('ViewAttestation', { attestation });
  }, [navigation]);

  // Format date for attestation display
  const formatDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      if (typeof dateValue === 'string' && /[a-zA-Z]/.test(dateValue)) {
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate.getTime())) {
          return formatToOrdinalDate(parsedDate);
        }
        return dateValue;
      }
      
      if (typeof dateValue === 'number' || !isNaN(Number(dateValue))) {
        const timestamp = Number(dateValue);
        const date = timestamp < 10000000000 
          ? new Date(timestamp * 1000) 
          : new Date(timestamp);
        return formatToOrdinalDate(date);
      }
      
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return formatToOrdinalDate(date);
      }
      
      return null;
    } catch (e) {
      return null;
    }
  };

  const formatToOrdinalDate = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    const getOrdinalSuffix = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
  };

  // Render attestation item
  const renderAttestationItem = (attestation, index) => {
    const possibleDateFields = [
      attestation?.date,
      attestation?.dateReceived,
      attestation?.timestamp,
      attestation?.created_at,
      attestation?.createdAt,
    ];
    
    let dateStr = 'Date unknown';
    for (const dateField of possibleDateFields) {
      const formatted = formatDate(dateField);
      if (formatted) {
        dateStr = formatted;
        break;
      }
    }

    const signerName = attestation?.signer || 
                      attestation?.identityAttested || 
                      attestation?.issuer ||
                      attestation?.from ||
                      'Unknown';
    
    const description = `Signed by: ${signerName}${dateStr !== 'Date unknown' ? ` • ${dateStr}` : ''}`;

    return (
      <React.Fragment key={attestation._key || index}>
        <List.Item
          title={attestation?.name || attestation?.claimName || attestation?.title || 'Unnamed Attestation'}
          description={description}
          descriptionNumberOfLines={2}
          onPress={() => viewAttestationDetails(attestation)}
          left={() => (
            <View style={styles.attestationIconContainer}>
              <MaterialCommunityIcons
                name="certificate"
                size={24}
                color={Colors.primaryColor}
              />
            </View>
          )}
          right={props => (
            <List.Icon {...props} icon="chevron-right" size={20} />
          )}
          style={styles.attestationItem}
        />
        <Divider />
      </React.Fragment>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <AnimatedActivityIndicatorBox />
      </View>
    );
  }

  // Render error state
  if (failedToLoad) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MissingInfoRedirect
            icon="alert-circle-outline"
            label={failedMessage}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + bottomFadeHeight + bottomPadding },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Identity Info */}
        <VerusIdObjectData
          verusId={verusId}
          friendlyNames={friendlyNames}
          scrollDisabled={true}
          containerStyle={styles.identityDataContainer}
        />

        {/* Attestations Section */}
        {attestations.length > 0 ? (
          <View style={styles.attestationsSection}>
            <List.Accordion
              title="Attestations"
              description={`${attestations.length} attestation${attestations.length > 1 ? 's' : ''}`}
              expanded={attestationsExpanded}
              onPress={() => setAttestationsExpanded(!attestationsExpanded)}
              style={styles.attestationsAccordion}
              titleStyle={styles.attestationsTitle}
              left={props => (
                <List.Icon {...props} icon="certificate" color={Colors.verusDarkGray} />
              )}
            >
              {attestations.map((att, idx) => renderAttestationItem(att, idx))}
            </List.Accordion>
          </View>
        ) : (
          <View style={styles.emptyAttestationsSection}>
            <MaterialCommunityIcons
              name="certificate-outline"
              size={48}
              color={Colors.verusDarkGray}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>
              No attestations linked to this identity
            </Text>
            <Text style={styles.emptySubtext}>
              Attestations you receive for this VerusID will appear here
            </Text>
          </View>
        )}

        {/* Unlink Button */}
        <View style={styles.unlinkContainer}>
          <Button
            mode="text"
            textColor={Colors.warningButtonColor}
            onPress={unlinkIdentity}
            labelStyle={styles.unlinkLabel}
          >
            Unlink Identity
          </Button>
        </View>
      </ScrollView>

      {/* Bottom fade overlay for smooth scrolling under tab bar */}
      <BottomFadeOverlay
        gradientHeight={bottomFadeHeight}
        solidHeight={bottomPadding}
        backgroundColor="#FFFFFF"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerDetailsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerDetailsText: {
    fontSize: 16,
    color: Colors.primaryColor,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  identityDataContainer: {
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  attestationsSection: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  attestationsAccordion: {
    backgroundColor: '#F8F8F8',
  },
  attestationsTitle: {
    fontWeight: '600',
    color: Colors.quaternaryColor,
  },
  attestationItem: {
    backgroundColor: '#FFFFFF',
    paddingLeft: 16,
  },
  attestationIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 4,
  },
  emptyAttestationsSection: {
    marginTop: 8,
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.verusDarkGray,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  unlinkContainer: {
    padding: 24,
    alignItems: 'center',
  },
  unlinkLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VerusIdDetails;
