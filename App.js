/**
 * @format
 * @flow strict-local
 *
 * Changes:
 * - Added global translucent Android StatusBar (transparent, dark-content)
 * - Removed persistent "PRE-RELEASE Version" overlay badge
 */
import React from 'react';
import { View, Keyboard, Platform, StatusBar } from 'react-native';
import VerusMobile from './src/VerusMobile';
import store from './src/store';
import {Provider} from 'react-redux';
import {
  Provider as PaperProvider,
  configureFonts,
  MD2LightTheme
} from 'react-native-paper';
import {
  Text,
  TextInput
} from 'react-native';
import BigNumber from 'bignumber.js';
import Colors from './src/globals/colors';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps = Text.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;

BigNumber.set({ EXPONENTIAL_AT: 1000000, ROUNDING_MODE: BigNumber.ROUND_FLOOR });

const fontConfig = {
  default: {
    regular: {
      fontFamily: 'SourceSansPro-Regular',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'SourceSansPro-SemiBold',
      fontWeight: 'normal',
    },
    light: {
      fontFamily: 'SourceSansPro-Light',
      fontWeight: 'normal',
    },
    thin: {
      fontFamily: 'SourceSansPro-ExtraLight',
      fontWeight: 'normal',
    },
  },
  ios: {
    regular: {
      fontFamily: 'SourceSansPro-Regular',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'SourceSansPro-SemiBold',
      fontWeight: 'normal',
    },
    light: {
      fontFamily: 'SourceSansPro-Light',
      fontWeight: 'normal',
    },
    thin: {
      fontFamily: 'SourceSansPro-ExtraLight',
      fontWeight: 'normal',
    },
  },
  android: {
    regular: {
      fontFamily: 'SourceSansPro-Regular',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'SourceSansPro-SemiBold',
      fontWeight: 'normal',
    },
    light: {
      fontFamily: 'SourceSansPro-Light',
      fontWeight: 'normal',
    },
    thin: {
      fontFamily: 'SourceSansPro-ExtraLight',
      fontWeight: 'normal',
    },
  },
};

const theme = {
  ...MD2LightTheme,
  colors: {
    ...MD2LightTheme.colors,
    primary: Colors.primaryColor,
    accent: Colors.verusGreenColor,
  },
  fonts: configureFonts(fontConfig),
  version: 2
};

export default class App extends React.Component {
  state = {
    keyboardVisible: false,
  };

  componentDidMount() {
    this.keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      this._keyboardDidShow
    );
    this.keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      this._keyboardDidHide
    );
  }

  componentWillUnmount() {
    this.keyboardDidShowListener.remove();
    this.keyboardDidHideListener.remove();
  }

  _keyboardDidShow = () => {
    this.setState({ keyboardVisible: true });
  };

  _keyboardDidHide = () => {
    this.setState({ keyboardVisible: false });
  };

  render() {
    return (
      <GestureHandlerRootView style={{flex: 1}}>
        <PaperProvider theme={theme}>
          <Provider store={store}>
            <View style={{flex: 1}}>
            {/* Updated: Global translucent status bar on Android to match iOS behavior */}
            {Platform.OS === 'android' && (
              <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            )}
            <VerusMobile />
            </View>
          </Provider>
        </PaperProvider>
      </GestureHandlerRootView>
    );
  }
}

// Styles removed with PRE-RELEASE overlay
