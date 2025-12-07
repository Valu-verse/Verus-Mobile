/*
  Notification helper functions for formatting, grouping, and styling notifications
*/

import {
  NOTIFICATION_TYPE_BASIC,
  NOTIFICATION_TYPE_DEEPLINK,
  NOTIFICATION_TYPE_LOADING,
  NOTIFICATION_TYPE_NAVIGATION,
  NOTIFICATION_TYPE_VERUS_ID_PROVISIONING,
  NOTIFICATION_ICON_ERROR,
  NOTIFICATION_ICON_VERUSID,
  NOTIFICATION_ICON_VALU,
  NOTIFICATION_ICON_TX,
} from '../constants/notifications';
import {
  BasicNotification,
  DeeplinkNotification,
  LoadingNotification,
  NavigationNotification,
  VerusIdProvisioningNotification,
} from '../notification';
import { processVerusId } from '../../containers/Services/ServiceComponents/VerusIdService/VerusIdLogin';
import { createGetSponsoredAttestationNavigationCallback } from '../pop/popNotificationHelper';

/**
 * Recreate navigation callback based on stored metadata
 */
const recreateNavigationCallback = (navigationData, navigation) => {
  if (!navigationData || !navigation) {
    return () => console.warn('No navigation data or navigation object available');
  }

  // Handle different navigation types
  if (navigationData.type === 'pop_available') {
    return createGetSponsoredAttestationNavigationCallback(navigation);
  }

  // Default fallback
  return () => {
    if (navigationData.screen) {
      navigation.navigate(navigationData.screen, navigationData.params);
    }
  };
};

/**
 * Converts Redux notification directory to array of notification objects
 */
export const getNotifications = (notifications, acchash, navigation = null) => {
  const { directory } = notifications;
  let tempNotifications = [];
  const keys = Object.keys(directory || {});

  keys.forEach((uid) => {
    if (directory[uid].acchash === acchash) {
      let notification = null;

      if (directory[uid].type === NOTIFICATION_TYPE_VERUS_ID_PROVISIONING) {
        notification = VerusIdProvisioningNotification.fromJson(
          directory[uid],
          processVerusId
        );
      } else if (directory[uid].type === NOTIFICATION_TYPE_BASIC) {
        notification = BasicNotification.fromJson(directory[uid]);
      } else if (directory[uid].type === NOTIFICATION_TYPE_LOADING) {
        notification = LoadingNotification.fromJson(directory[uid]);
      } else if (directory[uid].type === NOTIFICATION_TYPE_NAVIGATION) {
        // Recreate navigation callback from metadata
        const navCallback = recreateNavigationCallback(
          directory[uid].navigationData,
          navigation
        );
        notification = NavigationNotification.fromJson(
          directory[uid],
          navCallback
        );
      } else if (directory[uid].type === NOTIFICATION_TYPE_DEEPLINK) {
        notification = DeeplinkNotification.fromJson(
          directory[uid],
          directory[uid].reopen
        );
      }

      if (notification) {
        notification.iconType = directory[uid].icon;
        notification.uid = uid;
        tempNotifications.push(notification);
      }
    }
  });

  return tempNotifications;
};

/**
 * Groups notifications by date (Today/Earlier)
 */
export const groupNotificationsByDate = (notifications) => {
  const grouped = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Separate into today and earlier
  const todayNotifications = [];
  const earlierNotifications = [];

  notifications.forEach((notification) => {
    // Since we don't have timestamps on notifications currently,
    // we'll just put them all in "earlier" for now
    // This can be enhanced later if timestamps are added to notification objects
    earlierNotifications.push(notification);
  });

  if (todayNotifications.length > 0) {
    grouped.push({ type: 'header', title: 'TODAY' });
    grouped.push(...todayNotifications);
  }

  if (earlierNotifications.length > 0) {
    grouped.push({ type: 'header', title: 'EARLIER' });
    grouped.push(...earlierNotifications);
  }

  return grouped;
};

/**
 * Maps notification type and icon to Material icon name
 */
export const getNotificationIcon = (notification) => {
  // Coinbase/ValuAttestation-style simple set of icons inside grey circle
  if (notification.iconType === NOTIFICATION_ICON_ERROR) return 'alert-circle-outline';
  if (notification.type === NOTIFICATION_TYPE_LOADING) return 'progress-clock';
  if (notification.type === NOTIFICATION_TYPE_NAVIGATION) return 'chevron-right-circle-outline';
  if (notification.type === NOTIFICATION_TYPE_DEEPLINK) return 'link-variant';
  if (notification.type === NOTIFICATION_TYPE_VERUS_ID_PROVISIONING) return 'account-outline';
  if (notification.iconType === NOTIFICATION_ICON_VALU) return 'shield-outline';
  if (notification.iconType === NOTIFICATION_ICON_TX) return 'receipt-outline';
  return 'information-outline';
};

/**
 * Maps notification type and icon to background color
 */
export const getNotificationColor = (notification) => {
  // Error notifications
  if (notification.iconType === NOTIFICATION_ICON_ERROR) {
    return '#EF4444'; // Red
  }

  // Loading/in-progress notifications
  if (notification.type === NOTIFICATION_TYPE_LOADING) {
    return '#F59E0B'; // Amber
  }

  // Navigation/action needed
  if (notification.type === NOTIFICATION_TYPE_NAVIGATION) {
    return '#10B981'; // Green
  }

  // Deeplink notifications
  if (notification.type === NOTIFICATION_TYPE_DEEPLINK) {
    return '#10B981'; // Green
  }

  // VerusID related
  if (
    notification.type === NOTIFICATION_TYPE_VERUS_ID_PROVISIONING ||
    notification.iconType === NOTIFICATION_ICON_VERUSID
  ) {
    return '#3B82F6'; // Blue
  }

  // Valu related
  if (notification.iconType === NOTIFICATION_ICON_VALU) {
    return '#8B5CF6'; // Purple
  }

  // Transaction related
  if (notification.iconType === NOTIFICATION_ICON_TX) {
    return '#06B6D4'; // Cyan
  }

  // Default info color
  return '#6B7280'; // Gray
};

