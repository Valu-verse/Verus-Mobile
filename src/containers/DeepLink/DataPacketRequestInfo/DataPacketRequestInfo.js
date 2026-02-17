import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View, StatusBar, Platform } from 'react-native';
import { Button, Portal, Text } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { DataPacketRequestDetails, DataDescriptor } from 'verus-typescript-primitives';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';
import VerusIdDetailsModal from '../../../components/VerusIdDetailsModal/VerusIdDetailsModal';
import Colors from '../../../globals/colors';
import GradientButton from '../../../components/GradientButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { openAuthenticateUserModal } from '../../../actions/actions/sendModal/dispatchers/sendModal';
import { AUTHENTICATE_USER_SEND_MODAL, SEND_MODAL_USER_ALLOWLIST } from '../../../utils/constants/sendModal';
import { createAlert, resolveAlert } from '../../../actions/actions/alert/dispatchers/alert';
import { unixToDate } from '../../../utils/math';
import { getSystemNameFromSystemId } from '../../../utils/CoinData/CoinData';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { getFriendlyNameMap, getIdentity } from '../../../utils/api/channels/verusid/callCreators';
import { convertFqnToDisplayFormat } from '../../../utils/fullyqualifiedname';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { copyToClipboard } from '../../../utils/clipboard/clipboard';
import { DataDescriptorList } from '../../../components/DataDescriptorList';
import { processDataDescriptors } from '../../../utils/dataDescriptor';

const DetailRow = ({ title, subtitle, onPress, rightIcon, showBorder }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      style={[
        styles.detailRow,
        showBorder && styles.detailRowBorder,
        onPress && styles.detailRowPressable,
      ]}
      {...wrapperProps}
    >
      <View style={styles.detailLeft}>
        <Text style={styles.detailTitle}>{title}</Text>
        {subtitle ? <Text style={styles.detailSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightIcon ? (
        <MaterialCommunityIcons name={rightIcon} size={18} color="#888" />
      ) : null}
    </Wrapper>
  );
};

