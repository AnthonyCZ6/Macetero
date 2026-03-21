import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthScreen } from '../features/auth/navigation';
import { HomeScreen } from '../features/home/navigation';
import { ProfileScreen } from '../features/profile/navigation';
import { TandaScreen } from '../features/tanda/navigation';
import { WalletScreen } from '../features/wallet/navigation';
import { MainLayout } from '../layouts/MainLayout';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function HomeTab() {
  return (
    <MainLayout>
      <HomeScreen />
    </MainLayout>
  );
}

function WalletTab() {
  return (
    <MainLayout>
      <WalletScreen />
    </MainLayout>
  );
}

function TandaTab() {
  return (
    <MainLayout>
      <TandaScreen />
    </MainLayout>
  );
}

function ProfileTab() {
  return (
    <MainLayout>
      <ProfileScreen />
    </MainLayout>
  );
}

function MainTabsNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Wallet" component={WalletTab} />
      <Tab.Screen name="Tanda" component={TandaTab} />
      <Tab.Screen name="Profile" component={ProfileTab} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Main" component={MainTabsNavigator} />
    </Stack.Navigator>
  );
}
