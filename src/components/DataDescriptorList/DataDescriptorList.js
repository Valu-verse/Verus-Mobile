/**
 * DataDescriptorListItem - A reusable component for displaying DataDescriptor objects
 * in a compact, readable list format.
 */

import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../globals/colors';
import { processDataDescriptor, getDescriptorDisplayInfo } from '../../utils/dataDescriptor/dataDescriptorDisplay';

/**
 * Single DataDescriptor list item component
 * @param {{
 *   descriptor: object, // Raw DataDescriptor or processed descriptor
 *   onPress?: () => void,
 *   showBorder?: boolean,
 *   index?: number
 * }} props
 */
export const DataDescriptorListItem = ({ 
  descriptor, 
  onPress, 
  showBorder = false,
  index = 0 
}) => {
  // Process the descriptor if it's not already processed
  const processed = descriptor.contentType 
    ? descriptor 
    : processDataDescriptor(descriptor);
  
  const displayInfo = getDescriptorDisplayInfo(processed);
  const { title, subtitle, icon, hasImage, imageUri } = displayInfo;
  
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};
  
  return (
    <Wrapper
      style={[
        styles.container,
        showBorder && styles.borderTop,
        index % 2 === 1 && styles.alternateBackground,
      ]}
      {...wrapperProps}
    >
      {/* Icon or Image thumbnail */}
      <View style={styles.iconContainer}>
        {hasImage && imageUri ? (
          <Image 
            source={{ uri: imageUri }} 
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.iconCircle, processed.isEncrypted && styles.iconCircleEncrypted]}>
            <MaterialCommunityIcons 
              name={icon} 
              size={18} 
              color={processed.isEncrypted ? Colors.warningButtonColor : Colors.primaryColor} 
            />
          </View>
        )}
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      
      {/* Chevron if pressable */}
      {onPress && (
        <MaterialCommunityIcons 
          name="chevron-right" 
          size={20} 
          color={Colors.verusDarkGray} 
        />
      )}
    </Wrapper>
  );
};

/**
 * List of DataDescriptor items
 * @param {{
 *   descriptors: Array<object>,
 *   onItemPress?: (descriptor: object, index: number) => void,
 *   emptyMessage?: string
 * }} props
 */
export const DataDescriptorList = ({ 
  descriptors, 
  onItemPress,
  emptyMessage = 'No data descriptors' 
}) => {
  if (!descriptors || descriptors.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.listContainer}>
      {descriptors.map((descriptor, index) => {
        // Process the descriptor if needed
        const processed = descriptor.contentType 
          ? descriptor 
          : processDataDescriptor(
              descriptor && typeof descriptor.toJson === 'function' 
                ? descriptor.toJson() 
                : descriptor
            );
        
        return (
          <DataDescriptorListItem
            key={processed.key || `item-${index}`}
            descriptor={processed}
            index={index}
            showBorder={index > 0}
            onPress={onItemPress ? () => onItemPress(processed, index) : undefined}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  alternateBackground: {
    backgroundColor: '#FAFBFC',
  },
  iconContainer: {
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryColor + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleEncrypted: {
    backgroundColor: Colors.warningButtonColor + '15',
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  listContainer: {
    overflow: 'hidden',
  },
  emptyContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});

export default DataDescriptorList;
