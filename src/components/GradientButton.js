import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const GradientButton = ({
  onPress,
  children,
  disabled = false,
  style,
  contentStyle,
  labelStyle,
  topColor = '#53C6F4',
  bottomColor = '#30A1CE',
  mode = 'contained',
}) => {
  const isOutlined = mode === 'outlined';
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.gradientButtonWrapper,
        disabled && { opacity: 0.5 },
        isOutlined ? {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: bottomColor,
        } : {
          borderWidth: 1,
          borderColor: bottomColor,
        },
        style,
      ]}
    >
      {!isOutlined && (
        <Svg
          width="100%"
          height="100%"
          style={styles.gradientBackground}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="gradientButton" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={topColor} />
              <Stop offset="1" stopColor={bottomColor} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx={24}
            ry={24}
            fill="url(#gradientButton)"
          />
        </Svg>
      )}
      <View style={[styles.gradientButtonContent, contentStyle]}>
        {typeof children === 'string' ? (
          <Text 
            style={[
              styles.gradientButtonLabel, 
              isOutlined && { 
                color: bottomColor, 
                textShadowColor: 'transparent',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0
              },
              labelStyle
            ]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gradientButtonWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    height: 52,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientButtonContent: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

export default GradientButton;


