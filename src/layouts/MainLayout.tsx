import { ReactNode } from 'react';
import { View } from 'react-native';

import { Header } from './Header';

type Props = { children: ReactNode };

export function MainLayout({ children }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <Header />
      {children}
    </View>
  );
}
