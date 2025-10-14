import {all, takeEvery, takeLatest, call, put} from 'redux-saga/effects';
import {
  INIT_VERUSID_CHANNEL_START,
  CLOSE_VERUSID_CHANNEL,
  SIGN_OUT_COMPLETE,
  INIT_VERUSID_CHANNEL_FINISH,
  SET_WATCHED_VERUSIDS,
  SET_PENDING_VERUSIDS,
} from '../../utils/constants/storeType';
import VrpcProvider from '../../utils/vrpc/vrpcInterface';
import Store from '../../store/index';

export default function* verusidSaga() {
  yield all([
    takeEvery(INIT_VERUSID_CHANNEL_START, handleVerusidChannelInit),
    takeEvery(CLOSE_VERUSID_CHANNEL, handleVerusidChannelClose),
    takeLatest(SIGN_OUT_COMPLETE, handleSignOut),
  ]);
}

function* handleVerusidChannelInit(action) {
  yield call(
    VrpcProvider.initEndpoint,
    action.payload.systemId,
    action.payload.endpointAddress,
  );
  yield call(handleFinishVerusidInit, action);
}

function* handleVerusidChannelClose(action) {
  try {
    // Check if the endpoint exists before trying to delete it
    const endpoints = Store.getState().channelStore_vrpc.vrpcEndpoints;
    const endpointId = VrpcProvider.getEndpointId(action.payload.systemId, action.payload.endpointAddress);
    
    if (endpoints[endpointId]) {
      VrpcProvider.deleteEndpoint(
        action.payload.systemId,
        action.payload.endpointAddress,
      );
    } else {
      console.log(`VerusID endpoint ${action.payload.endpointAddress} already deleted for ${action.payload.systemId}`);
    }
  } catch (error) {
    // Endpoint might not be initialized, which is fine during cleanup
    console.log('VerusID channel close:', error.message);
  }
}

function* handleSignOut() {
  // Only delete endpoints if they haven't been deleted already
  try {
    const endpoints = Store.getState().channelStore_vrpc.vrpcEndpoints;
    if (Object.keys(endpoints).length > 0) {
      VrpcProvider.deleteAllEndpoints();
    }
  } catch (error) {
    console.log('VerusID sign out cleanup:', error.message);
  }
  
  setImmediate(() => {
    VrpcProvider.addDefaultEndpoints();
  })
}

function* handleFinishVerusidInit(action) { 
  yield put({type: SET_WATCHED_VERUSIDS, payload: action.payload});
  yield put({type: SET_PENDING_VERUSIDS, payload: action.payload});
  yield put({type: INIT_VERUSID_CHANNEL_FINISH, payload: action.payload});
}
