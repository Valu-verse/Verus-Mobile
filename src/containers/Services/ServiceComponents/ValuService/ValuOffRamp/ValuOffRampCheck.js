import Store from "../../../../../store";

export const ValuOffRampCheck = (props) => {
    console.log("ValuOffRampCheck");
    const request = Store.getState().channelStore_valu_service.offRampRequest;
    console.log("request", request);
    if (request.status === 'AWAITING_PAYMENT') {
        return true;
    }

    return false;

}
