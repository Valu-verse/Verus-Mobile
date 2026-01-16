/*
  BottomFadeOverlay
  - 2026-01-14: New reusable bottom overlay used to create a smooth "scroll-under" fade into white
    (matching Wallet's HomeFAB gradient fade). Intended for long scrolling lists behind tab bars.
*/
import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

export default function BottomFadeOverlay({
  gradientHeight = 48,
  backgroundColor = '#FFFFFF',
  solidHeight = 0,
  style,
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
        style,
      ]}
    >
      {/* Gradient fade from transparent -> solid background */}
      <Svg height={gradientHeight} width="100%" style={{ marginBottom: -1 }}>
        <Defs>
          <LinearGradient id="bottomFadeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={backgroundColor} stopOpacity="0" />
            <Stop offset="0.3" stopColor={backgroundColor} stopOpacity="0.1" />
            <Stop offset="1" stopColor={backgroundColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={gradientHeight} fill="url(#bottomFadeGrad)" />
      </Svg>

      {/* Solid base to ensure the area behind bottom chrome is clean */}
      {solidHeight > 0 && <View style={{ height: solidHeight, backgroundColor }} />}
    </View>
  );
}

