/*
  VerusIdWidget
  - Redesign to match AttestationWidget template
  - Very light grey → white gradient background
  - Copy only: "Manage my VerusID" (icons removed)
  - Text aligned bottom-left
*/
import React from 'react';
import {View, Dimensions} from 'react-native';
import {Card, Paragraph} from 'react-native-paper';
import Colors from '../../../globals/colors';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';

const VerusIdWidget = props => {
  const {width} = Dimensions.get('window');
  const cardWidth = width / 2 - 16;
  const cardHeight = 110;
  // No background icon (removed)

  return (
    <Card
      style={{
        height: cardHeight,
        width: cardWidth,
        borderRadius: 10,
        backgroundColor: Colors.ultraUltraLightGrey
      }}
      mode="elevated"
      elevation={5}>
      <Card.Content style={{ height: cardHeight, padding: 12 }}>
        {/* Very light gradient background */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10, overflow: 'hidden' }} pointerEvents="none">
          <Svg width={cardWidth} height={cardHeight}>
            <Defs>
              {/* Base subtle light gradient */}
              <SvgLinearGradient id="verusIdGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.6" stopColor="#F8F8F8" />
                <Stop offset="1" stopColor="#F2F2F2" />
              </SvgLinearGradient>
              {/* Branded radial highlight in bottom-right */}
              <SvgRadialGradient id="verusIdHighlight" cx="0.92" cy="0.88" r="0.85">
                <Stop offset="0" stopColor="#3165D4" stopOpacity="0.18" />
                <Stop offset="0.6" stopColor="#3165D4" stopOpacity="0.08" />
                <Stop offset="1" stopColor="#3165D4" stopOpacity="0" />
              </SvgRadialGradient>
            </Defs>
            <Rect x={0} y={0} width={cardWidth} height={cardHeight} fill="url(#verusIdGradient)" rx={10} ry={10} />
            <Rect x={0} y={0} width={cardWidth} height={cardHeight} fill="url(#verusIdHighlight)" rx={10} ry={10} />
          </Svg>
        </View>

        <View
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-end'
          }}>
          <Paragraph style={{ fontSize: 18, color: '#3165D4', fontWeight: '700', letterSpacing: -0.2, lineHeight: 22 }}>
            {'Manage my VerusID'}
          </Paragraph>
        </View>
      </Card.Content>
    </Card>
  );
};

export default VerusIdWidget;
