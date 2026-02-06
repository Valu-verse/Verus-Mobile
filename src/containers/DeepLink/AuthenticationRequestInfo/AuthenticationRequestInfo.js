/*
  AuthenticationRequestInfo
  - 2026-02-06: Modernized auth request layout to match LoginRequestInfo cards.
    - Replaced legacy List.Item/Divider layout and large VerusIdLogo header
    - Added requester, intent, and identity cards with connector + details section
    - Updated footer to use GradientButton and modern secondary CTA styling
*/
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Portal, Text } from 'react-native-paper';
import { useSelector } from 'react-redux';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';
import VerusIdDetailsModal from '../../../components/VerusIdDetailsModal/VerusIdDetailsModal';
import Colors from '../../../globals/colors';
import { openAuthenticateUserModal } from '../../../actions/actions/sendModal/dispatchers/sendModal';
import { AUTHENTICATE_USER_SEND_MODAL, SEND_MODAL_USER_ALLOWLIST } from '../../../utils/constants/sendModal';
import { createAlert, resolveAlert } from '../../../actions/actions/alert/dispatchers/alert';
import { unixToDate } from '../../../utils/math';
import { AuthenticationRequestDetails } from 'verus-typescript-primitives';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { getFriendlyNameMap, getIdentity } from '../../../utils/api/channels/verusid/callCreators';
import { getSystemNameFromSystemId } from '../../../utils/CoinData/CoinData';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import GradientButton from '../../../components/GradientButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import VerusIdAtIcon from '../../../images/customIcons/verusid-at-icon.svg';

const Connector = () => {
  return (
    <View style={styles.connectorContainer}>
      <View style={styles.connectorLine} />
      <View style={styles.connectorArrow} />
    </View>
  );
};

