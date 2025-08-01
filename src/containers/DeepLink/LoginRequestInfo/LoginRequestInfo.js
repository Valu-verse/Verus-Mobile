import React, { useState, useEffect } from 'react';
import { Dimensions, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import Styles from '../../../styles/index';
import { primitives } from "verusid-ts-client"
import { Button, Divider, List, Portal, Text } from 'react-native-paper';
import VerusIdDetailsModal from '../../../components/VerusIdDetailsModal/VerusIdDetailsModal';
import { getIdentity, getFriendlyNameMap } from '../../../utils/api/channels/verusid/callCreators';
import { unixToDate } from '../../../utils/math';
import { useDispatch, useSelector } from 'react-redux';
import Colors from '../../../globals/colors';
import { VerusIdLogo } from '../../../images/customIcons';
import { closeSendModal, openAuthenticateUserModal } from '../../../actions/actions/sendModal/dispatchers/sendModal';
import { AUTHENTICATE_USER_SEND_MODAL, SEND_MODAL_USER_ALLOWLIST } from '../../../utils/constants/sendModal';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';
import { getSystemNameFromSystemId } from '../../../utils/CoinData/CoinData';
import { createAlert, resolveAlert } from '../../../actions/actions/alert/dispatchers/alert';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { addCoin, addKeypairs, setUserCoins } from '../../../actions/actionCreators';
import { refreshActiveChainLifecycles } from '../../../actions/actions/intervals/dispatchers/lifecycleManager';
import { SMALL_DEVICE_HEGHT } from '../../../utils/constants/constants';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { checkIfAttestationProvision as checkAttestationProvision } from '../../../utils/attestations/downloadAttestation';

const LoginRequestInfo = props => {
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
  const rootSystemAdded = useSelector(
    state =>
      state.coins.activeCoinsForUser &&
      state.coins.activeCoinsForUser.find(x => x.id === chain_id) != null,
  );
  
  // Component state
  const [permissions, setExtraPermissions] = useState(null);
  const [ready, setReady] = useState(false);
  const [isAttestationProvision, setIsAttestationProvision] = useState(false);
  
  const dispatch = useDispatch()
  const { height } = Dimensions.get('window');
  const { system_id, signing_id, challenge } = req
  const chain_id = getSystemNameFromSystemId(system_id)
  const isTestnet = activeAccount ? Object.keys(activeAccount.testnetOverrides).length > 0 : false;

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
    if (signedIn && waitingForSignin) {
      closeSendModal()
      handleContinue()
    }
  }, [signedIn, waitingForSignin]);

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
    const setPermission = () => {
      const _permissions = permissions.map(permission => {
        if (permission.vdxfkey === request.vdxfkey) {
          return { ...permission, agreed: true };
        }
        return permission;
      });
      setExtraPermissions(_permissions);
    }

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
        deeplinkData,
        fromService: false,
        cancel: { cancel },
        downloadUrl: req.challenge.redirect_uris.find(
          uri => uri.vdxfkey === primitives.ATTESTATION_PROVISION_URL.vdxfid
        )?.uri,
        onGoBack: (data) => {
          if (data) {
            setPermission();
          }
        },
        signerFqn
      });
      return;
    }

    // Handle other navigation cases
    const navigationConfigs = {
      viewAttestation: "LoginShareAttestation",
      attestationToAccept: "LoginReceiveAttestation", 
      openProfile: "PersonalSelectData"
    };

    for (const [key, screenName] of Object.entries(navigationConfigs)) {
      if (request[key]) {
        props.navigation.navigate(screenName, {
          deeplinkData,
          fromService: false,
          cancel: { cancel },
          onGoBack: (data) => data ? setPermission(data) : () => { },
          signerFqn
        });
        return;
      }
    }

    if (request.signmessage) {
      // Handle message signing logic here if needed
      return;
    }

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
            setPermission();
            resolveAlert(true)
          }
        },
      ],
      { cancelable: true });
  }

  useEffect(() => {
    if (req && req.challenge && req.challenge.requested_access) {
      // Check if this is an attestation provision request (download scenario)
      if (checkAttestationProvision(req.challenge)) {
        setIsAttestationProvision(true);

        // Create a permission for the attestation download
        const provisioningTitle = req.challenge.provisioning_info[0].data;
        const downloadPermission = [{
          data: `Download ${provisioningTitle}`,
          title: provisioningTitle,
          downloadRequired: true,
          downloaded: false,
          agreed: false,
          vdxfkey: 'attestation_download'
        }];

        setExtraPermissions(downloadPermission);
        setReady(false);
        return;
      }

      // Handle regular login permissions
      const loginTemp = [];
      const { requested_access, attestations } = req.challenge;

      if (requested_access.length === 1 && requested_access.some(value => value.vdxfkey === primitives.IDENTITY_VIEW.vdxfid)) {
        if (attestations && attestations.length > 0) {
          loginTemp.push({ 
            data: "Accept attestation", 
            title: "Attestation Provisioning Request", 
            attestationToAccept: true, 
            agreed: false 
          });
        } else {
          setReady(true);
        }
      } else {
        // Process each requested access
        for (const access of requested_access) {
          const { vdxfkey } = access;
          let tempdata = {};

          // Skip IDENTITY_VIEW and LOGIN_CONSENT_PERSONALINFO_WEBHOOK_VDXF_KEY
          if (vdxfkey === primitives.IDENTITY_VIEW.vdxfid || 
              vdxfkey === primitives.LOGIN_CONSENT_PERSONALINFO_WEBHOOK_VDXF_KEY.vdxfid) {
            continue;
          }

          // Map different access types to permissions
          const accessTypeMap = {
            [primitives.IDENTITY_AGREEMENT.vdxfid]: {
              data: access.toJson().data,
              title: "Agreement to accept"
            },
            [primitives.ATTESTATION_READ_REQUEST.vdxfid]: {
              data: "Agree to share attestation data",
              title: "Attestation View Request",
              viewAttestation: true
            },
            [primitives.PROFILE_DATA_VIEW_REQUEST.vdxfid]: {
              data: "Agree to share profile data",
              title: "Personal Data Input Request",
              openProfile: true
            },
            [primitives.IDENTITY_SIGNDATA_REQUEST.vdxfid]: {
              data: access.toJson().data,
              title: "Message sign request",
              signmessage: true
            }
          };

          tempdata = accessTypeMap[vdxfkey] || {};
          
          if (Object.keys(tempdata).length > 0) {
            loginTemp.push({ vdxfkey, ...tempdata, agreed: false });
          }
        }
      }

      if (loginTemp.length > 0) setExtraPermissions(loginTemp);
    }
  }, [req]);

  useEffect(() => {
    if (permissions) {
      const allAgreed = permissions.every(permission => permission.agreed);
      setReady(allAgreed);
    }
  }, [permissions]);

  const addRootSystem = async () => {
    setLoading(true)

    try {
      const fullCoinData = CoinDirectory.findCoinObj(chain_id)

      dispatch(
        await addKeypairs(
          fullCoinData,
          activeAccount.keys,
          activeAccount.keyDerivationVersion == null
            ? 0
            : activeAccount.keyDerivationVersion,
        ),
      );

      const addCoinAction = await addCoin(
        fullCoinData,
        activeCoinList,
        activeAccount.id,
        fullCoinData.compatible_channels,
      );

      if (addCoinAction) {
        dispatch(addCoinAction);

        const setUserCoinsAction = setUserCoins(
          activeCoinList,
          activeAccount.id,
        );
        dispatch(setUserCoinsAction);

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
    if (signedIn) {
      if (!ready) {
        for (let i = 0; i < permissions.length; i++) {
          const result = await buildAlert(permissions[i], i);
          if (!result) return;
        }
      }
      
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
        props.navigation.navigate('LoginRequestIdentity', { deeplinkData });
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

  return loading ? (
    <AnimatedActivityIndicatorBox />
  ) : (
    <SafeAreaView style={Styles.defaultRoot}>
      <Portal>
        {verusIdDetailsModalProps != null && (
          <VerusIdDetailsModal {...verusIdDetailsModalProps} />
        )}
      </Portal>
      <ScrollView
        style={Styles.fullWidth}
        contentContainerStyle={Styles.focalCenter}>
        {height >= SMALL_DEVICE_HEGHT && <VerusIdLogo width={'55%'} height={'10%'} />}
        <View style={Styles.wideBlock}>
          {isAttestationProvision ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <List.Icon icon="cloud-download" size={24} color={Colors.verusGreenColor} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: Colors.verusGreenColor }}>
                  Download Available
                </Text>
              </View>
              <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 4 }}>
                {signerFqn} has shared content with you
              </Text>
              <Text style={{ fontSize: 14, textAlign: 'center', color: 'gray' }}>
                Tap the download icon below to view {req.challenge.provisioning_info[0].data}
              </Text>
            </View>
          ) : challenge.redirect_uris && challenge.redirect_uris.length > 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <List.Icon icon="account-key" size={24} color={Colors.verusGreenColor} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8 }}>
                  Login Request
                </Text>
              </View>
              <Text style={{ fontSize: 16, textAlign: 'center' }}>
                {signerFqn} is requesting login with VerusID
              </Text>
            </View>
          ) : passthrough?.fqnToAutoLink ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <List.Icon icon="link" size={24} color={Colors.verusGreenColor} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8 }}>
                  Ready to Link
                </Text>
              </View>
              <Text style={{ fontSize: 16, textAlign: 'center' }}>
                VerusID from {signerFqn} now ready to link
              </Text>
            </View>
          ) : challenge.attestations && challenge.attestations.length > 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <List.Icon icon="certificate" size={24} color={Colors.verusGreenColor} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8 }}>
                  Attestation Request
                </Text>
              </View>
              <Text style={{ fontSize: 16, textAlign: 'center' }}>
                Would you like to accept an attestation from {signerFqn}?
              </Text>
            </View>
          ) : challenge.requested_access && challenge.requested_access.length > 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <List.Icon icon="share-variant" size={24} color={Colors.verusGreenColor} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8 }}>
                  Share Request
                </Text>
              </View>
              <Text style={{ fontSize: 16, textAlign: 'center' }}>
                Would you like to share attestation information from {signerFqn}?
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <List.Icon icon="account-plus" size={24} color={Colors.verusGreenColor} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8 }}>
                  VerusID Request
                </Text>
              </View>
              <Text style={{ fontSize: 16, textAlign: 'center' }}>
                Would you like to request a VerusID from {signerFqn}?
              </Text>
            </View>
          )}
        </View>
        <View style={Styles.fullWidth}>
          <TouchableOpacity
            onPress={() => openVerusIdDetailsModal(chain_id, signing_id)}>
            <List.Item
              title={signerFqn}
              description={'Requested by'}
              right={props => (
                <List.Icon {...props} icon={'information'} size={20} />
              )}
            />
            <Divider />
          </TouchableOpacity>
          <TouchableOpacity>
            <List.Item
              title={'View your chosen identity'}
              description={'Permissions requested'}
            />
            <Divider />
          </TouchableOpacity>
          <TouchableOpacity>
            <List.Item title={chain_id} description={'System name'} />
            <Divider />
          </TouchableOpacity>
          <TouchableOpacity>
            <List.Item title={sigDateString} description={'Signed on'} />
            <Divider />
          </TouchableOpacity>
          {permissions && permissions.map((request, index) => {
            let iconName, iconColor, iconBackgroundColor;

            if (request.downloadRequired && !request.downloaded) {
              iconName = "download";
              iconColor = 'white';
              iconBackgroundColor = Colors.verusGreenColor;
            } else if (request.downloadRequired && request.downloaded && request.agreed) {
              iconName = "check";
              iconColor = Colors.secondaryColor;
              iconBackgroundColor = Colors.verusGreenColor;
            } else if (request.agreed) {
              iconName = "check";
              iconColor = Colors.secondaryColor;
              iconBackgroundColor = Colors.verusGreenColor;
            } else {
              iconName = "check";
              iconColor = Colors.secondaryColor;
              iconBackgroundColor = 'grey';
            }

            return (
              <TouchableOpacity key={index} onPress={() => buildAlert(request)}>
                <List.Item
                  title={request.title}
                  description={request.downloadRequired && !request.downloaded ? `Download the ${request.title} Details.` : `View the ${request.title} Details.`}
                  style={request.downloadRequired && !request.downloaded ? {
                    backgroundColor: '#f0f0f0',
                    borderLeftWidth: 4,
                    borderLeftColor: Colors.verusGreenColor,
                    marginVertical: 2
                  } : {}}
                  right={props => (
                    <List.Icon
                      {...props}
                      icon={iconName}
                      size={20}
                      style={{
                        borderRadius: 90,
                        backgroundColor: iconBackgroundColor,
                        ...(request.downloadRequired && !request.downloaded ? {
                          shadowColor: '#ccc',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 4
                        } : {})
                      }}
                      color={iconColor}
                    />
                  )} />
                <Divider />
              </TouchableOpacity>
            );
          })}
        </View>
        <View
          style={{
            ...Styles.fullWidthBlock,
            paddingHorizontal: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            display: 'flex',
          }}>
          <Button
            textColor={Colors.warningButtonColor}
            style={{ width: 148 }}
            onPress={() => cancel()}>
            Cancel
          </Button>
          <Button
            buttonColor={Colors.verusGreenColor}
            textColor={Colors.secondaryColor}
            style={{ width: 148 }}
            onPress={() => handleContinue()}>
            Continue
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginRequestInfo;