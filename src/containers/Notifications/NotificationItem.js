/*
  NotificationItem - Individual notification card with swipe-to-delete
  Displays notification icon, title, body, and action indicator
*/

import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { Swipeable } from 'react-native-gesture-handler';
import { getNotificationIcon, getNotificationColor } from '../../utils/notifications/notificationHelpers';
import Colors from '../../globals/colors';

const { width } = Dimensions.get('window');

const NotificationItem = ({ notification, onPress, onDelete }) => {
  const swipeableRef = useRef(null);
  const isActionable = notification.isActionable();
  
  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.deleteContainer}>
        <Animated.View style={[styles.deleteButton, { transform: [{ scale }] }]}>
          <IconButton
            icon="delete-outline"
            iconColor="#FFFFFF"
            size={24}
          />
        </Animated.View>
      </View>
    );
  };

  const handleSwipeOpen = (direction) => {
    if (direction === 'right') {
      swipeableRef.current?.close();
      setTimeout(() => {
        onDelete();
      }, 100);
    }
  };

  const renderTitle = () => {
    const title = notification.title;
    
    if (typeof title === 'string') {
      return <Text style={styles.title}>{title}</Text>;
    }
    
    if (Array.isArray(title)) {
      return (
        <Text style={styles.title}>
          {title.map((part, index) => {
            if (index % 2 === 0 && part.includes('@')) {
              return (
                <Text key={index} style={styles.titleBold}>
                  {part}
                </Text>
              );
            }
            return <Text key={index}>{part}</Text>;
          })}
        </Text>
      );
    }
    
    return <Text style={styles.title}>Notification</Text>;
  };

  const iconName = getNotificationIcon(notification);
  const iconColor = getNotificationColor(notification);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={40}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={isActionable ? 0.7 : 1}
        disabled={!isActionable}
      >
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8E8E8' }]}> 
              <IconButton
                icon={iconName}
                iconColor={'black'}
                size={16}
              />
            </View>
          </View>

          <View style={styles.textContainer}>
            {renderTitle()}
            {notification.body && notification.body.length > 0 && (
              <Text style={styles.body}>{notification.body}</Text>
            )}
          </View>

          {isActionable && (
            <IconButton
              icon="chevron-right"
              iconColor="#9CA3AF"
              size={20}
            />
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEDED',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 2,
  },
  titleBold: {
    fontWeight: '600',
    color: Colors.primaryColor,
  },
  body: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 2,
  },
  deleteContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationItem;

