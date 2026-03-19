import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { HomeScreen } from './screens/HomeScreen';

export default function App() {
  return (
    <AuthProvider>
      <HomeScreen />
    </AuthProvider>
  );
}