const AuthenticationRequestInfo = props => {
  const {
    detailsBufferString,
    sigtime,
    signerFqn,
    signerSystemID,
    signerSystemName,
    signerIdentityID,
    cancel,
    navigation,
    next,
    request,
    response,
    detailIndex,
  } = props;

  const [details, setDetails] = useState(new AuthenticationRequestDetails());
  const [loading, setLoading] = useState(false);
  const [sigDateString, setSigDateString] = useState(null);
  const [waitingForSignin, setWaitingForSignin] = useState(false);
  const [verusIdDetailsModalProps, setVerusIdDetailsModalProps] = useState(null);

  const accounts = useObjectSelector(state => state.authentication.accounts);
  const signedIn = useSelector(state => state.authentication.signedIn);
  const sendModalType = useSelector(state => state.sendModal.type);
  const activeAccount = useObjectSelector(state => state.authentication.activeAccount);
  const isTestAccount = activeAccount && Object.keys(activeAccount.testnetOverrides).length > 0;

  const requestIsTestnet = request != null && request.isTestnet();
  const canOpenSignerModal = signerSystemName && signerIdentityID;
  const requesterLabel = signerFqn || 'An app';
  const systemLabel =
    signerSystemName || getSystemNameFromSystemId(signerSystemID) || signerSystemID;
  const headerSubtitle = `${requesterLabel} is requesting login with VerusID`;
  const intentTitle = 'Login request';
  const intentSubtitle = `${requesterLabel} wants to verify your identity`;

  const getConstraintLabel = (constraint) => {
    let identityLabel = constraint.identity.address;
    let constraintLabel = identityLabel;

    try {
      constraintLabel = constraint.identity.toIAddress();
    } catch (e) {
      constraintLabel = identityLabel;
    }

    if (constraint.type === AuthenticationRequestDetails.REQUIRED_SYSTEM) {
      const systemName = getSystemNameFromSystemId(constraintLabel);
      if (systemName) constraintLabel = systemName;
    }

    switch (constraint.type) {
      case AuthenticationRequestDetails.REQUIRED_ID:
        return `Required identity: ${constraintLabel}`;
      case AuthenticationRequestDetails.REQUIRED_SYSTEM:
        return `Required system: ${constraintLabel}`;
      case AuthenticationRequestDetails.REQUIRED_PARENT:
        return `Required parent: ${constraintLabel}`;
      default:
        return `Constraint: ${constraintLabel}`;
    }
  };

  const getExpiryLabel = () => {
    if (!details || !details.hasExpiryTime()) return null;
    return unixToDate(details.expiryTime.toNumber());
  };

  const getVerusId = async (chain, iAddrOrName) => {
    const identity = await getIdentity(CoinDirectory.getBasicCoinObj(chain).system_id, iAddrOrName);

    if (identity.error) throw new Error(identity.error.message);
    else return identity.result;
  };

  const openVerusIdDetailsModal = (chain, iAddress) => {
    setVerusIdDetailsModalProps({
      loadVerusId: () => getVerusId(chain, iAddress),
      visible: true,
      animationType: 'slide',
      cancel: () => setVerusIdDetailsModalProps(null),
      loadFriendlyNames: async () => {
        try {
          const identityObj = await getVerusId(chain, iAddress);
    
          return getFriendlyNameMap(CoinDirectory.getBasicCoinObj(chain).system_id, identityObj);
        } catch (e) {
          return {
            ['i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV']: 'VRSC',
            ['iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq']: 'VRSCTEST',
          };
        }
      },
      iAddress,
      chain
    })
  };

  const getAllowList = () => {
    if (requestIsTestnet) {
      return accounts.filter(x => x.testnetOverrides && Object.keys(x.testnetOverrides).length > 0);
    }
    return accounts.filter(x => !x.testnetOverrides || Object.keys(x.testnetOverrides).length === 0);
  };

  const handleContinue = () => {
    if (signedIn) {
      const requestBufferString = request.toBuffer().toString('hex');
      const responseBufferString = response.details && response.details.length > 0
        ? response.toBuffer().toString('hex')
        : '';

      navigation.navigate('AuthenticationRequestIdentity', {
        detailsBufferString,
        requestBufferString,
        responseBufferString,
        detailIndex,
        next
      });
    } else {
      setWaitingForSignin(true);
      const allowList = getAllowList();

      if (allowList.length > 0) {
        const data = {
          [SEND_MODAL_USER_ALLOWLIST]: allowList
        };

        openAuthenticateUserModal(data);
      } else {
        createAlert(
          "Cannot continue",
          `No ${requestIsTestnet ? 'testnet' : 'mainnet'} profiles found, cannot respond to authentication request.`,
        );
      }
    }
  };

  const wrongRequestType = (isTestRequest) => {
    createAlert(
      isTestRequest ? 'Testnet Request' : 'Mainnet Request',
      `This request was created for ${
        isTestRequest ? 'testnet' : 'mainnet'
      }, but you are using a ${
        isTestRequest ? 'mainnet' : 'testnet'
      } profile. Please logout, select a ${
        isTestRequest ? 'testnet' : 'mainnet'
      } profile, and retry this request to continue.`,
      [
        {
          text: 'Ok',
          onPress: () => {
            cancel();
            resolveAlert(true);
          },
        },
      ],
      {
        cancelable: false,
      },
    );
  };

  useEffect(() => {
    if (signedIn && waitingForSignin) {
      handleContinue();
    }
  }, [signedIn, waitingForSignin]);

  useEffect(() => {
    if (sendModalType != AUTHENTICATE_USER_SEND_MODAL) {
      setLoading(false);
    } else setLoading(true);
  }, [sendModalType]);

  useEffect(() => {
    if (signedIn && request != null) {
      if ((isTestAccount && !requestIsTestnet) || (!isTestAccount && requestIsTestnet)) {
        wrongRequestType(requestIsTestnet);
      }
    }
  }, [signedIn, requestIsTestnet, isTestAccount]);

  const expiryLabel = getExpiryLabel();
  const constraints = details && details.recipientConstraints ? details.recipientConstraints : [];
  const responseUris = details && details.responseURIs ? details.responseURIs : [];
  const detailRows = useMemo(() => {
    const rows = [];

    if (constraints.length > 0) {
      constraints.forEach((constraint, index) => {
        rows.push({
          key: `constraint-${index}`,
          title: getConstraintLabel(constraint),
          subtitle: 'Recipient constraint',
        });
      });
    }

    if (responseUris.length > 0) {
      responseUris.forEach((uri, index) => {
        rows.push({
          key: `response-${index}`,
          title: uri.getUriString(),
          subtitle: 'Response URI',
        });
      });
    }

    if (expiryLabel != null) {
      rows.push({
        key: 'expiry',
        title: expiryLabel,
        subtitle: 'Expires at',
      });
    }

    return rows;
  }, [constraints, responseUris, expiryLabel]);

  useEffect(() => {
    if (detailsBufferString) {
      const det = new AuthenticationRequestDetails();
      det.fromBuffer(Buffer.from(detailsBufferString, 'hex'), 0);
      setDetails(det);
    }
  }, [detailsBufferString]);

  useEffect(() => {
    if (sigtime != null) {
      setSigDateString(unixToDate(sigtime));
    } else {
      setSigDateString(null);
    }
  }, [sigtime]);

  return loading ? (
    <AnimatedActivityIndicatorBox />
  ) : (
    <SafeAreaView style={styles.container}>
      <Portal>
        {verusIdDetailsModalProps != null && (
          <VerusIdDetailsModal {...verusIdDetailsModalProps} />
        )}
      </Portal>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.mainTitle}>Authentication request</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>

        <TouchableOpacity
          style={styles.requesterCard}
          onPress={canOpenSignerModal ? () => openVerusIdDetailsModal(signerSystemName, signerIdentityID) : undefined}
          activeOpacity={canOpenSignerModal ? 0.7 : 1}
        >
          <View style={styles.requesterHeaderRow}>
            <View style={styles.requesterIconContainer}>
              <MaterialCommunityIcons name="shield-check" size={28} color={Colors.verusGreenColor} />
            </View>
            <View style={styles.requesterTextContainer}>
              <Text style={styles.requesterLabel}>Request from</Text>
              <Text style={styles.requesterName}>{requesterLabel}</Text>
            </View>
            {canOpenSignerModal && (
              <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.verusDarkGray} />
            )}
          </View>
          <View style={styles.requesterDetailsRow}>
            {systemLabel && (
              <View style={styles.chipContainer}>
                <Text style={styles.chipText}>{systemLabel}</Text>
              </View>
            )}
            {sigDateString && (
              <View style={styles.chipContainer}>
                <Text style={styles.chipText}>{sigDateString}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.intentCard}>
          <View style={styles.intentRow}>
            <View style={styles.intentIconContainer}>
              <MaterialCommunityIcons name="account-key" size={20} color={Colors.verusGreenColor} />
            </View>
            <View style={styles.intentTextContainer}>
              <Text style={styles.intentTitle}>{intentTitle}</Text>
              <Text style={styles.intentSubtitle}>{intentSubtitle}</Text>
            </View>
          </View>
        </View>

        <Connector />

        <View style={styles.targetCard}>
          <View style={styles.targetRow}>
            <View style={styles.targetIconContainer}>
              <VerusIdAtIcon width={24} height={24} fill="#3165D4" />
            </View>
            <View style={styles.targetInfo}>
              <Text style={styles.targetLabel}>Identity</Text>
              <Text style={styles.targetName}>Choose identity</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="information-outline" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Details</Text>
            </View>
          </View>
          <Text style={styles.sectionHelper}>
            {detailRows.length > 0
              ? 'Review constraints and response targets for this request.'
              : 'No additional constraints or response targets.'}
          </Text>
          <View style={styles.sectionContent}>
            {detailRows.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Authentication only.</Text>
              </View>
            ) : (
              detailRows.map((row, index) => (
                <View
                  key={row.key}
                  style={[styles.detailRow, index > 0 && styles.detailRowBorder]}
                >
                  <View style={styles.detailLeft}>
                    <Text style={styles.detailTitle}>{row.title}</Text>
                    {row.subtitle ? (
                      <Text style={styles.detailSubtitle}>{row.subtitle}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.ctaCol}>
          <Button
            mode="contained"
            onPress={() => cancel()}
            style={styles.secondaryCta}
            contentStyle={styles.secondaryCtaContent}
            uppercase={false}
            buttonColor="#EBF6FF"
            textColor={Colors.primaryColor}
            labelStyle={styles.secondaryCtaLabel}
          >
            Cancel
          </Button>
        </View>
        <View style={styles.ctaCol}>
          <GradientButton onPress={() => handleContinue()} style={styles.primaryCta}>
            Continue
          </GradientButton>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AuthenticationRequestInfo;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    marginBottom: 20,
    marginTop: 8,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  requesterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    zIndex: 2,
  },
  requesterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requesterIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  requesterTextContainer: {
    flex: 1,
  },
  requesterLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  requesterName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  requesterDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipContainer: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  intentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  intentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  intentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#ECFDF3',
  },
  intentTextContainer: {
    flex: 1,
  },
  intentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  intentSubtitle: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  connectorContainer: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    zIndex: 1,
    marginTop: -2,
    marginBottom: -2,
  },
  connectorLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#E0E0E0',
    position: 'absolute',
  },
  connectorArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E0E0E0',
    position: 'absolute',
    bottom: 0,
  },
  targetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    zIndex: 2,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  targetInfo: {
    flex: 1,
  },
  targetLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  targetName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sectionHelper: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    marginTop: -4,
  },
  sectionContent: {
    padding: 0,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  detailLeft: {
    flex: 1,
    marginRight: 12,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  detailSubtitle: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  emptyRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  emptyText: {
    fontSize: 12,
    color: '#888',
  },
  footer: {
    backgroundColor: 'white',
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  ctaCol: {
    flex: 1,
    minWidth: 0,
  },
  secondaryCta: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF6FF',
    borderWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  secondaryCtaContent: {
    height: 44,
  },
  secondaryCtaLabel: {
    color: Colors.primaryColor,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0,
    textTransform: 'none',
  },
  primaryCta: {
    width: '100%',
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 22,
  },
});
