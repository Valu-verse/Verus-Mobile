import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View, StatusBar, Platform, Image, ActivityIndicator } from 'react-native';
import { Button, Portal, Text } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { 
  DataPacketRequestDetails, 
  DataDescriptor,
  DataResponseDetails,
  DataResponseOrdinalVDXFObject,
  GenericResponse,
  VerifiableSignatureData,
  CompactAddressObject,
  SignatureData,
  VdxfUniValue,
  CrossChainDataRef,
  URLRef,
  AuthenticationRequestOrdinalVDXFObject,
  RecipientConstraint,
  MMRDescriptor,
  DATA_TYPE_DEFINEDKEY,
  DefinedKey,
  IDENTITY_ATTESTATION_RECIPIENT,
  ATTESTATION_TYPE,
  ATTESTATION_ID,
  ATTESTATION_NAME,
  IDENTITY_ATTESTOR
} from 'verus-typescript-primitives';
import * as VDXF_Data from 'verus-typescript-primitives/dist/vdxf/vdxfdatakeys';
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
import { getIdentityContent } from '../../../utils/api/channels/verusid/requests/getIdentityContent';
import { capitalizeString } from '../../../utils/stringUtils';
import { serializeStoredAttestation } from '../../../utils/attestations/serializedAttestation';
import { BN } from 'bn.js';
import { requestServiceStoredData } from '../../../utils/auth/authBox';
import { VERUSID_SERVICE_ID } from '../../../utils/constants/services';
import { ATTESTATIONS_PROVISIONED } from '../../../utils/constants/attestations';
import { signHash } from '../../../utils/api/channels/vrpc/requests/signHash';
import { getInfo } from '../../../utils/api/channels/vrpc/callCreators';
import { modifyAttestationDataForUser } from '../../../actions/actions/attestations/dispatchers/attestations';
import SemiModal from '../../../components/SemiModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
const crypto = require('create-hash');

// Data packet storage type constant
const DATA_PACKETS_RECEIVED = "data_packets_received";

const ATTESTATION_REQUIRED_LABELS = {
  identityAttestor: IDENTITY_ATTESTOR.vdxfid,
  attestationRecipient: IDENTITY_ATTESTATION_RECIPIENT.vdxfid,
  attestationId: ATTESTATION_ID.vdxfid,
  attestationName: ATTESTATION_NAME.vdxfid,
  attestationType: ATTESTATION_TYPE.vdxfid,
};
const ATTESTATION_RECIPIENT_VDXF_ID = IDENTITY_ATTESTATION_RECIPIENT.vdxfid;
const RECEIVING_IDENTITY_LABEL = 'receiving_identity';

const truncateAddress = (addr) => {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
};

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

// Statement Detail Modal for viewing full statement text
const StatementModal = ({ visible, statement, onClose }) => {
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;
  
  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        title="Statement"
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          width: '100%',
          alignSelf: 'flex-end',
          paddingBottom: 16 + insets.bottom,
          maxHeight: '70%',
        }}
      >
        <ScrollView style={styles.statementModalContent}>
          <Text style={styles.statementModalText}>{statement}</Text>
        </ScrollView>
        <View style={styles.statementModalActions}>
          <Button
            mode="contained"
            onPress={() => copyToClipboard(statement, {
              title: 'Statement copied',
              message: 'Statement copied to clipboard.',
            })}
            style={styles.statementCopyButton}
            buttonColor="#EBF6FF"
            textColor={Colors.primaryColor}
          >
            Copy to clipboard
          </Button>
        </View>
      </SemiModal>
    </Portal>
  );
};

