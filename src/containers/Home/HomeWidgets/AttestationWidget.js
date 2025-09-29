/*
  AttestationWidget
  - Redesign: Valu brand gradient background
  - Copy only: "Get your Proof of Personhood" (icons removed)
  - Implemented gradient using react-native-svg to avoid adding new dependencies
*/
import React from 'react';
import { View, Dimensions } from 'react-native';
import { Card, Paragraph } from 'react-native-paper';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

const AttestationWidget = props => {
    const { hasValuProofOfPersonhood } = props;
    const { width } = Dimensions.get('window');
    const cardWidth = width / 2 - 16;
    const cardHeight = 110;

    // Determine the text based on whether user has the attestation
    const widgetText = hasValuProofOfPersonhood 
        ? 'View your Proof of Personhood' 
        : 'Get your Proof of Personhood';

    return (
        <Card
            style={{
                height: cardHeight,
                width: cardWidth,
                borderRadius: 10,
                backgroundColor: '#0077A9'
            }}
            mode="elevated"
            elevation={5}>
            <Card.Content style={{ height: cardHeight, padding: 12 }}>
                {/* Gradient background (Valu brand blues) */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10, overflow: 'hidden' }} pointerEvents="none">
                    <Svg width={cardWidth} height={cardHeight}>
                        <Defs>
                            <SvgLinearGradient id="valuGradient" x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0" stopColor="#00C8FF" />
                                <Stop offset="1" stopColor="#0077A9" />
                            </SvgLinearGradient>
                        </Defs>
                        <Rect x={0} y={0} width={cardWidth} height={cardHeight} fill="url(#valuGradient)" rx={10} ry={10} />
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
                    <Paragraph style={{ fontSize: 18, color: '#FFFFFF', fontWeight: '700', letterSpacing: -0.2, lineHeight: 22 }}>
                        {widgetText}
                    </Paragraph>
                </View>
            </Card.Content>
        </Card>
    );
};

export default AttestationWidget;
