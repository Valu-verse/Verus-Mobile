import { all, takeEvery, takeLatest, call, put } from "redux-saga/effects";
import {
  INIT_VRPC_CHANNEL_START,
  CLOSE_VRPC_CHANNEL,
  SIGN_OUT_COMPLETE,
  INIT_VRPC_CHANNEL_FINISH,
  SET_WATCHED_VRPC_ADDRESSES,
} from "../../utils/constants/storeType";
import VrpcProvider from '../../utils/vrpc/vrpcInterface';
import Store from '../../store/index';

export default function * vrpcSaga() {
  yield all([
    takeEvery(INIT_VRPC_CHANNEL_START, handleVrpcChannelInit),
    takeEvery(CLOSE_VRPC_CHANNEL, handleVrpcChannelClose),
    takeLatest(SIGN_OUT_COMPLETE, handleSignOut)
  ]);
}

function * handleVrpcChannelInit(action) {
  yield call(VrpcProvider.initEndpoint, action.payload.systemId, action.payload.endpointAddress)
  yield call(handleFinishVrpcInit, action)
}

function* handleVrpcChannelClose(action) {
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
      console.log(`VRPC endpoint ${action.payload.endpointAddress} already deleted for ${action.payload.systemId}`);
    }
  } catch (error) {
    // Endpoint might not be initialized, which is fine during cleanup
    console.log('VRPC channel close:', error.message);
  }
}

function * handleSignOut() {
  // Only delete endpoints if they haven't been deleted already
  try {
    const endpoints = Store.getState().channelStore_vrpc.vrpcEndpoints;
    if (Object.keys(endpoints).length > 0) {
      VrpcProvider.deleteAllEndpoints();
    }
  } catch (error) {
    console.log('VRPC sign out cleanup:', error.message);
  }
  
  setImmediate(() => {
    VrpcProvider.addDefaultEndpoints();
  })
}

function * handleFinishVrpcInit(action) {
  yield put({type: SET_WATCHED_VRPC_ADDRESSES, payload: action.payload})
  yield put({type: INIT_VRPC_CHANNEL_FINISH, payload: action.payload})
}