const DataPacketRequestInfo = props => {
  const {
    detailsBufferString,
    isSigned,
    sigtime,
    signerFqn,
    signerSystemID,
    signerIdentityID,
    isSignatureValid,
    coinObj,
    cancel,
    navigation,
    next,
    request,
    response,
    detailIndex
  } = props;

  const [details, setDetails] = useState(new DataPacketRequestDetails());
  const [loading, setLoading] = useState(false);
  const [verusIdDetailsModalProps, setVerusIdDetailsModalProps] = useState(null);
  const [sigDateString, setSigDateString] = useState(unixToDate(sigtime));
  const [waitingForSignin, setWaitingForSignin] = useState(false);

  const accounts = useObjectSelector(state => state.authentication.accounts);
  const signedIn = useSelector(state => state.authentication.signedIn);
  const sendModalType = useSelector(state => state.sendModal.type);

  // Determine if request is testnet from the request object
  const requestIsTestnet = request != null ? request.isTestnet() : false;

  const isWrongRequestType = useSelector(state => {
    const isTestAccount =
      state.authentication.activeAccount &&
      Object.keys(state.authentication.activeAccount.testnetOverrides).length > 0;
    return (
      state.authentication.signedIn &&
      ((isTestAccount && !requestIsTestnet) ||
      (!isTestAccount && requestIsTestnet))
    );
  });

  const chain_id = isSigned ? getSystemNameFromSystemId(signerSystemID) : null;

  const getVerusId = async (chain, iAddrOrName) => {
    const identity = await getIdentity(CoinDirectory.getBasicCoinObj(chain).system_id, iAddrOrName);
    if (identity.error) throw new Error(identity.error.message);
    return identity.result;
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
    });
  };

  const handleSignerDetailsPress = () => {
    if (!chain_id || !signerIdentityID) {
      createAlert('Signer unavailable', 'No signer identity is available for this request.');
      return;
    }
    openVerusIdDetailsModal(chain_id, signerIdentityID);
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
      { cancelable: false },
    );
  };

  const getAllowList = () => {
    if (requestIsTestnet) {
      return accounts.filter(x => x.testnetOverrides && Object.keys(x.testnetOverrides).length > 0);
    }
    return accounts.filter(x => !x.testnetOverrides || Object.keys(x.testnetOverrides).length === 0);
  };

  const handleContinue = () => {
    if (signedIn) {
      // Navigate to next step or call next()
      // For now, we'll just acknowledge the request
      next(response, [detailIndex]);
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
          `No ${requestIsTestnet ? 'testnet' : 'mainnet'} profiles found, cannot respond to data packet request.`,
        );
      }
    }
  };

  useEffect(() => {
    if (signedIn && waitingForSignin) {
      handleContinue();
    }
  }, [signedIn, waitingForSignin]);

  useEffect(() => {
    if (isWrongRequestType) wrongRequestType(requestIsTestnet);
  }, []);

  useEffect(() => {
    if (detailsBufferString) {
      const det = new DataPacketRequestDetails();
      det.fromBuffer(Buffer.from(detailsBufferString, 'hex'));
      setDetails(det);
    }
  }, [detailsBufferString]);

  useEffect(() => {
    setSigDateString(unixToDate(sigtime));
  }, [sigtime]);

  useEffect(() => {
    if (sendModalType != AUTHENTICATE_USER_SEND_MODAL) {
      setLoading(false);
    } else setLoading(true);
  }, [sendModalType]);

  // Determine flags for display
  const hasRequestId = details.hasRequestID();
  const hasStatements = details.hasStatements();
  const hasSignature = details.hasSignature();
  const isForUserSignature = details.flags?.and?.(DataPacketRequestDetails.FLAG_FOR_USERS_SIGNATURE)?.gt?.(0) || false;
  const isForTransmittalToUser = details.flags?.and?.(DataPacketRequestDetails.FLAG_FOR_TRANSMITTAL_TO_USER)?.gt?.(0) || false;
  const hasUrlForDownload = details.flags?.and?.(DataPacketRequestDetails.FLAG_HAS_URL_FOR_DOWNLOAD)?.gt?.(0) || false;

  const requesterLabel = signerFqn || signerIdentityID || 'Unknown signer';
  const canOpenSignerModal = Boolean(chain_id && signerIdentityID);

  // Build detail rows
  const detailRows = useMemo(() => {
    const rows = [];

    // Request type indicator
    if (isForUserSignature) {
      rows.push({
        key: 'for-signature',
        title: 'Signature requested',
        subtitle: 'This request is asking for your signature on the data.',
      });
    }

    if (isForTransmittalToUser) {
      rows.push({
        key: 'transmittal',
        title: 'Data transmittal',
        subtitle: 'Data is being transmitted to you.',
      });
    }

    if (hasUrlForDownload) {
      rows.push({
        key: 'url-download',
        title: 'Contains download URL',
        subtitle: 'A URL for downloading data is included.',
      });
    }

    // Request ID
    if (hasRequestId && details.requestID) {
      const requestIdDisplay = details.requestID.toIAddress ? details.requestID.toIAddress() : 'Unknown';
      rows.push({
        key: 'request-id',
        title: requestIdDisplay,
        subtitle: 'Request ID',
        onPress: () => copyToClipboard(requestIdDisplay, {
          title: 'Request ID copied',
          message: `${requestIdDisplay} copied to clipboard.`,
        }),
        rightIcon: 'content-copy',
      });
    }

    // Note: Signable objects are now displayed in a separate section below
    // We still add a summary row here for quick reference
    if (details.signableObjects && details.signableObjects.length > 0) {
      rows.push({
        key: 'signable-objects-summary',
        title: `${details.signableObjects.length} data object${details.signableObjects.length > 1 ? 's' : ''}`,
        subtitle: 'See detailed view below',
      });
    }

    // Statements
    if (hasStatements && details.statements && details.statements.length > 0) {
      details.statements.forEach((statement, index) => {
        rows.push({
          key: `statement-${index}`,
          title: statement.length > 100 ? statement.substring(0, 100) + '...' : statement,
          subtitle: `Statement ${index + 1}`,
          onPress: () => copyToClipboard(statement, {
            title: 'Statement copied',
            message: 'Statement copied to clipboard.',
          }),
          rightIcon: 'content-copy',
        });
      });
    }

    // Internal signature status (separate from main request signature)
    if (hasSignature && details.signature) {
      rows.push({
        key: 'internal-signature',
        title: isSignatureValid ? 'Valid signature' : 'Invalid signature',
        subtitle: 'Embedded signature on data packet',
        rightIcon: isSignatureValid ? 'check-circle-outline' : 'alert-circle-outline',
      });
    }

    return rows;
  }, [details, hasRequestId, hasStatements, hasSignature, isForUserSignature, isForTransmittalToUser, hasUrlForDownload, isSignatureValid]);

  // Determine hero text based on request type
  const getHeroTitle = () => {
    if (isForUserSignature) return 'Signature Request';
    if (isForTransmittalToUser) return 'Data Packet';
    return 'Data Request';
  };

  const getHeroSubtitle = () => {
    if (isForUserSignature) return 'Sign the included data';
    if (isForTransmittalToUser) return 'Review incoming data';
    return 'Review data packet';
  };

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
          <Text style={styles.mainTitle}>Data packet request</Text>
        </View>

        {isSigned ? (
          <TouchableOpacity
            style={styles.requesterCard}
            onPress={canOpenSignerModal ? handleSignerDetailsPress : undefined}
            activeOpacity={canOpenSignerModal ? 0.7 : 1}
          >
            <View style={styles.requesterHeaderRow}>
              <View style={styles.requesterIconContainer}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={28}
                  color={Colors.verusGreenColor}
                />
              </View>
              <View style={styles.requesterTextContainer}>
                <Text style={styles.requesterLabel}>Request from</Text>
                <Text style={styles.requesterName}>{requesterLabel}</Text>
              </View>
              {canOpenSignerModal ? (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={Colors.verusDarkGray}
                />
              ) : null}
            </View>
            <View style={styles.requesterDetailsRow}>
              {chain_id ? (
                <View style={styles.chipContainer}>
                  <Text style={styles.chipText}>{chain_id}</Text>
                </View>
              ) : null}
              {sigDateString ? (
                <View style={styles.chipContainer}>
                  <Text style={styles.chipText}>{sigDateString}</Text>
                </View>
              ) : null}
              {isSignatureValid !== undefined && (
                <View style={[styles.chipContainer, isSignatureValid ? styles.chipValid : styles.chipInvalid]}>
                  <Text style={[styles.chipText, isSignatureValid ? styles.chipTextValid : styles.chipTextInvalid]}>
                    {isSignatureValid ? 'Verified' : 'Unverified'}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.unsignedCard}>
            <View style={styles.unsignedIconContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#B45309" />
            </View>
            <View style={styles.unsignedTextContainer}>
              <Text style={styles.unsignedTitle}>Unsigned request</Text>
              <Text style={styles.unsignedSubtitle}>
                This data packet request does not include a signer identity.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.heroContainer}>
          <Text style={styles.heroAmount}>{getHeroTitle()}</Text>
          <Text style={styles.heroCurrency}>{getHeroSubtitle()}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="information-outline" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Request details</Text>
            </View>
          </View>
          <View style={styles.sectionContent}>
            {detailRows.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No additional details.</Text>
              </View>
            ) : (
              detailRows.map((row, index) => (
                <DetailRow
                  key={row.key}
                  title={row.title}
                  subtitle={row.subtitle}
                  onPress={row.onPress}
                  rightIcon={row.rightIcon}
                  showBorder={index > 0}
                />
              ))
            )}
          </View>
        </View>

        {/* Data Objects Section */}
        {details.signableObjects && details.signableObjects.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <MaterialCommunityIcons name="file-document-multiple-outline" size={20} color="#666" />
                <Text style={styles.sectionTitle}>Data objects</Text>
              </View>
              <View style={styles.objectCountBadge}>
                <Text style={styles.objectCountText}>{details.signableObjects.length}</Text>
              </View>
            </View>
            <View style={styles.sectionContent}>
              <DataDescriptorList
                descriptors={details.signableObjects}
                onItemPress={(descriptor, index) => {
                  // Copy content to clipboard when pressed
                  if (descriptor.content && !descriptor.isEncrypted) {
                    copyToClipboard(descriptor.content, {
                      title: 'Content copied',
                      message: `${descriptor.title} copied to clipboard.`,
                    });
                  }
                }}
                emptyMessage="No data objects in this request"
              />
            </View>
          </View>
        )}

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
          <GradientButton
            onPress={() => handleContinue()}
            style={styles.primaryCta}
            disabled={isSigned && isSignatureValid === false}
          >
            Continue
          </GradientButton>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
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
  requesterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  chipValid: {
    backgroundColor: '#E8F5E9',
  },
  chipTextValid: {
    color: '#2E7D32',
  },
  chipInvalid: {
    backgroundColor: '#FFEBEE',
  },
  chipTextInvalid: {
    color: '#C62828',
  },
  unsignedCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  unsignedIconContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  unsignedTextContainer: {
    flex: 1,
  },
  unsignedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  unsignedSubtitle: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
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
  objectCountBadge: {
    backgroundColor: Colors.primaryColor + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  objectCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryColor,
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
  detailRowPressable: {},
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
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -1,
    textAlign: 'center',
  },
  heroCurrency: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});

export default DataPacketRequestInfo;
