/*
  This component is responsible for creating verusQR invoices and 
  showing the user their receiving address. If the user ever wants
  to receive coins from anyone, they should be able to go to this
  screen and configure their invoice within a few button presses.
*/

import React, { Component } from "react"
import { 
  Keyboard, 
  Clipboard,
 } from "react-native"
import { connect } from 'react-redux'
import { isNumber, truncateDecimal } from '../../../utils/math'
import { conditionallyUpdateWallet } from "../../../actions/actionDispatchers"
import { API_GET_FIATPRICE, API_GET_BALANCES, GENERAL, DLIGHT_PRIVATE } from "../../../utils/constants/intervalConstants"
import { USD } from '../../../utils/constants/currencies'
import { expireCoinData } from "../../../actions/actionCreators"
import Store from "../../../store"
import selectAddresses from "../../../selectors/address"
import { RenderReceiveCoin } from "./ReceiveCoin.render"
import { createAlert } from "../../../actions/actions/alert/dispatchers/alert"
import selectRates from "../../../selectors/rates"
import selectNetworkName from "../../../selectors/networkName"
import {
  sanitizeNumericInput,
  validateAmountInput,
  validateSlippageInput,
  generateReceiveInvoice,
} from '../../../features/receive/receiveInvoice'

class ReceiveCoin extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedCoin: this.props.activeCoin,
      amount: 0,
      maxSlippage: "0.5",
      allowConversion: false,
      addresses: [null],
      memo: null,
      errors: {selectedCoin: null, amount: null, addresses: null, memo: null, maxSlippage: null },
      verusQRString: null,
      amountFiat: false,
      loading: false,
      loadingBox: false,
      showModal: false,
      showingAddress: false,
      currentTextInputModal: null,
      currentNumberInputModal: null,
      addressSelectModalOpen: false,
      infoIndexes: [],
      showVerusIconInQr: false
    };
  }

  openNumberInputModal(inputKey) {
    this.setState({
      currentNumberInputModal: inputKey
    })
  }

  closeNumberInputModal() {
    this.setState({
      currentNumberInputModal: null
    })
  }

  openTextInputModal(inputKey) {
    this.setState({
      currentTextInputModal: inputKey
    })
  }

  closeTextInputModal() {
    this.setState({
      currentTextInputModal: null
    })
  }

  componentDidMount() {
    this.setAddress()
  }
  
  componentDidUpdate(lastProps) {
    if (lastProps.addresses !== this.props.addresses) {
      this.setAddress()
    }
  }

  setAddress = () => {
    if (this.props.addresses && this.props.addresses.results != null) {
      let infoIndexes = {}
      this.props.addresses.results.map((addr, index) => {
        if (addr != null && addr.length > 0) infoIndexes[addr] = index
      })

      this.setState({
        addresses: this.props.addresses.results.filter(
          (addr) => infoIndexes[addr] != null
        ),
        infoIndexes
      });
    } else {
      this.setState({
        addresses: []
      });
    }
  }

  toggleAllowConversion = () => {
    this.setState({
      allowConversion: !this.state.allowConversion
    })
  }

  _handleSubmit = () => {
    Keyboard.dismiss();
    this.validateFormData()
  }

  handleError = (error, field) => {
    let _errors = this.state.errors
    _errors[field] = error

    this.setState({errors: _errors})
  }

  forceUpdate = () => {
    const coinObj = this.props.activeCoin
    this.props.dispatch(expireCoinData(coinObj.id, API_GET_FIATPRICE))
    this.props.dispatch(expireCoinData(coinObj.id, API_GET_BALANCES))

    this.refresh()
  }

  refresh = () => {
    this.setState({ loading: true }, () => {
      const updates = [API_GET_FIATPRICE, API_GET_BALANCES]
      Promise.all(updates.map(async (update) => {
        await conditionallyUpdateWallet(Store.getState(), this.props.dispatch, this.props.activeCoin.id, update)
      })).then(res => {
        this.setState({ loading: false })
      })
      .catch(error => {
        this.setState({ loading: false })
        console.warn(error)
      })
    })
  }

  updateProps = (promiseArray) => {
    return new Promise((resolve, reject) => {
      Promise.all(promiseArray)
        .then((updatesArray) => {
          if (updatesArray.length > 0) {
            for (let i = 0; i < updatesArray.length; i++) {
              if(updatesArray[i]) {
                this.props.dispatch(updatesArray[i])
              }
            }
            if (this.state.loading) {
              this.setState({ loading: false });  
            }
            resolve(true)
          }
          else {
            resolve(false)
          }
        })
    }) 
  }

  createQRString = (coinObj, amount, address, memo, maxSlippage) => {
    const { displayCurrency, rates, subWallet } = this.props

    this.setState({ loadingBox: true }, async () => {
      try {
        const { qrString, showVerusIcon } = await generateReceiveInvoice({
          coinObj,
          subWallet,
          address,
          amountValue: amount,
          amountFiat: this.state.amountFiat,
          memo,
          allowConversion: this.state.allowConversion && this.state.amount != 0,
          maxSlippageValue: maxSlippage,
          displayCurrency,
          priceMap: rates || {},
        });

        this.setState({
          verusQRString: qrString,
          showModal: true,
          loadingBox: false,
          showVerusIconInQr: showVerusIcon,
        });
      } catch (e) {
        console.warn(e);
        createAlert('Error', e.message || 'Error creating VerusPay invoice.');
        this.setState({ loadingBox: false });
      }
    });
  }

  showAddressString = () => {
    if (this.state.addresses.length == 0) {
      createAlert("No Address", 'No address to view QR for.')
    } else {
      this.setState({
        verusQRString: this.state.addresses[0],
        showModal: true,
        showingAddress: true
      });
    }
  }

  switchInvoiceCoin = (coinObj) => {
    this.setState({selectedCoin: coinObj},
      () => {
        this.setAddress()
      })
  }

  copyAddressToClipboard = (address) => {
    Clipboard.setString(address);
    createAlert("Address Copied", `"${address}" copied to clipboard.`)
  }

  getPrice = () => {
    const { state, props } = this
    const { amount, selectedCoin, amountFiat } = state
    const { rates, displayCurrency } = props

    let _price = rates[displayCurrency]
    
    if (!(amount.toString()) ||
      !(isNumber(amount)) ||
      !_price) {
      return 0
    } 

    if (amountFiat) {
      return truncateDecimal(amount/_price, 8)
    } else {
      return truncateDecimal(amount*_price, 2)
    }
  }

  networksInfoAlert = () => {
    createAlert(
      "Supported Blockchain Networks", 
      "VerusPay invoices can support payment on more than one blockchain network. The QR invoice generated with this form will support payments on any networks listed here."
    )
  }

  validateFormData = (addressIndex) => {
    this.setState({
      errors: {selectedCoin: null, amount: null, addresses: null, memo: null },
      verusQRString: null,
      showVerusIconInQr: false
    }, async () => {
      const _selectedCoin = this.state.selectedCoin;
      let _amount = sanitizeNumericInput(this.state.amount);
      let _maxSlippage = null;
      const _address = this.state.addresses[addressIndex];
      const _memo = this.state.memo;
      let _errors = false;
      const useMaxSlippageForm =
        this.state.amount != 0 &&
        this.props.activeCoin.proto === 'vrsc' &&
        this.props.subWallet.id !== 'PRIVATE_WALLET' &&
        this.props.generalWalletSettings.allowSettingVerusPaySlippage && 
        this.state.allowConversion;

      if (!_selectedCoin) {
        createAlert("Error", "Please select a coin to receive.")
        _errors = true
      }

      if (Number(this.state.amount) === 0) {
        _amount = '';
      }

      const amountError = validateAmountInput(_amount);
      if (amountError) {
        this.handleError(amountError, 'amount');
        createAlert('Invalid Amount', amountError);
        _errors = true;
      }

      if (useMaxSlippageForm) {
        _maxSlippage = sanitizeNumericInput(this.state.maxSlippage);
        const slippageError = validateSlippageInput(_maxSlippage);
        if (slippageError) {
          this.handleError(slippageError, 'maxSlippage');
          createAlert('Invalid Slippage', slippageError);
          _errors = true;
        }
      }

      if (!_errors) {
        try {
          this.createQRString(_selectedCoin, _amount, _address, _memo, _maxSlippage);
          return true;
        } catch(e) {
          createAlert("Error", e.message);
          return false;
        }
      } else {
        return false;
      }
    });
  }

  render() {
    return RenderReceiveCoin.call(this)
  }
}

const mapStateToProps = (state) => {
  const chainTicker = state.coins.activeCoin.id
  const { results, errors } = selectRates(state)

  return {
    accounts: state.authentication.accounts,
    activeCoin: state.coins.activeCoin,
    activeCoinsForUser: state.coins.activeCoinsForUser,
    rates: results ? results : {},
    displayCurrency: state.settings.generalWalletSettings.displayCurrency || USD,
    addresses: selectAddresses(state),
    subWallet: state.coinMenus.activeSubWallets[chainTicker],
    networkName: selectNetworkName(state),
    generalWalletSettings: state.settings.generalWalletSettings
  }
};

export default connect(mapStateToProps)(ReceiveCoin);