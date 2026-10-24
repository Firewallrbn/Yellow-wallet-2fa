import { Platform } from 'react-native';

export const colors = {
  bg: '#F6F6F4',
  surface: '#FFFFFF',
  ink: '#111111',
  muted: '#7A7A75',
  line: '#E4E4E0',
  warn: '#C2410C',
  danger: '#B91C1C',
};

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
