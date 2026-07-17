/*
  Graphics
  - Rendering helpers for coin logos and layered badge variants.
  - Updated 2026-01-08: Added `disableBadge` option to `RenderSquareCoinLogo` so
    callers can suppress the automatic Verus/Ethereum badge in context-specific UI.
  - Updated 2026-01-15: Added multi-badge support for custom network indicators
    on coin logos (e.g., Ethereum + Verus overlays) with base badge aligned
    to the single-badge position and additional badges spaced to the right.
  - Updated 2026-01-15: Increased multi-badge right spacing to better separate
    dual badges in dense lists.
  - Updated 2026-01-22: Badge lookup now checks if coin exists in directory first,
    avoiding console warnings for dynamically discovered currencies.
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

export const LayeredCoinLogoWithBadges = (
  MainLogo,
  BadgeLogos = [],
  width = 40,
  height = 40,
  options = {}
) => {
  const {
    badgeSizeRatio = 0.55,
    badgeSpacingRatio = 0.65,
    badgeOverflowRatio = 0.3,
    badgePadding = 2,
  } = options;

  const badgeSize = width * badgeSizeRatio;
  const overflowOffset = badgeSize * badgeOverflowRatio;
  const badgeSpacing = badgeSize * badgeSpacingRatio;
  const validBadges = Array.isArray(BadgeLogos) ? BadgeLogos.filter(Boolean) : [];

  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: 'transparent',
        overflow: 'visible',
        zIndex: 1,
      }}
    >
      <MainLogo
        width={width}
        height={height}
      />
      {validBadges.map((BadgeLogo, index) => {
        const shift = index * badgeSpacing;
        return (
          <View
            key={`badge-${index}`}
            style={{
              position: 'absolute',
              bottom: -overflowOffset,
              right: -overflowOffset - shift,
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: 'white',
              alignItems: 'center',
              justifyContent: 'center',
              padding: badgePadding,
              zIndex: 2 + index,
            }}
          >
            <BadgeLogo
              width={badgeSize - badgePadding * 2}
              height={badgeSize - badgePadding * 2}
            />
          </View>
        );
      })}
    </View>
  );
};

export const getSimpleLogo = (chainTicker, theme = 'dark') => {
  let proto;
  let color;
  let network;
  let displayTicker;

  try {
    const coinObj = CoinDirectory.findCoinObj(chainTicker)
    color = coinObj.theme_color;
    proto = coinObj.proto;
    network = coinObj.network;
    displayTicker = coinObj.display_ticker;
  } catch(e) {
    proto = 'vrsc';
    color = coinsList.VRSC.theme_color;
  }
  
  const Logo = getCoinLogo(chainTicker, proto, theme, network, displayTicker);

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
  const { disableBadge = false, badgeIcons = null, badgeOptions = {} } = options;
  let SubLogo = null;
  const hasCustomBadges = Array.isArray(badgeIcons) && badgeIcons.length > 0;

  if (hasCustomBadges) {
    const badgeLogos = badgeIcons
      .map((iconId) => {
        try {
          const badgeData = getSimpleLogo(iconId, 'dark');
          return badgeData?.Logo || null;
        } catch (e) {
          console.warn("Failed to load badge logo for", iconId, e);
          return null;
        }
      })
      .filter(Boolean);

    if (badgeLogos.length > 0) {
      return (
        <View style={{ ...style }}>
          {LayeredCoinLogoWithBadges(Logo, badgeLogos, width, height, badgeOptions)}
        </View>
      );
    }
  }

  if (!disableBadge && !hasCustomBadges) {
    // Only attempt badge lookup for coins that exist in the directory
    // This avoids warnings for dynamically discovered currencies
    if (CoinDirectory.coinExistsInDirectory(chainTicker)) {
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
        } else if (coinObj.proto === 'erc20') {
          // All ERC20 tokens get a network badge
          if (coinObj.network === 'matic' || coinObj.network === 'matic-amoy') {
            // Polygon ERC20 -> Badge is MATIC
            const maticLogoData = getSimpleLogo('MATIC', 'dark');
            SubLogo = maticLogoData.Logo;
          } else {
            // Default: Ethereum badge
            const ethLogoData = getSimpleLogo('ETH', 'dark');
            SubLogo = ethLogoData.Logo;
          }
        }
      } catch (e) {
        // Should rarely happen now, but keep as safety net
        console.warn("Failed to determine badge for", chainTicker, e);
      }
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