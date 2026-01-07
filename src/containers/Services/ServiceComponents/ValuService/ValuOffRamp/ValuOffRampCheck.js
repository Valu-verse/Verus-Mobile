import Store from "../../../../../store";

export const ValuOffRampCheck = (props) => {

    const request = Store.getState().channelStore_valu_service.offRampRequest;

    if (request.status === 'AWAITING_PAYMENT') {
        return true;
    }

    return false;

}
