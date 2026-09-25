/*
  LoginRequestInfo
  - Redesigned 2026-02-03: Align login request UI with IdentityUpdateRequestInfo layout.
    - Removed large VerusID logo and legacy list rows
    - Added requester card, connector, choose-identity card, and compact intent card
    - Added summary + permissions section with status styling
    - Disabled Continue until all permissions are agreed, with clear status messaging
  - Updated 2026-02-03: Clarified copy when no additional permissions are required.
    - Reworded helper/empty state to focus on authentication, not data access
    - Adjusted status labels and messages to avoid "accept" confusion
  - Updated 2026-02-03: Neutral status styling for "No action needed".
    - Uses gray status pill and icon to avoid green success emphasis
  - Updated 2026-02-03: Simplified auth-only mode.
    - When no additional permissions are required, show a minimal clean UI
    - Reduces cognitive load for simple authentication requests
*/
import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, TouchableOpacity, View, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { primitives } from 'verusid-ts-client';
import { Button, Portal, Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import VerusIdDetailsModal from '../../../components/VerusIdDetailsModal/VerusIdDetailsModal';
import { getIdentity, getFriendlyNameMap } from '../../../utils/api/channels/verusid/callCreators';
import { unixToDate } from '../../../utils/math';
import { useDispatch, useSelector } from 'react-redux';
import Colors from '../../../globals/colors';
import { VerusIdLogo } from '../../../images/customIcons';
import { openAuthenticateUserModal } from '../../../actions/actions/sendModal/dispatchers/sendModal';
import { AUTHENTICATE_USER_SEND_MODAL, SEND_MODAL_USER_ALLOWLIST } from '../../../utils/constants/sendModal';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';
import GradientButton from '../../../components/GradientButton';
import { getSystemNameFromSystemId } from '../../../utils/CoinData/CoinData';
import { Buffer } from 'buffer';
import { createAlert, resolveAlert } from '../../../actions/actions/alert/dispatchers/alert';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { addCoin, addKeypairs, setUserCoins } from '../../../actions/actionCreators';
import { refreshActiveChainLifecycles } from '../../../actions/actions/intervals/dispatchers/lifecycleManager';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import {scopeSessionAction} from '../../../actions/actions/updates/sessionRequests';

const LoginRequestInfo = props => {
  const insets = useSafeAreaInsets();
  const { deeplinkData, sigtime, cancel, signerFqn } = props
  const [req, setReq] = useState(new primitives.LoginConsentRequest(deeplinkData))
  const [loading, setLoading] = useState(false)
  const [verusIdDetailsModalProps, setVerusIdDetailsModalProps] = useState(null)
  const [sigDateString, setSigDateString] = useState(unixToDate(sigtime))
  const [waitingForSignin, setWaitingForSignin] = useState(false)
  
  // Redux state
  const accounts = useObjectSelector(state => state.authentication.accounts)
  const signedIn = useSelector(state => state.authentication.signedIn)
  const passthrough = useSelector((state) => state.deeplink.passthrough);
  const sendModalType = useSelector(state => state.sendModal.type)
  const activeAccount = useObjectSelector(state => state.authentication.activeAccount);
  const activeCoinList = useObjectSelector(state => state.coins.activeCoinList);
  
  const { system_id, signing_id, challenge } = req
  const chain_id = getSystemNameFromSystemId(system_id)
  const rootSystemAdded = useSelector(
    state =>
      state.coins.activeCoinsForUser &&
      state.coins.activeCoinsForUser.find(x => x.id === chain_id) != null,
  );
  
  // Component state
  const [permissions, setExtraPermissions] = useState(null);
  const [isAttestationProvision, setIsAttestationProvision] = useState(false);
  
  const dispatch = useDispatch()
  const isTestnet = activeAccount ? Object.keys(activeAccount.testnetOverrides).length > 0 : false;
  const sessionEpoch = useObjectSelector(
    state => state.authentication.sessionEpoch,
  );

  let mainLoginMessage = '';

  if (challenge.redirect_uris && challenge.redirect_uris.length > 0) {
    mainLoginMessage = `${signerFqn} is requesting login with VerusID`
  } else {
    if (passthrough?.fqnToAutoLink) {
      mainLoginMessage = `VerusID from ${signerFqn} now ready to link`
    } else {
      mainLoginMessage = `Would you like to request a VerusID from ${signerFqn}?`
    }
  }

  const getVerusId = async (chain, iAddrOrName) => {
    const identity = await getIdentity(CoinDirectory.getBasicCoinObj(chain).system_id, iAddrOrName);

    if (identity.error) throw new Error(identity.error.message);
    else return identity.result;
  }

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
  }

  useEffect(() => {
    const rootSystemJustAdded = prevRootSystemAdded === false && rootSystemAdded === true;
    setPrevRootSystemAdded(rootSystemAdded);

    // Profile initialization loads coins before sign-in finishes. Resume once,
    // after the authentication dialog has completed and closed.
    if (
      signedIn &&
      sendModalType !== AUTHENTICATE_USER_SEND_MODAL &&
      (waitingForSignin || rootSystemJustAdded)
    ) {
      setWaitingForSignin(false);
      handleContinue()
    }
  }, [signedIn, waitingForSignin, rootSystemAdded, prevRootSystemAdded, sendModalType]);

  useEffect(() => {
    setReq(new primitives.LoginConsentRequest(deeplinkData))
    // Reset state when deeplink data changes
    setIsAttestationProvision(false)
    setExtraPermissions(null)
  }, [deeplinkData]);

  useEffect(() => {
    setSigDateString(unixToDate(sigtime))
  }, [sigtime]);

  useEffect(() => {
    if (sendModalType != AUTHENTICATE_USER_SEND_MODAL) {
      setLoading(false);
    } else setLoading(true)
  }, [sendModalType]);

  // Helper function to handle authentication for unauthenticated users
  const authenticateUser = (actionDescription) => {
    setWaitingForSignin(true);
    const coinObj = CoinDirectory.findCoinObj(chain_id);
    
    const allowList = coinObj.testnet 
      ? accounts.filter(x => x.testnetOverrides && x.testnetOverrides[coinObj.mainnet_id] === coinObj.id)
      : accounts.filter(x => !(x.testnetOverrides && x.testnetOverrides[coinObj.id] != null));

    if (allowList.length > 0) {
      const data = {
        [SEND_MODAL_USER_ALLOWLIST]: allowList
      }
      openAuthenticateUserModal(data);
    } else {
      createAlert(
        "Cannot continue",
        `No ${coinObj.testnet ? 'testnet' : 'mainnet'} profiles found, cannot ${actionDescription}.`
      );
    }
  };

  const buildAlert = (request) => {
    if (request.agreed) return;

    // Check if user needs to be authenticated for any action
    const requiresAuth = request.downloadRequired || request.viewAttestation || 
                        request.attestationToAccept || request.openProfile || request.signmessage;

    if (requiresAuth && !signedIn) {
      const actionMap = {
        downloadRequired: 'download attestation',
        viewAttestation: 'view attestation',
        attestationToAccept: 'accept attestation',
        openProfile: 'access profile data',
        signmessage: 'sign message'
      };
      
      // Find the specific action requiring authentication
      const action = Object.keys(actionMap).find(key => request[key]);
      authenticateUser(actionMap[action] || 'proceed');
      return;
    }

    if (request.downloadRequired && !request.downloaded) {
      // Handle download case - navigate to LoginReceiveAttestation with download URL
      props.navigation.navigate("LoginReceiveAttestation", {
        fromService: false,
        downloadUrl: req.challenge.redirect_uris.find(
          uri => uri.vdxfkey === primitives.ATTESTATION_PROVISION_URL.vdxfid
        )?.uri,
        signerFqn
      });
      return;
    }

    // Handle other navigation cases
    const navigationConfigs = {
      viewAttestation: "LoginShareAttestation",
      attestationToAccept: "LoginReceiveAttestation", 
      openProfile: "PersonalSelectData",
      signmessage: "LoginSignDataRequest"
    };

    for (const [key, screenName] of Object.entries(navigationConfigs)) {
      if (request[key]) {
        const navigationParams = {
          fromService: false,
          signerFqn
        };
        
        // Add index and additional data for all requests
        navigationParams.permissionIndex = request.index;
        navigationParams.permissionType = request.permissionType;
        
        if (key === 'signmessage' && request.endorsement) {
          navigationParams.endorsementData = request.endorsement;
        }
        
        props.navigation.navigate(screenName, navigationParams);
        return;
      }
    }

    // For simple agreements that don't require navigation
    return createAlert(
      request.title,
      request.data,
      [
        {
          text: 'DECLINE',
          onPress: () => resolveAlert(false),
          style: 'cancel',
        },
        {
          text: 'ACCEPT', onPress: () => {
            // Update permission using Redux passthrough system
            dispatch(setPermissionAgreed(
              passthrough,
              request.index,
              request.permissionType,
              { data: request.data }
            ));
            resolveAlert(true)
          }
        },
      ],
      { cancelable: true });
  }

  useEffect(() => {
    if (req && req.challenge) {
      // Check if this is an attestation provision request (download scenario)
      if (checkAttestationProvision(req.challenge)) {
        setIsAttestationProvision(true);

        // Create a permission for the attestation download
        const provisioningTitle = req.challenge.provisioning_info[0].data;
        const downloadPermission = [{
          index: 0,
          data: `Download ${provisioningTitle}`,
          title: provisioningTitle,
          permissionType: LOGIN_PERMISSION_TYPES.DOWNLOAD_REQUIRED,
          downloadRequired: true,
          downloaded: false,
          agreed: false
        }];

        setExtraPermissions(downloadPermission);
        return;
      }

      // Handle regular login permissions - loop through subject array instead of requested_access
      const loginTemp = [];
      const { requested_access, attestations, subject } = req.challenge;

      // Handle simple identity view requests
      if (requested_access.length === 1 && requested_access.some(value => value.vdxfkey === primitives.IDENTITY_VIEW.vdxfid)) {
        if (attestations && attestations.length > 0) {
          loginTemp.push({ 
            index: 0,
            data: "Accept attestation", 
            title: "Attestation Provisioning Request", 
            permissionType: LOGIN_PERMISSION_TYPES.ATTESTATION_TO_ACCEPT,
            attestationToAccept: true, 
            agreed: false 
          });
        } else {
          setExtraPermissions([]);
          return;
        }
      } else if (subject && subject.length > 0) {
        // Process each subject item directly
        subject.forEach((subjectItem, index) => {
          const { vdxfkey } = subjectItem;
          console.log(`Processing subject item with vdxfkey: ${vdxfkey}`);
          let permissionData = null;

          // Handle different subject types
          if (vdxfkey === primitives.IDENTITY_AGREEMENT.vdxfid) {
            permissionData = {
              data: subjectItem.data,
              title: "Agreement to accept",
              permissionType: LOGIN_PERMISSION_TYPES.DOWNLOAD_REQUIRED // Generic agreement
            };
          } else if (vdxfkey === primitives.ATTESTATION_READ_REQUEST.vdxfid) {
            permissionData = {
              data: "Agree to share attestation data",
              title: "Attestation View Request",
              permissionType: LOGIN_PERMISSION_TYPES.VIEW_ATTESTATION,
              viewAttestation: true
            };
          } else if (vdxfkey === primitives.PROFILE_DATA_VIEW_REQUEST.vdxfid) {
            permissionData = {
              data: "Agree to share profile data",
              title: "Personal Data Input Request",
              permissionType: LOGIN_PERMISSION_TYPES.OPEN_PROFILE,
              openProfile: true
            };
          } else if (vdxfkey === primitives.IDENTITY_SIGNDATA_REQUEST.vdxfid) {
            try {
              console.log('Processing sign data request for subject item:', subjectItem);
              const newEndorsement = new primitives.Endorsement();
              newEndorsement.fromBuffer(Buffer.from(subjectItem.data, 'base64'));
              
              permissionData = {
                data: newEndorsement.message,
                endorsement: newEndorsement,
                title: `Signature request ${index + 1}`,
                permissionType: LOGIN_PERMISSION_TYPES.SIGN_MESSAGE,
                signmessage: true
              };
            } catch (e) {
              console.error('Failed to parse endorsement:', e);
              permissionData = {
                data: "Invalid endorsement data",
                title: `Signature request ${index + 1}`,
                permissionType: LOGIN_PERMISSION_TYPES.SIGN_MESSAGE,
                signmessage: true
              };
            }
          }
          
          if (permissionData) {
            loginTemp.push({ 
              index,
              vdxfkey,
              ...permissionData, 
              agreed: false 
            });
          }
        });
      } else {
        // Handle other requested access types that don't have subject items
        requested_access.forEach((access, index) => {
          const { vdxfkey } = access;

          // Skip IDENTITY_VIEW and LOGIN_CONSENT_PERSONALINFO_WEBHOOK_VDXF_KEY
          if (vdxfkey === primitives.IDENTITY_VIEW.vdxfid || 
              vdxfkey === primitives.LOGIN_CONSENT_PERSONALINFO_WEBHOOK_VDXF_KEY.vdxfid) {
            return;
          }

          const accessTypeMap = {
            [primitives.ATTESTATION_READ_REQUEST.vdxfid]: {
              data: "Agree to share attestation data",
              title: "Attestation View Request",
              permissionType: LOGIN_PERMISSION_TYPES.VIEW_ATTESTATION,
              viewAttestation: true
            },
            [primitives.PROFILE_DATA_VIEW_REQUEST.vdxfid]: {
              data: "Agree to share profile data",
              title: "Personal Data Input Request",
              permissionType: LOGIN_PERMISSION_TYPES.OPEN_PROFILE,
              openProfile: true
            }
          };

          const permissionData = accessTypeMap[vdxfkey];
          
          if (permissionData) {
            loginTemp.push({ 
              index,
              vdxfkey,
              ...permissionData, 
              agreed: false 
            });
          }
        });
      }

      if (loginTemp.length > 0) {
        setExtraPermissions(loginTemp);
      } else {
        setExtraPermissions([]);
      }
    }
  }, [req]);

  // Handle permission updates from passthrough data (Redux-based permission system)
  // When users complete actions in other screens, they dispatch permission updates via Redux
  // This effect automatically updates the UI to reflect completed permissions
  useEffect(() => {
    if (passthrough?.permissions && permissions) {
      let hasUpdates = false;
      const updatedPermissions = permissions.map(permission => {
        // Only update if permission is not already agreed
        if (!permission.agreed) {
          // Check if this permission has been agreed to by index
          const passthroughPermission = passthrough.permissions[permission.index];
          
          if (passthroughPermission?.status === PERMISSION_STATUS.AGREED) {
            console.log(`Permission ${permission.index} (${permission.permissionType}) was agreed`);
            hasUpdates = true;
            
            // Special handling for download permissions
            if (permission.downloadRequired) {
              return { ...permission, agreed: true, downloaded: true };
            } else {
              return { ...permission, agreed: true };
            }
          }
        }

        return permission;
      });

      if (hasUpdates) {
        setExtraPermissions(updatedPermissions);
      }
    }
  }, [passthrough?.permissions]);

  const permissionsLoaded = permissions != null;
  const extraPermissions = permissions || [];
  const hasActionablePermissions = extraPermissions.length > 0;
  const hasIdentityViewPermission = Boolean(
    challenge &&
      challenge.requested_access &&
      challenge.requested_access.some(value => value.vdxfkey === primitives.IDENTITY_VIEW.vdxfid)
  );
  const remainingActions = permissionsLoaded
    ? extraPermissions.filter(permission => !permission.agreed).length
    : 0;
  const totalPermissions = extraPermissions.length + (hasIdentityViewPermission ? 1 : 0);
  const isReady = permissionsLoaded && remainingActions === 0;
  const statusLabel = !permissionsLoaded
    ? 'Loading permissions'
    : !hasActionablePermissions
    ? 'No action needed'
    : isReady
    ? 'All set'
    : `${remainingActions} remaining`;
  const statusVariant = !permissionsLoaded
    ? 'pending'
    : !hasActionablePermissions
    ? 'neutral'
    : isReady
    ? 'ready'
    : 'pending';
  const headerSubtitle = !permissionsLoaded
    ? 'Loading permissions'
    : hasActionablePermissions
    ? 'Review the permissions before continuing'
    : 'No additional permissions are required for this login';
  const permissionsTitle = hasActionablePermissions ? 'Permissions' : 'Authentication';
  const permissionsHelper = !permissionsLoaded
    ? 'Loading permissions...'
    : hasActionablePermissions
    ? 'Review and accept each permission to continue'
    : 'This login uses your chosen identity to authenticate you. No additional data is requested.';
  const basePermissionTitle = 'Authenticate with your identity';
  const basePermissionSubtitle = hasActionablePermissions
    ? 'Required for login'
    : 'Proves you control the chosen identity';
  const statusMessage = !permissionsLoaded
    ? 'Loading permissions...'
    : hasActionablePermissions
    ? isReady
      ? 'All permissions accepted. You can continue.'
      : 'Complete the permissions above to enable Continue.'
    : 'Authentication only. Continue to choose identity.';
  const requesterLabel = signerFqn || 'Unknown requester';
  const canOpenSignerModal = Boolean(chain_id && signing_id);
  const intentConfig = useMemo(() => {
    const provisioningTitle = challenge?.provisioning_info?.[0]?.data;

    if (isAttestationProvision) {
      return {
        icon: 'cloud-download',
        title: 'Download available',
        description: `${requesterLabel} has shared content with you`,
        helper: provisioningTitle
          ? `Tap the download icon below to view ${provisioningTitle}`
          : null,
      };
    }

    if (challenge?.redirect_uris && challenge.redirect_uris.length > 0) {
      return {
        icon: 'account-key',
        title: 'Login request',
        description: `${requesterLabel} is requesting login with VerusID`,
      };
    }

    if (passthrough?.fqnToAutoLink) {
      return {
        icon: 'link',
        title: 'Ready to link',
        description: `VerusID from ${requesterLabel} now ready to link`,
      };
    }

    if (challenge?.attestations && challenge.attestations.length > 0) {
      return {
        icon: 'certificate',
        title: 'Attestation request',
        description: `Would you like to accept an attestation from ${requesterLabel}?`,
      };
    }

    if (challenge?.requested_access && challenge.requested_access.length > 0) {
      return {
        icon: 'share-variant',
        title: 'Share request',
        description: `Would you like to share attestation information from ${requesterLabel}?`,
      };
    }

    return {
      icon: 'account-plus',
      title: 'VerusID request',
      description: `Would you like to request a VerusID from ${requesterLabel}?`,
    };
  }, [challenge, isAttestationProvision, passthrough?.fqnToAutoLink, requesterLabel]);

  const getPermissionIconConfig = request => {
    if (request.downloadRequired && !request.downloaded) {
      return {
        iconName: 'download',
        iconColor: Colors.secondaryColor,
        iconBackgroundColor: Colors.verusGreenColor,
        isDownloadPending: true,
      };
    }

    if (request.agreed) {
      return {
        iconName: 'check',
        iconColor: Colors.secondaryColor,
        iconBackgroundColor: Colors.verusGreenColor,
        isDownloadPending: false,
      };
    }

    return {
      iconName: 'check',
      iconColor: Colors.secondaryColor,
      iconBackgroundColor: '#BFBFBF',
      isDownloadPending: false,
    };
  };

  const addRootSystem = async () => {
    setLoading(true)
    const sessionScope = {
      sessionScoped: true,
      accountHash: activeAccount.accountHash,
      sessionEpoch,
    };
    const requestContext = {sessionScope};

    try {
      const fullCoinData = CoinDirectory.findCoinObj(chain_id)

      dispatch(
        await addKeypairs(
          fullCoinData,
          activeAccount.keys,
          activeAccount.keyDerivationVersion == null
            ? 0
            : activeAccount.keyDerivationVersion,
          requestContext,
        ),
      );

      const addCoinAction = await addCoin(
        fullCoinData,
        activeCoinList,
        activeAccount.id,
        fullCoinData.compatible_channels,
        requestContext,
      );

      if (addCoinAction) {
        dispatch(addCoinAction);

        const setUserCoinsAction = setUserCoins(
          addCoinAction.activeCoinList,
          activeAccount.id,
        );
        dispatch(scopeSessionAction(setUserCoinsAction, sessionScope));
  
        refreshActiveChainLifecycles(setUserCoinsAction.payload.activeCoinsForUser);
      } else {
        createAlert("Error", "Error adding coin")
      }
    } catch (e) {
      createAlert("Error", e.message)
    }

    setLoading(false)
  }

  const canAddRootSystem = () => {
    return createAlert(
      `Add ${chain_id}?`,
      `To complete this login request, you need to add the ${chain_id} currency to your wallet. Would you like to do so now?`,
      [
        {
          text: 'Cancel',
          onPress: () => resolveAlert(false),
          style: 'cancel',
        },
        { text: 'Yes', onPress: () => resolveAlert(true) },
      ],
      { cancelable: true }
    )
  }

  const tryAddRootSystem = async () => {
    if (await canAddRootSystem()) {
      return addRootSystem()
    }
  }

  const handleContinue = async () => {
    if (!isReady) {
      createAlert(
        "Complete permissions",
        "Review and accept each permission above before continuing."
      );
      return;
    }

    if (signedIn) {
      const coinObj = CoinDirectory.findCoinObj(chain_id);
      
      if (!!coinObj.testnet != isTestnet) {
        createAlert(
          "Incorrect profile type",
          `Please login to a ${coinObj.testnet ? 'testnet' : 'mainnet'} profile to use this login request.`
        );
        return;
      }
      
      if (!rootSystemAdded) {
        tryAddRootSystem()
      } else {
        props.navigation.navigate('LoginRequestIdentity', {});
      }
    } else {
      setWaitingForSignin(true);
      const coinObj = CoinDirectory.findCoinObj(chain_id);
      
      const allowList = coinObj.testnet 
        ? accounts.filter(x => x.testnetOverrides && x.testnetOverrides[coinObj.mainnet_id] === coinObj.id)
        : accounts.filter(x => !(x.testnetOverrides && x.testnetOverrides[coinObj.id] != null));

      if (allowList.length > 0) {
        const data = {
          [SEND_MODAL_USER_ALLOWLIST]: allowList
        }
        openAuthenticateUserModal(data);
      } else {
        createAlert(
          "Cannot continue",
          `No ${coinObj.testnet ? 'testnet' : 'mainnet'} profiles found, cannot respond to ${coinObj.testnet ? 'testnet' : 'mainnet'} login request.`
        );
      }
    }
  };

  // Simple auth-only mode: minimal UI when no permissions need review
  const renderSimpleMode = () => (
    <SafeAreaView style={styles.container}>
      <Portal>
        {verusIdDetailsModalProps != null && (
          <VerusIdDetailsModal {...verusIdDetailsModalProps} />
        )}
      </Portal>
      <View style={styles.simpleContent}>
        <View style={styles.simpleHeader}>
          <View style={styles.simpleIconContainer}>
            <MaterialCommunityIcons name="account-key" size={32} color={Colors.primaryColor} />
          </View>
          <Text style={styles.simpleTitle}>Login request</Text>
          <Text style={styles.simpleSubtitle}>
            {requesterLabel} wants to verify your identity
          </Text>
        </View>

        <TouchableOpacity
          style={styles.simpleRequesterCard}
          onPress={canOpenSignerModal ? () => openVerusIdDetailsModal(chain_id, signing_id) : undefined}
          activeOpacity={canOpenSignerModal ? 0.7 : 1}
        >
          <View style={styles.simpleRequesterRow}>
            <MaterialCommunityIcons name="shield-check" size={20} color={Colors.verusGreenColor} />
            <Text style={styles.simpleRequesterName}>{requesterLabel}</Text>
            {canOpenSignerModal && (
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.verusDarkGray} />
            )}
          </View>
          <View style={styles.simpleChipRow}>
            <View style={styles.simpleChip}>
              <Text style={styles.simpleChipText}>{chain_id}</Text>
            </View>
            <View style={styles.simpleChip}>
              <Text style={styles.simpleChipText}>{sigDateString}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.simpleInfoRow}>
          <MaterialCommunityIcons name="information-outline" size={16} color="#6B7280" />
          <Text style={styles.simpleInfoText}>
            No additional data will be shared
          </Text>
        </View>
      </View>

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
          >
            Choose identity
          </GradientButton>
        </View>
      </View>
    </SafeAreaView>
  );

  // Detailed mode: full UI with permissions review
  const renderDetailedMode = () => (
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
          <Text style={styles.mainTitle}>Request details</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>

        <TouchableOpacity
          style={styles.requesterCard}
          onPress={canOpenSignerModal ? () => openVerusIdDetailsModal(chain_id, signing_id) : undefined}
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
            <View style={styles.chipContainer}>
              <Text style={styles.chipText}>{chain_id}</Text>
            </View>
            <View style={styles.chipContainer}>
              <Text style={styles.chipText}>{sigDateString}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.intentCard}>
          <View style={styles.intentRow}>
            <View style={styles.intentIconContainer}>
              <MaterialCommunityIcons name={intentConfig.icon} size={20} color={Colors.verusGreenColor} />
            </View>
            <View style={styles.intentTextContainer}>
              <Text style={styles.intentTitle}>{intentConfig.title}</Text>
              <Text style={styles.intentSubtitle}>{intentConfig.description}</Text>
              {intentConfig.helper ? (
                <Text style={styles.intentHelper}>{intentConfig.helper}</Text>
              ) : null}
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

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View
              style={[
                styles.statusPill,
                statusVariant === 'ready'
                  ? styles.statusPillReady
                  : statusVariant === 'neutral'
                  ? styles.statusPillNeutral
                  : styles.statusPillPending,
              ]}
            >
              <MaterialCommunityIcons
                name={statusVariant === 'ready' ? 'check-circle' : 'clock-outline'}
                size={14}
                color={
                  statusVariant === 'ready'
                    ? Colors.verusGreenColor
                    : statusVariant === 'neutral'
                    ? '#6B7280'
                    : '#B45309'
                }
              />
              <Text
                style={[
                  styles.statusPillText,
                  statusVariant === 'ready'
                    ? styles.statusPillTextReady
                    : statusVariant === 'neutral'
                    ? styles.statusPillTextNeutral
                    : styles.statusPillTextPending,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryCount}>{totalPermissions}</Text>
              <Text style={styles.summaryLabel}>Permissions</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryCount}>{remainingActions}</Text>
              <Text style={styles.summaryLabel}>Actions required</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="shield-account-outline" size={20} color="#666" />
              <Text style={styles.sectionTitle}>{permissionsTitle}</Text>
            </View>
          </View>
          <Text style={styles.sectionHelper}>
            {permissionsHelper}
          </Text>
          <View style={styles.sectionContent}>
            {hasIdentityViewPermission && (
              <View style={styles.permissionItem}>
                <View style={styles.permissionLeft}>
                  <Text style={styles.permissionTitle}>{basePermissionTitle}</Text>
                  <Text style={styles.permissionSubtitle}>{basePermissionSubtitle}</Text>
                </View>
                <View style={[styles.permissionStatusIcon, styles.permissionStatusIncluded]}>
                  <MaterialCommunityIcons name="check" size={14} color={Colors.verusGreenColor} />
                </View>
              </View>
            )}
            {extraPermissions.map((request, index) => {
              const { iconName, iconColor, iconBackgroundColor, isDownloadPending } = getPermissionIconConfig(request);
              return (
                <TouchableOpacity
                  key={`${request.permissionType}-${request.index ?? index}`}
                  onPress={() => buildAlert(request)}
                  style={[
                    styles.permissionItem,
                    isDownloadPending && styles.permissionItemHighlight,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.permissionLeft}>
                    <Text style={styles.permissionTitle}>{request.title}</Text>
                    <Text style={styles.permissionSubtitle}>
                      {request.downloadRequired && !request.downloaded
                        ? `Download the ${request.title} details.`
                        : `View the ${request.title} details.`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.permissionStatusIcon,
                      { backgroundColor: iconBackgroundColor },
                      isDownloadPending && styles.permissionStatusElevated,
                    ]}
                  >
                    <MaterialCommunityIcons name={iconName} size={16} color={iconColor} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.permissionStatusRow}>
          <MaterialCommunityIcons
            name={isReady ? 'check-circle' : 'alert-circle-outline'}
            size={16}
            color={isReady ? Colors.verusGreenColor : '#9A3412'}
          />
          <Text style={styles.permissionStatusMessage}>
            {statusMessage}
          </Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

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
            disabled={!isReady}
          >
            Continue
          </GradientButton>
        </View>
      </View>
    </SafeAreaView>
  );

  if (loading) {
    return <AnimatedActivityIndicatorBox />;
  }

  // Show simple mode for auth-only requests, detailed mode otherwise
  return permissionsLoaded && !hasActionablePermissions
    ? renderSimpleMode()
    : renderDetailedMode();
};

export default LoginRequestInfo;
