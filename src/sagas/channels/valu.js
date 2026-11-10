import { all, takeEvery, put, call } from "redux-saga/effects";
import {
  INIT_VALU_COIN_CHANNEL_START,
  INIT_VALU_COIN_CHANNEL_FINISH,
  CHECK_FOR_ACTIVE_OFFRAMP_PROCESS,
  SIGN_IN_USER
} from "../../utils/constants/storeType";
import { initiatePartnerUserId } from "../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager";

export default function* valuCoinSaga() {
  yield all([
    takeEvery(INIT_VALU_COIN_CHANNEL_START, handleFinishValuCoinInit),
    takeEvery(CHECK_FOR_ACTIVE_OFFRAMP_PROCESS, handleCheckForActiveOfframpProcess),
    takeEvery(SIGN_IN_USER, handleInitializeValuService)
  ]);
}

function* handleFinishValuCoinInit(action) {
  yield put({ type: INIT_VALU_COIN_CHANNEL_FINISH, payload: action.payload })
}

function* handleCheckForActiveOfframpProcess(action) {
}

function* handleInitializeValuService() {
  try {
    // Wallet login (or stored v2 credentials) for the active network
    yield call(initiatePartnerUserId);
  } catch (error) {
    // Silently fail if Valu service initialization fails
  }
}