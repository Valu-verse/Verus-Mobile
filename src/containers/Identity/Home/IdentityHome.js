/*
  IdentityHome
  - 2026-01-23: Updated to use navigation to VerusIdDetails screen instead of bottom sheet modal.
    Removed modal-related state and replaced openVerusIdDetailsModal with navigateToVerusIdDetails.
  - 2026-01-23: Fixed categorization logic to ensure already-linked IDs don't appear in pending sections.
    Enhanced filtering with case-insensitive comparison across all chains for both iAddr and display name.
*/
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { VERUSID_NETWORK_DEFAULT } from '../../../../env/index';
import { VERUSID_SERVICE_ID } from '../../../utils/constants/services';
import {
  NOTIFICATION_TYPE_VERUSID_READY,
  NOTIFICATION_TYPE_VERUSID_ERROR,
} from '../../../utils/constants/services';
import { setServiceLoading } from '../../../actions/actionCreators';
import { requestServiceStoredData } from '../../../utils/auth/authBox';
import { createAlert } from '../../../actions/actions/alert/dispatchers/alert';
import { openLinkIdentityModal } from '../../../actions/actions/sendModal/dispatchers/sendModal';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import IdentityHomeRender from './IdentityHome.render';
import { convertFqnToDisplayFormat } from '../../../utils/fullyqualifiedname';
import { SEND_MODAL_IDENTITY_TO_LINK_FIELD } from '../../../utils/constants/sendModal';

function countLinkedIds(linkedIds) {
  if (!linkedIds || typeof linkedIds !== 'object') return 0;
  let count = 0;
  for (const chainId of Object.keys(linkedIds)) {
    const chainMap = linkedIds[chainId];
    if (chainMap && typeof chainMap === 'object') {
      count += Object.keys(chainMap).length;
    }
  }
  return count;
}