// Identity Picker Sheet for selecting signing identity
const IdentityPickerSheet = ({
  visible,
  linkedIds,
  sortedIds,
  selectedIdentity,
  onClose,
  onSelect,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;

  if (!visible) return null;

  const hasIdentities = Object.keys(sortedIds).some(chainId =>
    sortedIds[chainId] && sortedIds[chainId].length > 0
  );

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        title="Select identity to sign"
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          width: '100%',
          alignSelf: 'flex-end',
          paddingBottom,
          maxHeight: '70%',
        }}
      >
        <View>
          <View style={styles.sheetDescription}>
            <Text style={styles.sheetDescriptionText}>
              Choose a VerusID to sign this data packet.
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 400 }}>
            <View style={styles.listContainer}>
              {!hasIdentities && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No linked identities found.
                  </Text>
                </View>
              )}

              {Object.keys(sortedIds).map(chainId => {
                const identities = sortedIds[chainId];
                if (!identities || identities.length === 0) return null;

                return (
                  <View key={chainId} style={styles.networkGroup}>
                    <View style={styles.networkHeader}>
                      <Text style={styles.networkHeaderText}>{chainId}</Text>
                    </View>

                    {identities.map(iAddr => {
                      const friendlyName = linkedIds[chainId]?.[iAddr] || iAddr;
                      const isSelected =
                        selectedIdentity &&
                        selectedIdentity.chainId === chainId &&
                        selectedIdentity.iAddress === iAddr;

                      return (
                        <TouchableOpacity
                          key={iAddr}
                          style={[
                            styles.identityCard,
                            isSelected && styles.identityCardSelected,
                          ]}
                          onPress={() => onSelect(chainId, iAddr, friendlyName)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.identityIconContainer}>
                            <MaterialCommunityIcons
                              name="account"
                              size={22}
                              color={isSelected ? Colors.verusGreenColor : '#666'}
                            />
                          </View>
                          <View style={styles.identityTextSection}>
                            <Text
                              style={[
                                styles.identityName,
                                isSelected && styles.identityNameSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {friendlyName}
                            </Text>
                            <Text
                              style={styles.identityAddress}
                              numberOfLines={1}
                            >
                              {truncateAddress(iAddr)}
                            </Text>
                          </View>

                          {isSelected ? (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={20}
                              color={Colors.verusGreenColor}
                              style={styles.chevron}
                            />
                          ) : (
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={20}
                              color="#CCC"
                              style={styles.chevron}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </SemiModal>
    </Portal>
  );
};

// URL Download Modal
const UrlDownloadModal = ({ 
  visible, 
  url, 
  onClose, 
  onDownload, 
  downloading, 
  downloadError,
  downloadedContent,
  contentMimeType,
  hashVerified,
  attestationDescriptors,
  attestationAccepted,
  attestationTitle,
  attestationSigner,
  onAcceptAttestation,
  onRejectAttestation,
  onDescriptorPress,
}) => {
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;
  
  const isTextContent = contentMimeType?.startsWith('text/');
  const isImageContent = contentMimeType?.startsWith('image/');
  const isAttestation = contentMimeType === 'application/attestation';
  
  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        title="Download Data"
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          width: '100%',
          alignSelf: 'flex-end',
          paddingBottom: 16 + insets.bottom,
          maxHeight: '80%',
        }}
      >
        <ScrollView style={styles.downloadModalContent}>
          <View style={styles.downloadUrlContainer}>
            <MaterialCommunityIcons name="link-variant" size={20} color="#666" />
            <Text style={styles.downloadUrl} numberOfLines={2}>{url}</Text>
          </View>
          
          {downloadError && (
            <View style={styles.downloadErrorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#C62828" />
              <Text style={styles.downloadErrorText}>{downloadError}</Text>
            </View>
          )}
          
          {downloading && (
            <View style={styles.downloadingContainer}>
              <ActivityIndicator size="small" color={Colors.primaryColor} />
              <Text style={styles.downloadingText}>Downloading...</Text>
            </View>
          )}
          
          {downloadedContent && !downloading && (
            <View style={styles.downloadedContentContainer}>
              {hashVerified === true && (
                <View style={styles.hashVerifiedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={18} color="#2E7D32" />
                  <Text style={styles.hashVerifiedText}>Hash verified</Text>
                </View>
              )}
              {hashVerified === false && (
                <View style={styles.hashFailedBadge}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#C62828" />
                  <Text style={styles.hashFailedText}>Hash verification failed</Text>
                </View>
              )}
              
              {isAttestation && (
                <View style={styles.attestationSuccessContainer}>
                  <MaterialCommunityIcons name="certificate" size={24} color={Colors.primaryColor} />
                  <Text style={styles.attestationSuccessText}>{downloadedContent}</Text>
                  {attestationTitle ? (
                    <Text style={styles.attestationMetaText}>Title: {attestationTitle}</Text>
                  ) : null}
                  {attestationSigner ? (
                    <Text style={styles.attestationMetaText}>Signer: {attestationSigner}</Text>
                  ) : null}
                  <View style={styles.attestationListContainer}>
                    <DataDescriptorList
                      descriptors={attestationDescriptors || []}
                      onItemPress={onDescriptorPress}
                      emptyMessage="No attestation fields available"
                    />
                  </View>
                </View>
              )}
              
              {isTextContent && !isAttestation && (
                <View style={styles.textContentPreview}>
                  <Text style={styles.previewLabel}>Content Preview:</Text>
                  <Text style={styles.textContent}>{downloadedContent.substring(0, 500)}{downloadedContent.length > 500 ? '...' : ''}</Text>
                </View>
              )}
              
              {isImageContent && (
                <View style={styles.imageContentPreview}>
                  <Text style={styles.previewLabel}>Image Preview:</Text>
                  <Image 
                    source={{ uri: `data:${contentMimeType};base64,${downloadedContent}` }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>
        
        <View style={styles.downloadModalActions}>
          {!downloadedContent && !downloading && (
            <GradientButton onPress={onDownload} style={styles.downloadButton}>
              Download
            </GradientButton>
          )}
          {isAttestation && downloadedContent && hashVerified === true && !attestationAccepted && (
            <>
              <GradientButton onPress={onAcceptAttestation} style={styles.downloadButton}>
                Accept attestation
              </GradientButton>
              <Button
                mode="contained"
                onPress={onRejectAttestation || onClose}
                buttonColor="#EBF6FF"
                textColor={Colors.primaryColor}
                style={styles.rejectDownloadButton}
                contentStyle={styles.rejectDownloadButtonContent}
              >
                Reject
              </Button>
            </>
          )}
          {downloadedContent && hashVerified === true && (!isAttestation || attestationAccepted) && (
            <GradientButton onPress={onClose} style={styles.downloadButton}>
              Continue
            </GradientButton>
          )}
          {(downloading || (downloadedContent && hashVerified !== true)) && (
            <Button
              mode="contained"
              onPress={onClose}
              buttonColor="#EBF6FF"
              textColor={Colors.primaryColor}
              style={styles.cancelDownloadButton}
            >
              Cancel
            </Button>
          )}
        </View>
      </SemiModal>
    </Portal>
  );
};

const DataPacketRequestInfo = props => {
  const {
    detailsBufferString,
    isSigned,
    requestSignerFqn,
    requestSignerIdentityID,
    requestSignerSystemID,
    requestSigtime,
    embeddedSignerFqn,
    embeddedSignerIdentityID,
    embeddedSignerSystemID,
    embeddedSigtime,
    embeddedIsSignatureValid,
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
  const [requestSigDateString, setRequestSigDateString] = useState(unixToDate(requestSigtime));
  const [embeddedSigDateString, setEmbeddedSigDateString] = useState(unixToDate(embeddedSigtime));
  const [waitingForSignin, setWaitingForSignin] = useState(false);
  
  // Statement modal state
  const [statementModalVisible, setStatementModalVisible] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState('');
  
  // Identity picker state (for FLAG_FOR_USERS_SIGNATURE)
  const [linkedIds, setLinkedIds] = useState({});
  const [sortedIds, setSortedIds] = useState({});
  const [identitySheetVisible, setIdentitySheetVisible] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  
  // Recipient constraint state (from AuthenticationRequestDetails if present)
  const [recipientConstraintIds, setRecipientConstraintIds] = useState(new Set());
  const [recipientId, setRecipientId] = useState("");

  // URL download state (for FLAG_HAS_URL_FOR_DOWNLOAD)
  const [urlDownloadModalVisible, setUrlDownloadModalVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [downloadedContent, setDownloadedContent] = useState(null);
  const [contentMimeType, setContentMimeType] = useState(null);
  const [hashVerified, setHashVerified] = useState(null);
  const [urlRef, setUrlRef] = useState(null);
  const [downloadedDataDescriptor, setDownloadedDataDescriptor] = useState(null);
  const [pendingAttestationData, setPendingAttestationData] = useState(null);
  const [pendingAttestationDescriptors, setPendingAttestationDescriptors] = useState([]);
  const [pendingAttestationSigner, setPendingAttestationSigner] = useState(null);
  const [attestationAccepted, setAttestationAccepted] = useState(false);

  const accounts = useObjectSelector(state => state.authentication.accounts);
  const signedIn = useSelector(state => state.authentication.signedIn);
  const sendModalType = useSelector(state => state.sendModal.type);
  const activeAccount = useObjectSelector(state => state.authentication.activeAccount);
  const encryptedIds = useObjectSelector(state => state.services.stored[VERUSID_SERVICE_ID]);

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

  // Derive chain IDs for outer request signer and embedded signer
  const requestChainId = requestSignerSystemID ? getSystemNameFromSystemId(requestSignerSystemID) : null;
  const embeddedChainId = embeddedSignerSystemID ? getSystemNameFromSystemId(embeddedSignerSystemID) : null;

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

  const handleRequestSignerDetailsPress = () => {
    if (!requestChainId || !requestSignerIdentityID) {
      createAlert('Signer unavailable', 'No signer identity is available for this request.');
      return;
    }
    openVerusIdDetailsModal(requestChainId, requestSignerIdentityID);
  };

  const handleEmbeddedSignerDetailsPress = () => {
    if (!embeddedChainId || !embeddedSignerIdentityID) {
      createAlert('Signer unavailable', 'No embedded signer identity is available.');
      return;
    }
    openVerusIdDetailsModal(embeddedChainId, embeddedSignerIdentityID);
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

  // Generate random salt (32 bytes as hex)
  const generateRandomSalt = () => {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return Buffer.from(bytes).toString('hex');
  };

  // Sign the DataPacketRequestDetails and create DataResponseDetails
  const signAndCreateResponse = async () => {
    if (!selectedIdentity) {
      createAlert('Error', 'Please select an identity to sign with.');
      return null;
    }

    try {
      setLoading(true);
      
      const { chainId, iAddress } = selectedIdentity;
      const coinObjForSign = CoinDirectory.findCoinObj(chainId, null, true);
      const systemId = coinObjForSign.system_id;
      
      // Get current chain height
      const chainInfo = await getInfo(systemId);
      if (chainInfo.error) throw new Error(chainInfo.error.message);
      const height = chainInfo.result.longestchain;
      
      // Hash the entire DataPacketRequestDetails buffer
      const detailsBuffer = details.toBuffer();
      const signatureHash = crypto('sha256').update(detailsBuffer).digest();
      
      // Create SignatureData object
      const sigData = new SignatureData({
        version: new BN(1),
        system_ID: systemId,
        identity_ID: iAddress,
        signature_hash: signatureHash,
        hash_type: new BN(5), // SHA256
        sig_type: new BN(1), // TYPE_VERUSID_DEFAULT
      });
      
      // Get the identity hash for signing
      const sigHash = sigData.getIdentityHash({ version: 2, hash_type: 5, height });
      
      // Sign the hash
      const signature = await signHash(coinObjForSign, iAddress, sigHash, height);
      sigData.signature_as_vch = Buffer.from(signature, 'base64');
      
      // Create VdxfUniValue with SignatureData
      const dataKeyMap = [];
      dataKeyMap.push({ [VDXF_Data.SignatureDataKey.vdxfid]: sigData });
      const signatureUniValue = new VdxfUniValue({ values: dataKeyMap });
      
      // Create nested DataDescriptor with signature
      const nestedDescriptor = DataDescriptor.fromJson({
        version: 1,
        flags: 2, // FLAG_SALT_PRESENT
        objectdata: signatureUniValue.toBuffer().toString('hex'),
        salt: generateRandomSalt(),
      });
      
      // Create DataResponseDetails
      const responseDetails = new DataResponseDetails({
        data: nestedDescriptor,
        requestID: details.requestID,
      });
      
      // Create DataResponseOrdinalVDXFObject
      const responseOrdinal = new DataResponseOrdinalVDXFObject({
        data: responseDetails,
      });
      
      // Build the GenericResponse
      const baseResponse = response || new GenericResponse();
      if (baseResponse.details == null) baseResponse.details = [];
      baseResponse.details = [...baseResponse.details, responseOrdinal];
      
      // Set signature info for the outer response
      if (baseResponse.signature == null) {
        baseResponse.signature = new VerifiableSignatureData({
          systemID: CompactAddressObject.fromIAddress(systemId),
          identityID: CompactAddressObject.fromIAddress(iAddress),
        });
        baseResponse.setSigned();
      }
      
      return baseResponse;
    } catch (e) {
      console.error('Error signing data packet:', e);
      createAlert('Error', `Failed to sign data packet: ${e.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Store data packet for transmittal (FLAG_FOR_TRANSMITTAL_TO_USER)
  const storeDataPacket = async () => {
    try {
      if (!activeAccount) {
        throw new Error('No active account');
      }
      
      const packetId = details.requestID?.toIAddress?.() || `packet_${Date.now()}`;
      const dataToStore = {
        [packetId]: {
          name: requestSignerFqn || embeddedSignerFqn || 'Data Packet',
          signer: requestSignerFqn || requestSignerIdentityID || embeddedSignerFqn || embeddedSignerIdentityID || 'Unknown',
          signerIdentityID: requestSignerIdentityID || embeddedSignerIdentityID,
          signerSystemID: requestSignerSystemID || embeddedSignerSystemID,
          recipientId: recipientId,
          data: detailsBufferString,
          timestamp: Date.now(),
          sigtime: requestSigtime || embeddedSigtime,
          isSignatureValid: embeddedIsSignatureValid,
          type: 'data_packet',
          statements: details.statements || [],
          signableObjectsCount: details.signableObjects?.length || 0,
        }
      };
      
      await modifyAttestationDataForUser(dataToStore, DATA_PACKETS_RECEIVED, activeAccount.accountHash);
      
      createAlert('Saved', 'Data packet has been saved to your wallet.');
    } catch (e) {
      console.error('Error storing data packet:', e);
      createAlert('Error', `Failed to save data packet: ${e.message}`);
    }
  };

  // Extract URLRef from signableObjects
  const extractUrlRef = () => {
    if (!details.signableObjects || details.signableObjects.length === 0) return null;
    
    const firstObj = details.signableObjects[0];
    
    // Check if the objectdata contains a CrossChainDataRef with URLRef
    if (firstObj.objectdata) {
      try {
        // Get the objectdata as a Buffer
        let dataBuffer;
        if (typeof firstObj.objectdata === 'string') {
          dataBuffer = Buffer.from(firstObj.objectdata, 'hex');
        } else if (Buffer.isBuffer(firstObj.objectdata)) {
          dataBuffer = firstObj.objectdata;
        } else if (firstObj.objectdata?.type === 'Buffer' && Array.isArray(firstObj.objectdata?.data)) {
          dataBuffer = Buffer.from(firstObj.objectdata.data);
        }
        
        if (dataBuffer && dataBuffer.length > 0) {
     
          // Parse using VdxfUniValue - the data is serialized as:
          // VdxfUniValue { values: [{ CrossChainDataRefKey.vdxfid: CrossChainDataRef(URLRef) }] }
          const uniValue = new VdxfUniValue();
          uniValue.fromBuffer(dataBuffer);
          
          // Look for CrossChainDataRef in values
          if (uniValue.values && uniValue.values.length > 0) {
            for (const valueItem of uniValue.values) {
              const crossChainRefKey = VDXF_Data.CrossChainDataRefKey?.vdxfid;
              if (crossChainRefKey && valueItem[crossChainRefKey]) {
                
                // CrossChainDataRef.ref contains the URLRef
                if (valueItem[crossChainRefKey]?.ref && valueItem[crossChainRefKey].ref.url) {
                  return valueItem[crossChainRefKey].ref;
                }
              }
            }
          }
        }
        
        // Fallback: try to access via the inflated data structure
        if (typeof firstObj.objectdata === 'object' && firstObj.objectdata !== null && !Buffer.isBuffer(firstObj.objectdata)) {
          const crossChainRefFromKey = firstObj.objectdata[VDXF_Data.CrossChainDataRefKey?.vdxfid];
          if (crossChainRefFromKey && crossChainRefFromKey.ref && crossChainRefFromKey.ref.url) {
            return crossChainRefFromKey.ref;
          }
          if (crossChainRefFromKey && crossChainRefFromKey.url) {
            return crossChainRefFromKey;
          }
        }
      } catch (e) {
        console.warn('Error extracting URLRef:', e);
      }
    }
    
    return null;
  };

  // Helper function to extract attestation objects from UniValue objectdata
  const extractAttestationFromUniValue = (objectdata) => {
    try {
      // objectdata is expected to be a serialized VdxfUniValue buffer
      let dataBuffer;
      if (typeof objectdata === 'string') {
        dataBuffer = Buffer.from(objectdata, 'hex');
      } else if (Buffer.isBuffer(objectdata)) {
        dataBuffer = objectdata;
      } else if (objectdata?.type === 'Buffer' && Array.isArray(objectdata?.data)) {
        dataBuffer = Buffer.from(objectdata.data);
      } else {
        return null;
      }

      if (!dataBuffer || dataBuffer.length === 0) {
        return null;
      }

      // Parse as VdxfUniValue
      const uniValue = new VdxfUniValue();
      uniValue.fromBuffer(dataBuffer);

      if (!uniValue.values || uniValue.values.length === 0) {
        return null;
      }

      let mmrDescriptor = null;
      let signatureData = null;
      const mmrKey = VDXF_Data.MMRDescriptorKey?.vdxfid;
      const signatureKey = VDXF_Data.SignatureDataKey?.vdxfid;

      for (const valueItem of uniValue.values) {
        if (!valueItem || typeof valueItem !== 'object') continue;

        if (mmrKey && Object.prototype.hasOwnProperty.call(valueItem, mmrKey)) {
          const mmrValue = valueItem[mmrKey];
          if (mmrValue instanceof MMRDescriptor || (mmrValue && typeof mmrValue.toBuffer === 'function')) {
            mmrDescriptor = { id: mmrKey, data: mmrValue };
          }
        }

        if (signatureKey && Object.prototype.hasOwnProperty.call(valueItem, signatureKey)) {
          const signatureValue = valueItem[signatureKey];
          if (signatureValue instanceof SignatureData || (signatureValue && typeof signatureValue.toBuffer === 'function')) {
            signatureData = { id: signatureKey, data: signatureValue };
          }
        }
      }

      if (mmrDescriptor && signatureData) {
        const mmrValue = mmrDescriptor.data;
        const descriptorItems = mmrValue?.dataDescriptors || mmrValue?.datadescriptors || [];
        const descriptorLabels = [];
        const normalizedDescriptors = [];
        let attestationName = null;

        for (const descriptor of descriptorItems) {
          let descriptorLabel = null;
          let descriptorMessage = null;
          let normalizedDescriptor = null;

          if (descriptor && typeof descriptor.toJson === 'function') {
            const descriptorJson = descriptor.toJson();
            const vdxfPayload = descriptorJson?.objectdata?.[VDXF_Data.DataDescriptorKey?.vdxfid];
            descriptorLabel = vdxfPayload?.label || descriptorJson?.label || null;
            descriptorMessage = vdxfPayload?.objectdata?.message || descriptorJson?.objectdata?.message || null;
            normalizedDescriptor = vdxfPayload || descriptorJson;
          } else {
            descriptorLabel = descriptor?.label || null;
            descriptorMessage = descriptor?.objectdata?.message || null;
            normalizedDescriptor = descriptor;
          }

          if (descriptorLabel) {
            descriptorLabels.push(descriptorLabel);
          }

          if (normalizedDescriptor) {
            normalizedDescriptors.push(normalizedDescriptor);
          }

          if (descriptorLabel === ATTESTATION_NAME.vdxfid && descriptorMessage) {
            attestationName = descriptorMessage;
          }
        }

        const missingRequiredLabels = Object.values(ATTESTATION_REQUIRED_LABELS).filter(
          requiredLabel => !descriptorLabels.includes(requiredLabel)
        );

        return {
          type: 'attestation',
          mmrDescriptor,
          signatureData,
          label: attestationName || 'downloaded proof',
          data: dataBuffer.toString('hex'),
          descriptorLabels,
          descriptors: normalizedDescriptors,
          missingRequiredLabels,
        };
      }

      return null;
    } catch (e) {
      console.warn('Error extracting attestation from UniValue:', e);
      return null;
    }
  };

  // Helper function to store attestation data
  // Uses the same extraction and storage format as LoginReceiveAttestation
  // so attestations are backwards compatible with existing wallet entries
  const storeAttestationDataDownload = async (attestationData) => {
    try {
      if (!activeAccount) {
        throw new Error('No active account');
      }

      const mmrData = attestationData.mmrDescriptor.data;
      const sigData = attestationData.signatureData.data;
      const descriptorKeyId = VDXF_Data.DataDescriptorKey?.vdxfid;

      // MMR hash as key (same as LoginReceiveAttestation.extractMmrHash)
      let mmrHash;
      try {
        mmrHash = Buffer.from(mmrData.mmrRoot.objectdata).reverse().toString('hex');
      } catch (e) {
        mmrHash = `attestation_${Date.now()}`;
      }

      // Helper to get label and message from a DataDescriptor.
      // Handles two formats:
      //   1) Nested: toJson().objectdata[DataDescriptorKey] = { label, objectdata: { message } }
      //   2) Flat:   toJson() = { label, objectdata: { message } }
      const getDescriptorLabelAndMessage = (descriptor) => {
        const json = descriptor.toJson();
        const nested = json?.objectdata?.[descriptorKeyId];
        if (nested?.label) {
          return { label: nested.label, message: nested?.objectdata?.message };
        }
        return { label: json?.label || null, message: json?.objectdata?.message || null };
      };

      // Attestation name
      let extractedName = null;
      // Internal ID
      let extractedId = null;
      // Recipient ID — prioritise 'receiving_identity' over IDENTITY_ATTESTATION_RECIPIENT
      let receivingIdentity = null;
      let attestationRecipient = null;

      try {
        for (const descriptor of mmrData.dataDescriptors) {
          const { label, message } = getDescriptorLabelAndMessage(descriptor);
          if (!label) continue;

          if (label === ATTESTATION_NAME.vdxfid && message) {
            extractedName = message;
          }
          if (label === 'i6htkAtLSyUFr1YBFD13U9TSgPgQe2yDQZ' && message) {
            extractedId = message;
          }
          if (label === 'receiving_identity' && message) {
            receivingIdentity = message;
          }
          if (label === IDENTITY_ATTESTATION_RECIPIENT.vdxfid && message) {
            attestationRecipient = message;
          }
        }
      } catch (e) {
        // Extraction errors are non-fatal
      }

      // Resolve recipient to i-address so attestations can be matched reliably
      let resolvedRecipientId = null;
      const extractedRecipient = receivingIdentity || attestationRecipient || null;

      // Prefer the recipientId state (already an i-address from constraint matching)
      if (recipientId) {
        resolvedRecipientId = recipientId;
      } else if (extractedRecipient) {
        // Extracted value may be a friendly name — resolve to i-address
        try {
          const systemId = requestSignerSystemID || embeddedSignerSystemID;
          if (systemId) {
            const identityRes = await getIdentity(systemId, extractedRecipient);
            if (!identityRes.error && identityRes.result?.identity?.identityaddress) {
              resolvedRecipientId = identityRes.result.identity.identityaddress;
            }
          }
        } catch (e) {
          // Resolution failed — store null rather than a name that won't match
        }
      }

      // Store in same format as LoginReceiveAttestation
      const dataToStore = {
        [mmrHash]: {
          name: extractedName || attestationData.label || 'downloaded proof',
          signer: attestationData.signerDisplayName || embeddedSignerFqn || embeddedSignerIdentityID || 'Unknown Signer',
          data: serializeStoredAttestation(mmrData, sigData).toString('hex'),
          timestamp: Date.now(),
          id: undefined,
          validated: true,
          internal_id: extractedId,
          recipientId: resolvedRecipientId,
        }
      };

      await modifyAttestationDataForUser(dataToStore, ATTESTATIONS_PROVISIONED, activeAccount.accountHash);
      return true;
    } catch (e) {
      console.error('Error storing attestation data:', e);
      throw e;
    }
  };

  const resolveSignerDefinedKeyLabels = async () => {
    const resolvedLabels = {};

    try {
      const signerSystemId = requestSignerSystemID || embeddedSignerSystemID;
      const signingIAddr = requestSignerIdentityID || embeddedSignerIdentityID;

      if (!signerSystemId || !signingIAddr) {
        return resolvedLabels;
      }

      const contentRes = await getIdentityContent(signerSystemId, signingIAddr);
      if (contentRes.error) {
        throw new Error(contentRes.error.message);
      }

      const signerIdentity = contentRes.result.identity;
      const definedKeyContent = signerIdentity?.contentmultimap?.[DATA_TYPE_DEFINEDKEY.vdxfid];
      const definedKeyBufs = Array.isArray(definedKeyContent) ? definedKeyContent : definedKeyContent ? [definedKeyContent] : [];

      for (const definedKeyHex of definedKeyBufs) {
        try {
          const definedKey = new DefinedKey();
          definedKey.fromBuffer(Buffer.from(definedKeyHex, 'hex'));

          const iAddr = definedKey.getIAddr();
          const ns = definedKey.getNameSpaceID();
          if (ns !== signerIdentity.identityaddress) {
            continue;
          }

          const splitUri = definedKey.vdxfuri.split('::');
          const label = splitUri.length > 1 ? splitUri[1] : splitUri[0];
          resolvedLabels[iAddr] = capitalizeString(label.split('.').join(' '));
        } catch (e) {
          console.warn('Failed to parse signer defined key:', e);
        }
      }
    } catch (e) {
      console.warn('Failed to resolve signer defined key labels:', e);
    }

    return resolvedLabels;
  };

  const buildAttestationPreviewDescriptors = async (attestationData) => {
    const signerDefinedLabels = await resolveSignerDefinedKeyLabels();

    return processDataDescriptors(attestationData?.descriptors || []).map(descriptor => ({
      ...descriptor,
      title:
        signerDefinedLabels[descriptor.label] ||
        (descriptor.label === ATTESTATION_NAME.vdxfid ? 'Attestation Name' : descriptor.title),
    }));
  };

  const resolveAttestationSignerDisplayName = async (attestationData) => {
    try {
      const signatureObject = attestationData?.signatureData?.data;
      if (!signatureObject) {
        return embeddedSignerFqn || embeddedSignerIdentityID || 'Unknown signer';
      }

      const identityId = signatureObject.identity_ID || signatureObject.identityid || signatureObject?.toJson?.()?.identityid;
      const systemId = signatureObject.system_ID || signatureObject.systemid || signatureObject?.toJson?.()?.systemid;

      if (!identityId || !systemId) {
        return embeddedSignerFqn || embeddedSignerIdentityID || identityId || 'Unknown signer';
      }

      const identityResult = await getIdentity(systemId, identityId);
      const fqn = identityResult?.result?.fullyqualifiedname;
      if (fqn) {
        return convertFqnToDisplayFormat(fqn);
      }

      return identityId;
    } catch (e) {
      console.warn('Failed to resolve attestation signer friendly name:', e);
      return embeddedSignerFqn || embeddedSignerIdentityID || 'Unknown signer';
    }
  };

  const handleAcceptDownloadedAttestation = async () => {
    if (!pendingAttestationData) return;

    try {
      setLoading(true);
      await storeAttestationDataDownload(pendingAttestationData);
      setAttestationAccepted(true);
      setDownloadedContent(`Attestation \"${pendingAttestationData.label || 'downloaded proof'}\" accepted.`);
      setUrlDownloadModalVisible(false);
    } catch (e) {
      createAlert('Error', `Failed to save attestation: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDownloadedAttestation = () => {
    setPendingAttestationData(null);
    setPendingAttestationDescriptors([]);
    setPendingAttestationSigner(null);
    setAttestationAccepted(false);
    setDownloadedContent(null);
    setContentMimeType(null);
    setHashVerified(null);
    setUrlDownloadModalVisible(false);
  };

  // Download data from URL and verify hash
  const handleDownload = async () => {
    if (!urlRef || !urlRef.url) {
      setDownloadError('No URL available for download');
      return;
    }
    
    // Check if data_hash is present (optional - we can download without verification)
    const flagValue = urlRef.flags instanceof BN ? urlRef.flags : new BN(urlRef.flags || 0);
    const FLAG_HAS_HASH = URLRef?.FLAG_HAS_HASH || new BN(1);
    const hasHash = flagValue.and(FLAG_HAS_HASH).gt(new BN(0)) && urlRef.data_hash && urlRef.data_hash.length > 0;
    
    try {
      setDownloading(true);
      setDownloadError(null);
      
      const downloadResponse = await axios.get(urlRef.url, {
        timeout: 30000,
      });
      
      const dataBuffer = Buffer.from(downloadResponse.data, 'hex');
      
      // Try to determine content type from response headers
      const contentTypeHeader = downloadResponse.headers?.['content-type'] || '';
      
      // If we have a hash, verify it
      if (hasHash) {
        const downloadedHash = crypto('sha256').update(dataBuffer).digest();
        const expectedHash = urlRef.data_hash;
        const hashMatches = downloadedHash.equals(expectedHash);
        
        setHashVerified(hashMatches);

        if (!hashMatches) {
          setDownloadError('Downloaded data hash does not match expected hash');
          setDownloading(false);
          return;
        }
      } else {
        // No hash to verify - mark as verified (trusted download)
        setHashVerified(true);
      }
      
      // Try to parse as DataDescriptor first
      let downloadedDescriptor = null;
      let attestationData = null;
      let mimeType = 'text/plain';
      let content = '';
      
      try {
        downloadedDescriptor = new DataDescriptor();
        downloadedDescriptor.fromBuffer(dataBuffer);
        setDownloadedDataDescriptor(downloadedDescriptor);
        
        // Check if this is an attestation (no mimetype and contains UniValue objects)
        if (!downloadedDescriptor.mimeType || downloadedDescriptor.mimeType === '') {
          attestationData = extractAttestationFromUniValue(downloadedDescriptor.objectdata);
          
          if (attestationData) {
            const signerDisplayName = await resolveAttestationSignerDisplayName(attestationData);
            const previewDescriptors = await buildAttestationPreviewDescriptors(attestationData);
            const attestationPayload = {
              ...attestationData,
              signerDisplayName,
            };
            setPendingAttestationData(attestationPayload);
            setPendingAttestationDescriptors(previewDescriptors);
            setPendingAttestationSigner(signerDisplayName);
            setAttestationAccepted(false);
            
            // Set content to indicate attestation should be reviewed
            mimeType = 'application/attestation';
            content = `Review this attestation before accepting it.`;
            attestationData = attestationPayload;
          }
        }
        
        // If not an attestation, process as regular content
        if (!attestationData) {
          mimeType = downloadedDescriptor.mimeType || 'application/octet-stream';
          
          if (mimeType && mimeType.startsWith('text/')) {
            content = downloadedDescriptor.objectdata?.toString?.('utf-8') || 
                      Buffer.from(downloadedDescriptor.objectdata || '').toString('utf-8');
          } else if (mimeType && mimeType.startsWith('image/')) {
            content = Buffer.from(downloadedDescriptor.objectdata || '').toString('base64');
          } else if (mimeType === 'application/octet-stream') {
            // Try to detect if it's text
            const objectdataBuffer = Buffer.isBuffer(downloadedDescriptor.objectdata) 
              ? downloadedDescriptor.objectdata 
              : Buffer.from(downloadedDescriptor.objectdata || '');
            const sample = objectdataBuffer.slice(0, 100).toString('utf-8');
            const isText = /^[\x20-\x7E\s\n\r\t]+$/.test(sample);
            if (isText) {
              mimeType = 'text/plain';
              content = objectdataBuffer.toString('utf-8');
            } else {
              setDownloadError('Unsupported content type. Only text, images, and attestations are supported.');
              setHashVerified(null);
              return;
            }
          }
        }
      } catch (parseErr) {
        // Not a DataDescriptor - treat as raw content
        
        // Determine mime type from header or content
        if (contentTypeHeader.includes('text/') || contentTypeHeader.includes('application/json')) {
          mimeType = contentTypeHeader.split(';')[0] || 'text/plain';
          content = dataBuffer.toString('utf-8');
        } else if (contentTypeHeader.includes('image/')) {
          mimeType = contentTypeHeader.split(';')[0];
          content = dataBuffer.toString('base64');
        } else {
          // Try to detect if it's text
          const sample = dataBuffer.slice(0, 100).toString('utf-8');
          const isText = /^[\x20-\x7E\s\n\r\t]+$/.test(sample);
          if (isText) {
            mimeType = 'text/plain';
            content = dataBuffer.toString('utf-8');
          } else {
            setDownloadError('Unsupported content type. Only text, images, and attestations are supported.');
            setHashVerified(null);
            return;
          }
        }
      }
      
      setContentMimeType(mimeType);
      setDownloadedContent(content);
      
    } catch (e) {
      console.error('Download error:', e);
      setDownloadError(`Download failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleContinue = async () => {
    if (signedIn) {
      const isForUserSig = details.flags?.and?.(DataPacketRequestDetails.FLAG_FOR_USERS_SIGNATURE)?.gt?.(new BN(0)) || false;
      const isForTransmittal = details.flags?.and?.(DataPacketRequestDetails.FLAG_FOR_TRANSMITTAL_TO_USER)?.gt?.(new BN(0)) || false;
      const hasUrlDownload = details.flags?.and?.(DataPacketRequestDetails.FLAG_HAS_URL_FOR_DOWNLOAD)?.gt?.(new BN(0)) || false;
      
      // If URL download is required but not completed, show error
      if (hasUrlDownload && hashVerified !== true) {
        createAlert('Download Required', 'Please download and verify the data before continuing.');
        return;
      }

      if (hasUrlDownload && pendingAttestationData && !attestationAccepted) {
        createAlert('Acceptance Required', 'Please review and accept the attestation before continuing.');
        return;
      }

      // Check recipient constraints for transmittal first
      if (isForTransmittal && recipientConstraintIds.size > 0 && !recipientId) {
        createAlert('Identity Required', 'You do not have the required identity to accept this data packet.');
        return;
      }
      
      // If user signature is required
      if (isForUserSig) {
        if (!selectedIdentity) {
          createAlert('Identity Required', 'Please select an identity to sign with.');
          return;
        }
        
        const signedResponse = await signAndCreateResponse();
        if (signedResponse) {
          // If transmittal is also set, save data before advancing
          if (isForTransmittal) {
            await storeDataPacket();
          }
          next(signedResponse, [detailIndex]);
        }
      } else if (isForTransmittal) {
        // Store the data packet
        await storeDataPacket();
        next(response, [detailIndex]);
      } else {
        // Default behavior
        next(response, [detailIndex]);
      }
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

  // Identity sheet handlers
  const handleOpenIdentitySheet = () => {
    setIdentitySheetVisible(true);
  };

  const handleSelectIdentity = (chainId, iAddress, friendlyName) => {
    setSelectedIdentity({ chainId, iAddress, friendlyName });
    setIdentitySheetVisible(false);
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
    setRequestSigDateString(unixToDate(requestSigtime));
  }, [requestSigtime]);

  useEffect(() => {
    setEmbeddedSigDateString(unixToDate(embeddedSigtime));
  }, [embeddedSigtime]);

  useEffect(() => {
    if (sendModalType != AUTHENTICATE_USER_SEND_MODAL) {
      setLoading(false);
    } else setLoading(true);
  }, [sendModalType]);

  // Load linked identities when signed in
  useEffect(() => {
    const loadLinkedIds = async () => {
      try {
        const verusIdServiceData = await requestServiceStoredData(VERUSID_SERVICE_ID);
        if (verusIdServiceData.linked_ids) {
          setLinkedIds(verusIdServiceData.linked_ids);
        } else {
          setLinkedIds({});
        }
      } catch (e) {
        setLinkedIds({});
      }
    };

    if (signedIn) {
      loadLinkedIds();
    }
  }, [encryptedIds, signedIn]);

  // Sort identities alphabetically
  useEffect(() => {
    const sorted = {};
    for (const chainId of Object.keys(linkedIds)) {
      sorted[chainId] = linkedIds[chainId]
        ? Object.keys(linkedIds[chainId]).sort((a, b) => {
            const nameA = linkedIds[chainId][a] || '';
            const nameB = linkedIds[chainId][b] || '';
            return nameA.localeCompare(nameB);
          })
        : [];
    }
    setSortedIds(sorted);
  }, [linkedIds]);

  // Extract URLRef when details change
  useEffect(() => {
    const hasUrlFlag = details.flags?.and?.(DataPacketRequestDetails.FLAG_HAS_URL_FOR_DOWNLOAD)?.gt?.(new BN(0)) || false;
    if (hasUrlFlag) {
      const ref = extractUrlRef();
      setUrlRef(ref);
    }
  }, [details]);

  // Extract recipient constraints from AuthenticationRequestDetails if present in request.details
  useEffect(() => {
    if (request && request.details) {
      const possibleAuthenticationDetails = request.details.find(
        x => x instanceof AuthenticationRequestOrdinalVDXFObject
      );
      if (possibleAuthenticationDetails) {
        const authDetails = possibleAuthenticationDetails.data;
        if (authDetails && authDetails.recipientConstraints) {
          const requiredIds = new Set(
            authDetails.recipientConstraints
              .filter(x => Number(x.type) === RecipientConstraint.REQUIRED_ID)
              .map(x => {
                try {
                  return x.identity.toIAddress();
                } catch (e){
                  console.warn('Error getting constraint i-address:', e); 
                  return null;
                }
              })
              .filter(x => x != null)
          );
          setRecipientConstraintIds(requiredIds);
        }
      }
    }
  }, [request]);

  // Determine recipientId based on recipient constraints and linked identities
  useEffect(() => {
    if (recipientConstraintIds.size === 0) {
      setRecipientId("");
      return;
    }

    // Check if any linked identity matches the constraints
    for (const chainId of Object.keys(linkedIds)) {
      if (linkedIds[chainId]) {
        for (const iAddr of Object.keys(linkedIds[chainId])) {
          if (recipientConstraintIds.has(iAddr)) {
            setRecipientId(iAddr);
            return;
          }
        }
      }
    }

    // No matching identity found
    setRecipientId("");
  }, [recipientConstraintIds, linkedIds]);

  // Determine flags for display
  const hasRequestId = details.hasRequestID();
  const hasStatements = details.hasStatements();
  const hasSignature = details.hasSignature();
  const isForUserSignature = details.flags?.and?.(DataPacketRequestDetails.FLAG_FOR_USERS_SIGNATURE)?.gt?.(new BN(0)) || false;
  const isForTransmittalToUser = details.flags?.and?.(DataPacketRequestDetails.FLAG_FOR_TRANSMITTAL_TO_USER)?.gt?.(new BN(0)) || false;
  const hasUrlForDownload = details.flags?.and?.(DataPacketRequestDetails.FLAG_HAS_URL_FOR_DOWNLOAD)?.gt?.(new BN(0)) || false;
  const requesterLabel = requestSignerFqn || requestSignerIdentityID || embeddedSignerFqn || embeddedSignerIdentityID || 'Unknown signer';
  const requesterAddress = requestSignerIdentityID || embeddedSignerIdentityID;
  const canOpenRequestSignerModal = Boolean(requestChainId && requestSignerIdentityID);
  const canOpenEmbeddedSignerModal = Boolean(embeddedChainId && embeddedSignerIdentityID);
  const canOpenSignerModal = canOpenRequestSignerModal || canOpenEmbeddedSignerModal;

  // Build detail rows
  const detailRows = useMemo(() => {
    const rows = [];

    // Request type indicators
    if (isForUserSignature) {
      rows.push({
        key: 'for-signature',
        title: 'Signature requested',
        subtitle: 'This request is asking for your signature on the data.',
        rightIcon: 'pen',
      });
    }

    if (isForTransmittalToUser) {
      rows.push({
        key: 'transmittal',
        title: 'Data transmittal',
        subtitle: 'Data will be saved to your wallet.',
        rightIcon: 'download',
      });

      // Show recipient constraint info
      if (recipientConstraintIds.size > 0) {
        const constraintAddrs = Array.from(recipientConstraintIds);
        // Try to resolve a friendly name from linked identities
        let recipientLabel = constraintAddrs[0];
        for (const chainId of Object.keys(linkedIds)) {
          if (linkedIds[chainId]) {
            for (const iAddr of constraintAddrs) {
              if (linkedIds[chainId][iAddr]) {
                recipientLabel = linkedIds[chainId][iAddr];
                break;
              }
            }
          }
        }

        if (recipientId) {
          rows.push({
            key: 'recipient-constraint',
            title: `Intended for: ${recipientLabel}`,
            subtitle: truncateAddress(recipientId),
            rightIcon: 'check-circle-outline',
          });
        } else {
          rows.push({
            key: 'recipient-constraint-missing',
            title: `Requires identity: ${truncateAddress(constraintAddrs[0])}`,
            subtitle: 'You do not have the required identity linked.',
            rightIcon: 'alert-circle-outline',
            isError: true,
          });
        }
      }
    }

    if (hasUrlForDownload) {
      rows.push({
        key: 'url-download',
        title: 'Download required',
        subtitle: urlRef?.url || 'URL for downloading data is included.',
        rightIcon: hashVerified === true ? 'check-circle' : 'cloud-download',
        onPress: () => setUrlDownloadModalVisible(true),
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

    // Data objects summary - skip if using URL download
    if (details.signableObjects && details.signableObjects.length > 0 && !hasUrlForDownload) {
      rows.push({
        key: 'signable-objects-summary',
        title: `${details.signableObjects.length} data object${details.signableObjects.length > 1 ? 's' : ''}`,
        subtitle: 'See detailed view below',
      });
    }

    // Statements - limited to 1 line with tap to expand
    if (hasStatements && details.statements && details.statements.length > 0) {
      details.statements.forEach((statement, index) => {
        rows.push({
          key: `statement-${index}`,
          title: statement,
          subtitle: `Statement ${index + 1} - tap to view full`,
          singleLine: true,
          onPress: () => {
            setSelectedStatement(statement);
            setStatementModalVisible(true);
          },
          rightIcon: 'chevron-right',
        });
      });
    }

    // Embedded signature section with signer details
    if (hasSignature && details.signature) {
      const embeddedSignerLabel = embeddedSignerFqn || embeddedSignerIdentityID || 'Unknown signer';
      const embeddedSignerAddr = embeddedSignerIdentityID ? truncateAddress(embeddedSignerIdentityID) : null;

      rows.push({
        key: 'embedded-signer',
        title: embeddedSignerLabel,
        subtitle: embeddedSignerAddr ? `Signed by ${embeddedSignerAddr}` : 'Embedded signature on data packet',
        rightIcon: canOpenEmbeddedSignerModal ? 'chevron-right' : undefined,
        onPress: canOpenEmbeddedSignerModal ? handleEmbeddedSignerDetailsPress : undefined,
      });

      if (embeddedChainId || embeddedSigDateString) {
        rows.push({
          key: 'embedded-sig-info',
          title: [embeddedChainId, embeddedSigDateString].filter(Boolean).join(' · '),
          subtitle: embeddedIsSignatureValid === true ? 'Verified' : embeddedIsSignatureValid === false ? 'Unverified' : 'Verification pending',
          rightIcon: embeddedIsSignatureValid === true ? 'check-circle-outline' : embeddedIsSignatureValid === false ? 'alert-circle-outline' : 'clock-outline',
        });
      } else {
        rows.push({
          key: 'embedded-sig-status',
          title: embeddedIsSignatureValid === true ? 'Valid signature' : embeddedIsSignatureValid === false ? 'Invalid signature' : 'Signature status unknown',
          subtitle: 'Embedded signature on data packet',
          rightIcon: embeddedIsSignatureValid === true ? 'check-circle-outline' : embeddedIsSignatureValid === false ? 'alert-circle-outline' : 'clock-outline',
        });
      }
    }

    return rows;
  }, [details, hasRequestId, hasStatements, hasSignature, isForUserSignature, isForTransmittalToUser, hasUrlForDownload, embeddedIsSignatureValid, embeddedSignerFqn, embeddedSignerIdentityID, embeddedChainId, embeddedSigDateString, canOpenEmbeddedSignerModal, urlRef, hashVerified, recipientConstraintIds, recipientId, linkedIds]);

  // Determine if continue button should be disabled
  const continueDisabled = useMemo(() => {
    if (isSigned && embeddedIsSignatureValid === false) return true;
    if (isForUserSignature && !selectedIdentity && signedIn) return true;
    if (hasUrlForDownload && hashVerified !== true && signedIn) return true;
    if (hasUrlForDownload && pendingAttestationData && !attestationAccepted && signedIn) return true;
    if (isForTransmittalToUser && recipientConstraintIds.size > 0 && !recipientId && signedIn) return true;
    return false;
  }, [isSigned, embeddedIsSignatureValid, isForUserSignature, selectedIdentity, signedIn, hasUrlForDownload, hashVerified, pendingAttestationData, attestationAccepted, isForTransmittalToUser, recipientConstraintIds, recipientId]);

  // Determine hero text based on request type
  const getHeroTitle = () => {
    if (isForUserSignature) return 'Signature Request';
    if (isForTransmittalToUser) return 'Data Packet';
    if (hasUrlForDownload) return 'Download & Verify';
    return 'Data Request';
  };

  const getHeroSubtitle = () => {
    if (isForUserSignature) return 'Sign the included data';
    if (isForTransmittalToUser) return 'Review and save data';
    if (hasUrlForDownload) return 'Download and verify data';
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
      
      <StatementModal
        visible={statementModalVisible}
        statement={selectedStatement}
        onClose={() => setStatementModalVisible(false)}
      />
      
      <IdentityPickerSheet
        visible={identitySheetVisible}
        linkedIds={linkedIds}
        sortedIds={sortedIds}
        selectedIdentity={selectedIdentity}
        onClose={() => setIdentitySheetVisible(false)}
        onSelect={handleSelectIdentity}
      />
      
      <UrlDownloadModal
        visible={urlDownloadModalVisible}
        url={urlRef?.url}
        onClose={() => setUrlDownloadModalVisible(false)}
        onDownload={handleDownload}
        downloading={downloading}
        downloadError={downloadError}
        downloadedContent={downloadedContent}
        contentMimeType={contentMimeType}
        hashVerified={hashVerified}
        attestationDescriptors={pendingAttestationDescriptors}
        attestationAccepted={attestationAccepted}
        attestationTitle={pendingAttestationData?.label}
        attestationSigner={pendingAttestationSigner}
        onAcceptAttestation={handleAcceptDownloadedAttestation}
        onRejectAttestation={handleRejectDownloadedAttestation}
        onDescriptorPress={(descriptor) => {
          if (descriptor.content && !descriptor.isEncrypted) {
            copyToClipboard(descriptor.content, {
              title: 'Content copied',
              message: `${descriptor.title} copied to clipboard.`,
            });
          }
        }}
      />
      
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
            onPress={canOpenRequestSignerModal ? handleRequestSignerDetailsPress : (canOpenEmbeddedSignerModal ? handleEmbeddedSignerDetailsPress : undefined)}
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
                This data packet request does not include a signer identity.
              </Text>
            </View>
          </View>
        )}

        {/* Identity Selection Card - shown when FLAG_FOR_USERS_SIGNATURE is set and signed in */}
        {isForUserSignature && signedIn && (
          <TouchableOpacity
            style={[
              styles.identitySelectCard,
              selectedIdentity && styles.identitySelectCardSelected,
            ]}
            onPress={handleOpenIdentitySheet}
            activeOpacity={0.7}
          >
            <View style={styles.identitySelectIconContainer}>
              <MaterialCommunityIcons
                name="account-check"
                size={28}
                color={selectedIdentity ? Colors.verusGreenColor : '#666'}
              />
            </View>
            <View style={styles.identitySelectTextContainer}>
              <Text style={styles.identitySelectLabel}>
                {selectedIdentity ? 'Signing as' : 'Select identity to sign'}
              </Text>
              <Text style={[
                styles.identitySelectName,
                selectedIdentity && styles.identitySelectNameSelected,
              ]}>
                {selectedIdentity ? selectedIdentity.friendlyName : 'Tap to choose'}
              </Text>
              {selectedIdentity && (
                <Text style={styles.identitySelectAddress}>
                  {truncateAddress(selectedIdentity.iAddress)}
                </Text>
              )}
            </View>
            <MaterialCommunityIcons
              name={selectedIdentity ? 'check-circle' : 'chevron-right'}
              size={24}
              color={selectedIdentity ? Colors.verusGreenColor : '#CCC'}
            />
          </TouchableOpacity>
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
                  singleLine={row.singleLine}
                  isError={row.isError}
                />
              ))
            )}
          </View>
        </View>

        {/* Data Objects Section */}
        {details.signableObjects && details.signableObjects.length > 0 && !hasUrlForDownload && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <MaterialCommunityIcons name="text-box-multiple-outline" size={20} color="#666" />
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
            disabled={continueDisabled}
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
  // Statement modal styles
  statementModalContent: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  statementModalText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  statementModalActions: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statementCopyButton: {
    borderRadius: 22,
  },
  // Identity picker sheet styles
  sheetDescription: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sheetDescriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  networkGroup: {
    marginBottom: 20,
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  networkHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  identityCardSelected: {
    backgroundColor: '#F0F9F1',
    borderWidth: 1,
    borderColor: Colors.verusGreenColor,
  },
  identityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  identityTextSection: {
    flex: 1,
  },
  identityName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  identityNameSelected: {
    color: Colors.verusGreenColor,
  },
  identityAddress: {
    fontSize: 12,
    color: '#888',
  },
  chevron: {
    marginLeft: 8,
  },
  // Identity selection card styles (main screen)
  identitySelectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  identitySelectCardSelected: {
    borderColor: Colors.verusGreenColor,
    backgroundColor: '#F5FBF6',
  },
  identitySelectIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  identitySelectTextContainer: {
    flex: 1,
  },
  identitySelectLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  identitySelectName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#666',
  },
  identitySelectNameSelected: {
    color: Colors.verusGreenColor,
  },
  identitySelectAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  // Download modal styles
  downloadModalContent: {
    paddingHorizontal: 20,
    maxHeight: 400,
  },
  downloadUrlContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  downloadUrl: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
  downloadErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  downloadErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#C62828',
  },
  downloadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  downloadingText: {
    fontSize: 14,
    color: '#666',
  },
  downloadedContentContainer: {
    marginTop: 8,
  },
  hashVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  hashVerifiedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  hashFailedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  hashFailedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
  },
  textContentPreview: {
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  textContent: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
  },
  imageContentPreview: {
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  downloadModalActions: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  downloadButton: {
    width: '100%',
    borderRadius: 22,
  },
  cancelDownloadButton: {
    width: '100%',
    borderRadius: 22,
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
  attestationSuccessContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    gap: 12,
  },
  attestationSuccessText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  attestationMetaText: {
    fontSize: 13,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  attestationListContainer: {
    width: '100%',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'visible',
  },
  rejectDownloadButton: {
    width: '100%',
    borderRadius: 22,
    marginTop: 12,
  },
  rejectDownloadButtonContent: {
    height: 44,
  },
});

export default DataPacketRequestInfo;
