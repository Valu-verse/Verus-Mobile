/*
  Graphics
  - Rendering helpers for coin logos and layered badge variants.
  - Updated 2026-01-08: Added `disableBadge` option to `RenderSquareCoinLogo` so
    callers can suppress the automatic Verus/Ethereum badge in context-specific UI.
*/

import React from "react";
import { Card } from "react-native-paper";
import { View } from "react-native";
import { getCoinLogo } from "./CoinData";
import { CoinDirectory } from "./CoinDirectory";
import { coinsList } from "./CoinsList";

export const RenderSquareLogo = (LogoComponent, color, width = 40, height = 40) => {
  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: 'transparent',
      }}
    >
      {LogoComponent}
    </View>
  );
};

export const RenderCircleLogo = (LogoComponent, color, width = 40, height = 40) => {
  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: width / 2,
        backgroundColor: 'transparent',
      }}
    >
      {LogoComponent}
    </View>
  );
};

export const LayeredCoinLogo = (MainLogo, SubLogo, width = 40, height = 40) => {
  const subLogoSize = width * 0.55; // Badge size relative to main logo
  const overflowOffset = subLogoSize * 0.3; // How much the badge hangs "out"

  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: 'transparent',
        overflow: 'visible', // Allow badge to hang out
        zIndex: 1,
      }}
    >
      <MainLogo
        width={width}
        height={height}
      />
      {SubLogo && (
        <View
          style={{
            position: 'absolute',
            bottom: -overflowOffset, // Hang off the bottom
            right: -overflowOffset, // Hang off the right
            width: subLogoSize,
            height: subLogoSize,
            borderRadius: subLogoSize / 2,
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 2,
            zIndex: 2, // Ensure badge is on top
          }}
        >
          <SubLogo
            width={subLogoSize - 4}
            height={subLogoSize - 4}
          />
        </View>
      )}
    </View>
  );
};

export const getSimpleLogo = (chainTicker, theme = 'dark') => {
  let proto;
  let color;

  try {
    const coinObj = CoinDirectory.findCoinObj(chainTicker)
    color = coinObj.theme_color;
    proto = coinObj.proto;
  } catch(e) {
    proto = 'vrsc';
    color = coinsList.VRSC.theme_color;
  }
  
  const Logo = getCoinLogo(chainTicker, proto, theme);

  return { Logo: Logo, color };
}

export const RenderSquareCoinLogo = (
  chainTicker,
  style = {},
  width = 40,
  height = 40,
  options = {}
) => {
  const { Logo, color } = getSimpleLogo(chainTicker, 'dark');
  const { disableBadge = false } = options;
  let SubLogo = null;

  if (!disableBadge) {
    try {
      const coinObj = CoinDirectory.findCoinObj(chainTicker);
      
      // Determine if we need a badge (SubLogo)
      if (
        (coinObj.display_ticker.includes('.vETH') || 
        coinObj.display_name.includes('on Verus')) &&
        !coinObj.display_ticker.includes('Bridge.vETH') // Exception for Bridge.vETH
      ) {
        // It's a mapped token on Verus -> Badge is Verus
        const verusLogoData = getSimpleLogo('VRSC', 'dark');
        SubLogo = verusLogoData.Logo;
      } else if (
        coinObj.display_name.includes('on Ethereum')
      ) {
        // It's a mapped token on Ethereum -> Badge is Ethereum
        const ethLogoData = getSimpleLogo('ETH', 'dark');
        SubLogo = ethLogoData.Logo;
      }
    } catch (e) {
      console.warn("Failed to determine badge for", chainTicker, e);
    }
  }

  if (SubLogo) {
    return (
      <View style={{ ...style }}>
        {LayeredCoinLogo(Logo, SubLogo, width, height)}
      </View>
    );
  }

  return RenderSquareLogo(
    <Logo
      width={width}
      height={height}
      style={{
        alignSelf: "center",
        ...style
      }}
    />,
    color,
    width,
    height
  );
};

export const RenderCircleCoinLogo = (chainTicker, style = {}, width = 40, height = 40) => {
  const { Logo, color } = getSimpleLogo(chainTicker, 'dark');

  return RenderCircleLogo(
    <Logo
      width={width}
      height={height}
      style={{
        alignSelf: "center",
        ...style
      }}
    />,
    color,
    width,
    height
  );
};

export const RenderPlainCoinLogo = (chainTicker, style = {}, width = 40, height = 40) => {
  const { Logo } = getSimpleLogo(chainTicker, 'dark');

  return <Logo
    width={width}
    height={height}
    style={{
      alignSelf: "center",
      ...style
    }}
  />
};