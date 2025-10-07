import { all, takeEvery, put, call } from "redux-saga/effects";
import { initAccountWidgets, setWidgets } from "../actions/actionCreators";
import { resetServices } from "../actions/actionDispatchers";
import { AUTHENTICATE_USER, SIGN_OUT, SIGN_OUT_COMPLETE } from "../utils/constants/storeType";
import { requestSeeds } from "../utils/auth/authBox";
import { VALU_SERVICE } from "../utils/constants/intervalConstants";
import ValuProvider from "../utils/services/ValuProvider";

export default function * authenticationSaga() {
  yield all([
    takeEvery(SIGN_OUT, handleFinishSignOut),
    takeEvery(AUTHENTICATE_USER, handleAuthenticateUser)
  ]);
}

function * handleFinishSignOut() {
  try {
    yield call(resetServices)
  } catch(e) {
    console.warn(e)
  }
  
  yield put(setWidgets({}))
  yield put({type: SIGN_OUT_COMPLETE})
}

function * handleAuthenticateUser(action) {
  let setWidgetAction;

  try {
    yield call(resetServices)
  } catch(e) {
    console.warn(e)
  }

  // Authenticate ValuService during user sign-in
  try {
    const accountSeeds = yield call(requestSeeds);
    const valuSeed = accountSeeds[VALU_SERVICE];
    if (valuSeed) {
      yield call(ValuProvider.authenticate.bind(ValuProvider), valuSeed, true);
    }
  } catch(e) {
    console.warn("Failed to authenticate ValuService during sign-in:", e)
  }

  try {
    setWidgetAction = yield call(initAccountWidgets, action.activeAccount.accountHash)
  } catch(e) {
    console.warn(e)
  }

  if (setWidgetAction == null) setWidgetAction = setWidgets({})
  
  yield put(setWidgetAction)
}