const IdentityHome = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  
  // Dimensions
  const layoutWidth = useObjectSelector(state => state.windowDimensions?.width) || 0;
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || layoutWidth || 390;

  // Redux state
  const testnetOverrides = useObjectSelector(
    state => state.authentication.activeAccount?.testnetOverrides || {},
  );
  const encryptedIds = useObjectSelector(state => state.services.stored[VERUSID_SERVICE_ID]);
  const pendingIds = useObjectSelector(state => state.channelStore_verusid?.pendingIds || {});

  // Local state
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkedIds, setLinkedIds] = useState(null);

  const identityNetwork = useMemo(() => {
    return testnetOverrides[VERUSID_NETWORK_DEFAULT]
      ? testnetOverrides[VERUSID_NETWORK_DEFAULT]
      : VERUSID_NETWORK_DEFAULT;
  }, [testnetOverrides]);

  const fetchLinkedIds = useCallback(async () => {
    setLoading(true);
    dispatch(setServiceLoading(true, VERUSID_SERVICE_ID));

    try {
      const serviceData = await requestServiceStoredData(VERUSID_SERVICE_ID);
      setLinkedIds(serviceData?.linked_ids ? serviceData.linked_ids : {});
    } catch (e) {
      createAlert('Error Loading Linked VerusIDs', e.message);
      setLinkedIds({});
    } finally {
      dispatch(setServiceLoading(false, VERUSID_SERVICE_ID));
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchLinkedIds();
  }, []);

  useEffect(() => {
    fetchLinkedIds();
  }, [encryptedIds]);

  const openLink = useCallback(() => {
    openLinkIdentityModal(CoinDirectory.findCoinObj(identityNetwork));
  }, [identityNetwork]);

  const openLinkPrefilled = useCallback((chain, identityInput) => {
    const coinObj = CoinDirectory.findCoinObj(chain);
    openLinkIdentityModal(coinObj, { [SEND_MODAL_IDENTITY_TO_LINK_FIELD]: identityInput });
  }, []);

  // Navigate to VerusIdDetails screen instead of opening a modal
  const navigateToVerusIdDetails = useCallback(
    (chain, iAddress, displayName) => {
      navigation.navigate('VerusIdDetails', {
        chain,
        iAddress,
        displayName,
      });
    },
    [navigation],
  );

  const onLayout = (e) => {
    const w = e?.nativeEvent?.layout?.width;
    if (typeof w === 'number' && w > 0 && w !== measuredWidth) {
      setMeasuredWidth(w);
    }
  };

  const linkedIdCount = useMemo(() => countLinkedIds(linkedIds), [linkedIds]);

  const { linkedItems, pendingGroups } = useMemo(() => {
    const linked = [];
    if (linkedIds && typeof linkedIds === 'object') {
      for (const chainId of Object.keys(linkedIds)) {
        const chainMap = linkedIds[chainId] || {};
        for (const iAddr of Object.keys(chainMap)) {
          linked.push({
            chainId,
            iAddr,
            display: chainMap[iAddr],
          });
        }
      }
    }

    linked.sort((a, b) => {
      const aPreferred = a.chainId === identityNetwork ? 0 : 1;
      const bPreferred = b.chainId === identityNetwork ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      const chainCmp = String(a.chainId).localeCompare(String(b.chainId));
      if (chainCmp !== 0) return chainCmp;
      return String(a.display).localeCompare(String(b.display), undefined, { sensitivity: 'base' });
    });

    const groups = {
      ready: [],
      attention: [],
      progress: [],
    };

    // pendingIds are stored as { [chainTicker]: { [iAddress]: details } }
    if (pendingIds && typeof pendingIds === 'object') {
      for (const chainId of Object.keys(pendingIds)) {
        const chainMap = pendingIds[chainId] || {};
        for (const iAddr of Object.keys(chainMap)) {
          const details = chainMap[iAddr] || {};
          const fqn = details.fqn || '';
          const display = fqn ? convertFqnToDisplayFormat(fqn) : (details.provisioningName ? `${details.provisioningName}@` : iAddr);

          // Skip if already linked - check across all chains with case-insensitive comparison
          let isAlreadyLinked = false;
          
          if (linkedIds && typeof linkedIds === 'object') {
            for (const linkedChainId of Object.keys(linkedIds)) {
              const linkedChainMap = linkedIds[linkedChainId] || {};
              
              // Check if iAddr matches (case-insensitive)
              if (Object.keys(linkedChainMap).some(
                linkedAddr => linkedAddr.toLowerCase() === iAddr.toLowerCase()
              )) {
                isAlreadyLinked = true;
                break;
              }
              
              // Check if display name matches (case-insensitive)
              if (Object.values(linkedChainMap).some(
                linkedDisplay => String(linkedDisplay).toLowerCase() === String(display).toLowerCase()
              )) {
                isAlreadyLinked = true;
                break;
              }
            }
          }
          
          if (isAlreadyLinked) continue;

          const linkInput = fqn ? convertFqnToDisplayFormat(fqn) : iAddr;
          const status = details.status;

          const item = {
            chainId,
            iAddr,
            status,
            display,
            linkInput,
            details,
          };

          if (status === NOTIFICATION_TYPE_VERUSID_READY) groups.ready.push(item);
          else if (status === NOTIFICATION_TYPE_VERUSID_ERROR) groups.attention.push(item);
          else groups.progress.push(item);
        }
      }
    }

    const byName = (x, y) =>
      String(x.display).localeCompare(String(y.display), undefined, { sensitivity: 'base' });
    groups.ready.sort(byName);
    groups.attention.sort(byName);
    groups.progress.sort(byName);

    return { linkedItems: linked, pendingGroups: groups };
  }, [linkedIds, pendingIds, identityNetwork]);

  const hasPending =
    (pendingGroups.ready?.length ?? 0) +
      (pendingGroups.attention?.length ?? 0) +
      (pendingGroups.progress?.length ?? 0) >
    0;

  return (
    <IdentityHomeRender
      width={width}
      linkedIds={linkedIds}
      loading={loading}
      linkedIdCount={linkedIdCount}
      hasLinkedIds={linkedIdCount > 0}
      infoSheetVisible={infoSheetVisible}
      setInfoSheetVisible={setInfoSheetVisible}
      openLink={openLink}
      openLinkPrefilled={openLinkPrefilled}
      linkedItems={linkedItems}
      pendingGroups={pendingGroups}
      hasPending={hasPending}
      navigateToVerusIdDetails={navigateToVerusIdDetails}
      identityNetwork={identityNetwork}
      onLayout={onLayout}
    />
  );
};

export default IdentityHome;
