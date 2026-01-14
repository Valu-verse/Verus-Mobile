/*
  LinkIdentityResult
  - 2026-01-14: Reduce the Result step modal height so it doesn't inherit the larger
    height used on the confirm/details step, and reset the modal height on exit.
*/
import {useEffect, useState} from 'react';
import {Dimensions} from 'react-native';
import {closeSendModal} from '../../../../actions/actions/sendModal/dispatchers/sendModal';
import {LinkIdentityResultRender} from './LinkIdentityResult.render';
import { useObjectSelector } from '../../../../hooks/useObjectSelector';

const LinkIdentityResult = (props) => {
  const [verusId, setVerusId] = useState(props.route.params == null ? {} : props.route.params.verusId);
  const [friendlyNames, setFriendlyNames] = useState(props.route.params == null ? {} : props.route.params.friendlyNames);
  const sendModal = useObjectSelector(state => state.sendModal);
  const {data} = sendModal;

  // Make the Result step more compact than the confirm/details step.
  useEffect(() => {
    const {height} = Dimensions.get('window');
    const targetHeight = Math.min(420, Math.max(320, height - 24));
    props.setModalHeight?.(targetHeight);

    return () => {
      // Reset to default for this modal type when leaving Result.
      props.setModalHeight?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishSend = async () => {
    if (data.noLogin) {
      await props.updateSendFormData(
        "success",
        true,
      );
    }
    // Ensure the next open doesn't inherit a custom height from this flow.
    await props.setModalHeight?.();
    closeSendModal()
  };

  return LinkIdentityResultRender({
    verusId,
    friendlyNames,
    finishSend
  });
};

export default LinkIdentityResult;
