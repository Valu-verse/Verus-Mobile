/*
  NotificationScreen - Full screen notification center
  Displays all notifications for the active account with swipe-to-delete and clear all functionality
  Notifications are grouped by date (Today/Earlier) and can be tapped if actionable
*/

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, FlatList, StyleSheet, Alert, Dimensions, TouchableOpacity } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { dispatchRemoveNotification, dispatchClearNotifications } from '../../actions/actions/notifications/dispatchers/notifications';
import NotificationItem from './NotificationItem';
import { getNotifications, groupNotificationsByDate } from '../../utils/notifications/notificationHelpers';
import Colors from '../../globals/colors';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const NotificationScreen = ({ navigation }) => {
  const notifications = useObjectSelector(state => state.notifications);
  const dispatch = useDispatch();
  const acchash = useSelector(state => state.authentication.activeAccount).accountHash;
  const [notificationList, setNotificationList] = useState([]);

  useEffect(() => {
    if (notifications.directory) {
      const allNotifications = getNotifications(notifications, acchash);
      const grouped = groupNotificationsByDate(allNotifications);
      setNotificationList(grouped);
    }
  }, [notifications, acchash]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Notifications',
      headerRight: () => (
        notificationList.length > 0 ? (
          <TouchableOpacity
            onPress={handleClearAll}
            style={{ paddingRight: 12 }}
          >
            <MaterialCommunityIcons
              name="delete-sweep-outline"
              size={22}
              color={Colors.verusDarkGray}
            />
          </TouchableOpacity>
        ) : null
      ),
    });
  }, [navigation, notificationList.length]);

  const handleClearAll = () => {
    if (notificationList.length === 0) return;
    
    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to clear all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive",
          onPress: () => {
            dispatchClearNotifications();
          }
        }
      ]
    );
  };

  const handleNotificationPress = (notification) => {
    if (notification.isActionable()) {
      notification.onAction({ navigation, dispatch });
    }
  };

  const handleNotificationDelete = (uid) => {
    dispatchRemoveNotification(uid);
  };

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{item.title}</Text>
        </View>
      );
    }

    return (
      <NotificationItem
        notification={item}
        onPress={() => handleNotificationPress(item)}
        onDelete={() => handleNotificationDelete(item.uid)}
      />
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <IconButton
        icon="bell-outline"
        size={64}
        iconColor={Colors.secondaryColor}
      />
      <Text style={styles.emptyText}>No notifications</Text>
      <Text style={styles.emptySubtext}>You're all caught up!</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notificationList}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.uid || `header-${index}`}
        contentContainerStyle={notificationList.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
  },
  list: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#6B7280',
  },
});

export default NotificationScreen;

