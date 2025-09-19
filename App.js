/**
 * @format
 * @flow strict-local
 */
import React from 'react';
import { View, Text as RText, StyleSheet, Keyboard, Platform } from 'react-native';
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
            <VerusMobile />
              {!this.state.keyboardVisible && (
                <View style={styles.preReleaseContainer} pointerEvents="none">
                  <RText style={styles.preReleaseText}>PRE-RELEASE Version</RText>
                </View>
              )}
            </View>
          </Provider>
        </PaperProvider>
      </GestureHandlerRootView>
    );
  }
}

const styles = StyleSheet.create({
  preReleaseContainer: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preReleaseText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
