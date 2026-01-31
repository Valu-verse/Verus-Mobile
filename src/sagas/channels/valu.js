import { all, takeEvery, put, call } from "redux-saga/effects";
import {
  INIT_VALU_COIN_CHANNEL_START,
  INIT_VALU_COIN_CHANNEL_FINISH,
  CHECK_FOR_ACTIVE_OFFRAMP_PROCESS,
  SIGN_IN_USER
} from "../../utils/constants/storeType";
import { requestSeeds } from "../../utils/auth/authBox";
import { VALU_SERVICE } from "../../utils/constants/intervalConstants";
import ValuProvider from "../../utils/services/ValuProvider";
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
    const seeds = yield call(requestSeeds);
    const seed = seeds[VALU_SERVICE];
    
    if (seed == null) {
      return;
    }
    
    yield call([ValuProvider, ValuProvider.authenticate], seed);
    yield call(initiatePartnerUserId, seed);
  } catch (error) {
    // Silently fail if Valu service initialization fails
  }
}