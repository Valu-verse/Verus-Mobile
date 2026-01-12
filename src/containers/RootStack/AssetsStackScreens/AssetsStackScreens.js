/*
  New file: AssetsStackScreens
  - Stack navigator for the Assets tab
  - Hosts the main Assets list screen
*/
import React from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import { defaultHeaderOptions } from '../../../utils/navigation/header';
import Assets from '../../Assets/Assets';

const AssetsStack = createStackNavigator();

const AssetsStackScreens = (props) => {
  return (
    <AssetsStack.Navigator
      screenOptions={defaultHeaderOptions}
    >
      <AssetsStack.Screen
        name="Assets"
        component={Assets}
        options={{
          title: "Assets",
        }}
      />
    </AssetsStack.Navigator>
  );
};

export default AssetsStackScreens;


