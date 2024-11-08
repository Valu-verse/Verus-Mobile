import { all, takeEvery, put } from "redux-saga/effects";
import {
  INIT_VALU_COIN_CHANNEL_START,
  INIT_VALU_COIN_CHANNEL_FINISH,
} from "../../utils/constants/storeType";

export default function * valuCoinSaga() {
  yield all([
    takeEvery(INIT_VALU_COIN_CHANNEL_START, handleFinishValuCoinInit),
  ]);
}

function * handleFinishValuCoinInit(action) {
  yield put({type: INIT_VALU_COIN_CHANNEL_FINISH, payload: action.payload})
}