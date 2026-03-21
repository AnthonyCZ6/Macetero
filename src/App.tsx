import { AppProvider } from './core/providers/AppProvider';
import { AppNavigator } from './navigation/AppNavigator';

export default function App() {
  return (
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  );
}
