import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Portal, Text } from 'react-native-paper';
import { useSelector } from 'react-redux';
import {
  UserDataRequestDetails,
  DataDescriptor,
  DataResponseDetails,
  DataResponseOrdinalVDXFObject,
  GenericResponse,
  VerifiableSignatureData,
  CompactAddressObject,
} from 'verus-typescript-primitives';
import * as VDXF_Data from 'verus-typescript-primitives/dist/vdxf/vdxfdatakeys';
import { IdentityVdxfidMap } from 'verus-typescript-primitives/dist/utils/IdentityData';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';
import VerusIdDetailsModal from '../../../components/VerusIdDetailsModal/VerusIdDetailsModal';
import Colors from '../../../globals/colors';
import GradientButton from '../../../components/GradientButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { openAuthenticateUserModal } from '../../../actions/actions/sendModal/dispatchers/sendModal';
import { SEND_MODAL_USER_ALLOWLIST } from '../../../utils/constants/sendModal';
import { createAlert, resolveAlert } from '../../../actions/actions/alert/dispatchers/alert';
import { unixToDate } from '../../../utils/math';
import { getSystemNameFromSystemId } from '../../../utils/CoinData/CoinData';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { getIdentity } from '../../../utils/api/channels/verusid/callCreators';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { copyToClipboard } from '../../../utils/clipboard/clipboard';
import { requestServiceStoredData } from '../../../utils/auth/authBox';
import { VERUSID_SERVICE_ID } from '../../../utils/constants/services';
import { createAttestationResponseBuffer } from '../../../utils/attestations/createAttestationResponse';
import { BN } from 'bn.js';

// ── Helpers ──

const truncateAddress = (addr) => {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
};

const DATA_TYPE_LABELS = {
  1: 'Full data',
  2: 'Partial data',
  3: 'Collection',
};

const REQUEST_TYPE_LABELS = {
  1: 'Attestation',
  2: 'Claim',
  3: 'Credential',
};

const DATA_TYPE_DESCRIPTIONS = {
  1: 'The requesting application wants to receive ALL data in this object. Review the contents carefully before approving.',
  2: 'The requesting application wants only specific fields. Other fields will be sent as cryptographic hashes only.',
  3: 'The requesting application wants multiple data objects. Review each before approving.',
};

const REQUEST_TYPE_DESCRIPTIONS = {
  1: 'Requesting an attestation (third-party signed statement about you)',
  2: 'Requesting a claim (your self-asserted data)',
  3: 'Requesting a verifiable credential',
};

// ── Detail Row Component ──

const DetailRow = ({ title, subtitle, onPress, rightIcon, showBorder, singleLine, isError }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};
  return (
    <Wrapper
      style={[
        styles.detailRow,
        showBorder && styles.detailRowBorder,
        onPress && styles.detailRowPressable,
        isError && styles.detailRowError,
      ]}
      {...wrapperProps}
    >
      <View style={styles.detailLeft}>
        <Text style={[styles.detailTitle, isError && styles.detailTitleError]} numberOfLines={singleLine ? 1 : undefined}>{title}</Text>
        {subtitle ? <Text style={[styles.detailSubtitle, isError && styles.detailSubtitleError]}>{subtitle}</Text> : null}
      </View>
      {rightIcon ? (
        <MaterialCommunityIcons name={rightIcon} size={18} color={isError ? "#C62828" : "#888"} />
      ) : null}
    </Wrapper>
  );
};

// ── Friendly label for a VDXF key ──

const friendlyKeyLabel = (vdxfKey) => {
  return IdentityVdxfidMap[vdxfKey]?.EN || vdxfKey;
};

// ── Extract field labels from an attestation's data descriptors ──

const extractFieldLabels = (attestationDetails) => {
  const labels = [];
  try {
    const descriptorKeyId = VDXF_Data.DataDescriptorKey?.vdxfid;
    if (attestationDetails?.mmrDescriptor?.dataDescriptors) {
      for (const dd of attestationDetails.mmrDescriptor.dataDescriptors) {
        const json = dd.toJson?.();
        // Handle nested format: objectdata[DataDescriptorKey] = { label, ... }
        const nested = json?.objectdata?.[descriptorKeyId];
        // Handle flat format: { label, objectdata: { message } }
        const label = nested?.label || json?.label;
        if (label) {
          labels.push(friendlyKeyLabel(label));
        }
      }
    }
  } catch (e) {
    console.warn('Error extracting field labels:', e);
  }
  return labels;
};

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════

