import { all, takeEvery, put} from "redux-saga/effects";
import {
  INIT_VALU_COIN_CHANNEL_START,
  INIT_VALU_COIN_CHANNEL_FINISH,
  CHECK_FOR_ACTIVE_OFFRAMP_PROCESS
} from "../../utils/constants/storeType";

export default function* valuCoinSaga() {
  yield all([
    takeEvery(INIT_VALU_COIN_CHANNEL_START, handleFinishValuCoinInit),
    takeEvery(CHECK_FOR_ACTIVE_OFFRAMP_PROCESS, handleCheckForActiveOfframpProcess)
  ]);
}

function* handleFinishValuCoinInit(action) {
  yield put({ type: INIT_VALU_COIN_CHANNEL_FINISH, payload: action.payload })
}

function* handleCheckForActiveOfframpProcess(action) {
}