const UserDataRequestInfo = (props) => {
  const insets = useSafeAreaInsets();
  const {
    // From displayProps (handler output)
    detailsBufferString,
    requestSignerFqn,
    requestSignerIdentityID,
    requestSignerSystemID,
    requestSigtime,
    coinObj,
    chainInfo,
    dataType,
    requestType,
    searchDataKey,
    signerIAddress,
    signerFqn,
    requestIDDisplay,
    requestedKeys,
    matchingAttestations,
    hasResponseURIs,
    // Standard props from GenericRequestHome
    cancel,
    navigation,
    next,
    response,
    request,
    detailIndex,
  } = props;

  // ── Redux state ──
  const signedIn = useSelector(state => state.authentication.signedIn);
  const sendModalType = useSelector(state => state.sendModal.type);
  const activeAccount = useObjectSelector(state => state.authentication.activeAccount);
  const encryptedIds = useObjectSelector(state => state.services.stored[VERUSID_SERVICE_ID]);
  const requestIsTestnet = request != null ? request.isTestnet() : false;

  // ── Local state ──
  const [loading, setLoading] = useState(false);
  const [waitingForSignin, setWaitingForSignin] = useState(false);
  const [verusIdDetailsModalProps, setVerusIdDetailsModalProps] = useState(null);

  // ── Derived values ──
  const isPartialData = dataType === UserDataRequestDetails.PARTIAL_DATA.toNumber();
  const isFullData = dataType === UserDataRequestDetails.FULL_DATA.toNumber();
  const isCollection = dataType === UserDataRequestDetails.COLLECTION.toNumber();

  const isSigned = !!(requestSignerFqn || requestSignerIdentityID);
  const requesterLabel = requestSignerFqn || requestSignerIdentityID || 'Unknown requester';
  const requesterAddress = requestSignerFqn ? requestSignerIdentityID : null;
  const requestSigDateString = requestSigtime ? unixToDate(requestSigtime) : null;
  const requestChainId = requestSignerSystemID
    ? getSystemNameFromSystemId(requestSignerSystemID) || requestSignerSystemID
    : null;

  // ── Attestation field preview ──
  const attestationFieldLabels = useMemo(() => {
    if (!matchingAttestations || matchingAttestations.length === 0) return [];

    if (isCollection) {
      return matchingAttestations.map(att => ({
        name: att.name,
        fields: extractFieldLabels(att.attestationDetails),
      }));
    }

    // Single attestation — show its fields
    const att = matchingAttestations[0];
    return [{
      name: att.name,
      fields: extractFieldLabels(att.attestationDetails),
    }];
  }, [matchingAttestations, isCollection]);

  // Which fields will be shared (for PARTIAL_DATA)
  const sharedFieldLabels = useMemo(() => {
    if (!isPartialData || !requestedKeys) return [];
    return requestedKeys.map(k => friendlyKeyLabel(k));
  }, [isPartialData, requestedKeys]);

  // ── isWrongRequestType check (testnet/mainnet mismatch) ──
  const isWrongRequestType = useMemo(() => {
    if (!activeAccount) return false;
    // If testnet request but no testnet profiles, or vice versa
    return false; // simplified — the validator already checks this
  }, [activeAccount, requestIsTestnet]);

  // ── Auth modal callback ──
  useEffect(() => {
    if (waitingForSignin && signedIn) {
      setWaitingForSignin(false);
    }
  }, [signedIn, waitingForSignin]);

  // ── Build detail rows ──
  const detailRows = useMemo(() => {
    const rows = [];

    // Data type
    rows.push({
      key: 'data-type',
      title: DATA_TYPE_LABELS[dataType] || `Data type ${dataType}`,
      subtitle: DATA_TYPE_DESCRIPTIONS[dataType] || '',
      rightIcon: isFullData ? 'file-document' : isPartialData ? 'file-document-edit' : 'file-document-multiple',
    });

    // Request type
    rows.push({
      key: 'request-type',
      title: REQUEST_TYPE_LABELS[requestType] || `Request type ${requestType}`,
      subtitle: REQUEST_TYPE_DESCRIPTIONS[requestType] || '',
      rightIcon: requestType === 1 ? 'certificate' : requestType === 2 ? 'account-voice' : 'shield-check',
    });

    // Search data key (what is being looked up)
    if (searchDataKey && searchDataKey.length > 0) {
      const labels = searchDataKey.map(entry => {
        const key = Object.keys(entry)[0];
        const val = entry[key];
        return val ? `${friendlyKeyLabel(key)}: ${val}` : friendlyKeyLabel(key);
      });
      rows.push({
        key: 'search-data',
        title: 'Searching for',
        subtitle: labels.join('\n'),
        rightIcon: 'magnify',
      });
    }

    // Signer constraint
    if (signerFqn || signerIAddress) {
      rows.push({
        key: 'signer',
        title: `Data signed by: ${signerFqn || signerIAddress}`,
        subtitle: signerFqn ? signerIAddress : undefined,
        rightIcon: 'account-key',
        onPress: signerIAddress ? () => copyToClipboard(signerIAddress, {
          title: 'Signer address copied',
          message: `${signerIAddress} copied to clipboard.`,
        }) : undefined,
      });
    }

    // Request ID
    if (requestIDDisplay) {
      rows.push({
        key: 'request-id',
        title: requestIDDisplay,
        subtitle: 'Request ID',
        rightIcon: 'content-copy',
        onPress: () => copyToClipboard(requestIDDisplay, {
          title: 'Request ID copied',
          message: `${requestIDDisplay} copied to clipboard.`,
        }),
      });
    }

    // Requested keys (PARTIAL_DATA)
    if (isPartialData && sharedFieldLabels.length > 0) {
      rows.push({
        key: 'requested-keys',
        title: 'Fields to share',
        subtitle: sharedFieldLabels.join(', '),
        rightIcon: 'format-list-checks',
      });
    }

    // Full data warning
    if (isFullData) {
      rows.push({
        key: 'full-data-warning',
        title: 'All data will be shared',
        subtitle: 'The entire signed data object will be returned to the requester.',
        rightIcon: 'alert-circle-outline',
        isError: true,
      });
    }

    // No matching attestations warning
    if (!matchingAttestations || matchingAttestations.length === 0) {
      rows.push({
        key: 'no-match',
        title: 'No matching data found',
        subtitle: signerIAddress
          ? `No data signed by ${signerFqn || signerIAddress} was found on this device.`
          : 'No data matching this request was found on this device.',
        rightIcon: 'alert-circle-outline',
        isError: true,
      });
    }

    return rows;
  }, [dataType, requestType, searchDataKey, signerFqn, signerIAddress,
      requestIDDisplay, isPartialData, isFullData, sharedFieldLabels,
      matchingAttestations]);

  // ── Continue disabled ──
  const continueDisabled = useMemo(() => {
    if (!matchingAttestations || matchingAttestations.length === 0) return true;
    if (!hasResponseURIs) return true;
    return false;
  }, [matchingAttestations, hasResponseURIs]);

  // ── Build and send response ──
  const buildAndSendResponse = async () => {
    try {
      setLoading(true);

      const att = isCollection ? matchingAttestations[0] : matchingAttestations[0];
      if (!att || !att.raw || !att.raw.data) {
        throw new Error('Selected attestation is missing raw data');
      }

      // Build the response payload from the raw stored attestation hex.
      // For PARTIAL_DATA, filter the MMR descriptors to only include
      // the requested keys, then re-serialise the filtered attestation.
      const responseBuffer = createAttestationResponseBuffer(
        att.raw.data,
        isPartialData ? requestedKeys : null,
      );

      // Wrap the binary attestation payload in a DataDescriptor
      const dataDescriptor = new DataDescriptor({
        version: new BN(1),
        objectdata: responseBuffer,
      });

      // Wrap in DataResponseDetails
      const responseDetails = new DataResponseDetails({
        data: dataDescriptor,
      });

      // Wrap in DataResponseOrdinalVDXFObject
      const responseOrdinal = new DataResponseOrdinalVDXFObject({
        data: responseDetails,
      });

      // Attach to the GenericResponse
      const baseResponse = response || new GenericResponse();
      if (baseResponse.details == null) baseResponse.details = [];
      baseResponse.details = [...baseResponse.details, responseOrdinal];

      // Echo the request ID on the outer response so the server can correlate it.
      if (request.hasRequestID() && !baseResponse.requestID) {
        baseResponse.requestID = request.requestID;
      }

      // Ensure the multi-details flag is set when there are 2+ details
      if (baseResponse.details.length > 1 && typeof baseResponse.setHasMultiDetails === 'function') {
        baseResponse.setHasMultiDetails();
      }

      // Set signature using the attestation recipient identity so
      // GenericRequestComplete can sign and deliver the response.
      if (baseResponse.signature == null) {
        let recipientIAddress = att.raw?.recipientId;
        const systemID = att.attestationDetails?.signatureData?.system_ID;

        if (!recipientIAddress || !systemID) {
          throw new Error(
            'Attestation is missing recipient identity or system information. ' +
            'Cannot sign the response.',
          );
        }

        // recipientId may be an FQN (e.g. "name@") rather than an i-address.
        // Resolve it to an i-address via getIdentity if needed.
        if (!recipientIAddress.startsWith('i')) {
          const idResult = await getIdentity(systemID, recipientIAddress);
          if (idResult.error || !idResult.result?.identity?.identityaddress) {
            throw new Error(
              `Could not resolve recipient identity "${recipientIAddress}" to an i-address.`,
            );
          }
          recipientIAddress = idResult.result.identity.identityaddress;
        }

        baseResponse.signature = new VerifiableSignatureData({
          systemID: CompactAddressObject.fromIAddress(systemID),
          identityID: CompactAddressObject.fromIAddress(recipientIAddress),
        });
        baseResponse.setSigned();
      }

      return baseResponse;
    } catch (e) {
      console.error('Error building user data response:', e);
      createAlert('Error', `Failed to build response: ${e.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ── Handle approve ──
  const handleContinue = async () => {
    if (signedIn) {
      if (!matchingAttestations || matchingAttestations.length === 0) {
        createAlert('No data', 'No matching data was found on this device.');
        return;
      }

      // Show confirmation dialog
      const dataTypeLabel = DATA_TYPE_LABELS[dataType] || 'data';
      const requestTypeLabel = REQUEST_TYPE_LABELS[requestType]?.toLowerCase() || 'data';

      createAlert(
        `Share ${requestTypeLabel} data`,
        `Are you sure you want to share your ${dataTypeLabel.toLowerCase()} ${requestTypeLabel} data with ${requesterLabel}?`,
        [
          {
            text: 'No',
            onPress: () => {
              resolveAlert();
            },
          },
          {
            text: 'Yes',
            onPress: async () => {
              resolveAlert();
              const builtResponse = await buildAndSendResponse();
              if (builtResponse) {
                next(builtResponse, [detailIndex]);
              }
            },
          },
        ],
        { cancelable: false },
      );
    } else {
      // Need to sign in first
      setWaitingForSignin(true);

      // Build allowlist from linked IDs
      const allowList = [];
      if (encryptedIds) {
        try {
          const storedIds = await requestServiceStoredData(VERUSID_SERVICE_ID);
          if (storedIds) {
            for (const [iAddr, idData] of Object.entries(storedIds)) {
              if (idData) {
                const chainId = idData.chainId || (requestIsTestnet ? 'VRSCTEST' : 'VRSC');
                const coinObj = CoinDirectory.findCoinObj(chainId, null, true);
                if (coinObj && coinObj.testnet === requestIsTestnet) {
                  allowList.push(iAddr);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Error building allowlist:', e);
        }
      }

      if (allowList.length > 0) {
        openAuthenticateUserModal({ [SEND_MODAL_USER_ALLOWLIST]: allowList });
      } else {
        createAlert(
          'Cannot continue',
          `No ${requestIsTestnet ? 'testnet' : 'mainnet'} profiles found, cannot respond to user data request.`,
        );
      }
    }
  };

  // ── Handle signer details press ──
  const handleSignerDetailsPress = () => {
    if (requestSignerIdentityID && requestSignerSystemID) {
      setVerusIdDetailsModalProps({
        iAddress: requestSignerIdentityID,
        systemId: requestSignerSystemID,
        visible: true,
        onClose: () => setVerusIdDetailsModalProps(null),
      });
    }
  };

  const canOpenSignerModal = !!(requestSignerIdentityID && requestSignerSystemID);

  // ── Hero title / subtitle ──
  const getHeroTitle = () => {
    if (isCollection) return `${searchDataKey?.length || 0} objects`;
    return DATA_TYPE_LABELS[dataType] || 'Data request';
  };

  const getHeroSubtitle = () => {
    return REQUEST_TYPE_LABELS[requestType] || 'Unknown type';
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════

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
          <Text style={styles.mainTitle}>User data request</Text>
        </View>

        {/* Requester card */}
        {isSigned ? (
          <TouchableOpacity
            style={styles.requesterCard}
            onPress={canOpenSignerModal ? handleSignerDetailsPress : undefined}
            activeOpacity={canOpenSignerModal ? 0.7 : 1}
          >
            <View style={styles.requesterHeaderRow}>
              <View style={styles.requesterIconContainer}>
                <MaterialCommunityIcons
                  name="account-lock"
                  size={28}
                  color={Colors.verusGreenColor}
                />
              </View>
              <View style={styles.requesterTextContainer}>
                <Text style={styles.requesterLabel}>Request from</Text>
                <Text style={styles.requesterName}>{requesterLabel}</Text>
                {requesterAddress ? (
                  <Text style={styles.requesterAddress}>{truncateAddress(requesterAddress)}</Text>
                ) : null}
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
              {requestChainId ? (
                <View style={styles.chipContainer}>
                  <Text style={styles.chipText}>{requestChainId}</Text>
                </View>
              ) : null}
              {requestSigDateString ? (
                <View style={styles.chipContainer}>
                  <Text style={styles.chipText}>{requestSigDateString}</Text>
                </View>
              ) : null}
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
                This user data request does not include a verified signer identity.
              </Text>
            </View>
          </View>
        )}

        {/* Hero section */}
        <View style={styles.heroContainer}>
          <Text style={styles.heroAmount}>{getHeroTitle()}</Text>
          <Text style={styles.heroCurrency}>{getHeroSubtitle()}</Text>
        </View>

        {/* Request details section */}
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
                  singleLine={row.singleLine}
                  isError={row.isError}
                />
              ))
            )}
          </View>
        </View>

        {/* Matching attestations section */}
        {matchingAttestations && matchingAttestations.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color="#666" />
                <Text style={styles.sectionTitle}>
                  {isCollection ? 'Matching objects' : 'Matching data'}
                </Text>
              </View>
              {isCollection && (
                <View style={styles.objectCountBadge}>
                  <Text style={styles.objectCountText}>{matchingAttestations.length}</Text>
                </View>
              )}
            </View>
            <View style={styles.sectionContent}>
              {attestationFieldLabels.map((att, attIdx) => (
                <View
                  key={`att-${attIdx}`}
                  style={[
                    styles.attestationItem,
                    attIdx > 0 && styles.detailRowBorder,
                  ]}
                >
                  <Text style={styles.attestationName}>{att.name}</Text>
                  {att.fields.length > 0 ? (
                    att.fields.map((field, fIdx) => {
                      const isShared = !isPartialData || (requestedKeys && requestedKeys.some(
                        k => friendlyKeyLabel(k) === field
                      ));
                      return (
                        <View key={`field-${fIdx}`} style={styles.fieldRow}>
                          <MaterialCommunityIcons
                            name={isShared ? 'eye' : 'eye-off'}
                            size={14}
                            color={isShared ? Colors.verusGreenColor : '#BBB'}
                          />
                          <Text
                            style={[
                              styles.fieldLabel,
                              !isShared && styles.fieldLabelHashed,
                            ]}
                          >
                            {field}
                          </Text>
                          {isPartialData && !isShared && (
                            <Text style={styles.hashBadge}>hash only</Text>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noFieldsText}>No fields available</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* No response URIs warning */}
        {!hasResponseURIs && (
          <View style={styles.unsignedCard}>
            <View style={styles.unsignedIconContainer}>
              <MaterialCommunityIcons name="link-off" size={24} color="#B45309" />
            </View>
            <View style={styles.unsignedTextContainer}>
              <Text style={styles.unsignedTitle}>No response URI</Text>
              <Text style={styles.unsignedSubtitle}>
                This request does not include a response URI. Your data cannot be returned to the requester.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Footer buttons */}
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 16) }]}>
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
            disabled={continueDisabled}
          >
            Continue
          </GradientButton>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════════

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
  requesterAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  detailRowError: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 3,
    borderLeftColor: '#C62828',
  },
  detailTitleError: {
    color: '#C62828',
    fontWeight: '600',
  },
  detailSubtitleError: {
    color: '#D32F2F',
  },
  // Attestation items
  attestationItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  attestationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingLeft: 4,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  fieldLabelHashed: {
    color: '#AAA',
  },
  hashBadge: {
    fontSize: 10,
    color: '#AAA',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noFieldsText: {
    fontSize: 12,
    color: '#AAA',
    fontStyle: 'italic',
  },
  // Footer
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

export default UserDataRequestInfo;
