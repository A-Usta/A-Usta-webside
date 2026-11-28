import React, { type ComponentProps } from 'react';
import {
  ActivityIndicator as NativeActivityIndicator,
  FlatList as NativeFlatList,
  Image as NativeImage,
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  Modal as NativeModal,
  Pressable as NativePressable,
  RefreshControl as NativeRefreshControl,
  ScrollView as NativeScrollView,
  Switch as NativeSwitch,
  Text as NativeText,
  TextInput as NativeTextInput,
  View as NativeView,
  StyleSheet,
} from 'react-native';
import type { ColorValue, FlatListProps, ImageProps } from 'react-native';
import { Feather as NativeFeather, MaterialCommunityIcons as NativeMaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from './app-settings';

const darkSurface: Record<string, string> = {
  '#fff': '#151D26', '#ffffff': '#151D26', '#f4f6f8': '#0C1218', '#fafbfc': '#19232D',
  '#f8f9fa': '#202A35', '#f6f8f7': '#1B2A22', '#f1f3f5': '#25303B', '#f0f1f3': '#303B47',
  '#e8ebef': '#34414E', '#eaf2ed': '#1C392B', '#fff0ee': '#3A2422', '#f3c8c5': '#663936',
  '#f5f5f5': '#202A35', '#f9fafb': '#19232D', '#fafafa': '#19232D', '#f6f7f8': '#202A35',
  '#e9edf0': '#25303B', '#f0f2f4': '#303B47',
};
const darkText: Record<string, string> = {
  '#202a35': '#EDF2F6', '#111': '#EDF2F6', '#111111': '#EDF2F6', '#202020': '#EDF2F6',
  '#7a8491': '#AAB5C0', '#98a1ab': '#AAB5C0', '#66717d': '#AAB5C0',
  '#9099a4': '#AAB5C0', '#a0a8b2': '#AAB5C0',
};
const key = (value: unknown) => typeof value === 'string' ? value.toLowerCase() : '';
const background = (value: ColorValue | undefined, scheme: 'light' | 'dark'): ColorValue | undefined => scheme === 'dark' && typeof value === 'string' ? (darkSurface[key(value)] || value) : value;
const foreground = (value: ColorValue | undefined, scheme: 'light' | 'dark'): ColorValue | undefined => scheme === 'dark' && typeof value === 'string' ? (darkText[key(value)] || value) : value;

function themedStyle(style: any, scheme: 'light' | 'dark', mode: 'surface' | 'text' | 'image' = 'surface'): any {
  if (typeof style === 'function') return (...args: any[]) => themedStyle(style(...args), scheme, mode);
  if (Array.isArray(style)) return style.map(item => themedStyle(item, scheme, mode));
  if (!style || typeof style !== 'object') return style;
  const flat = StyleSheet.flatten(style) || {};
  const result: Record<string, any> = { ...flat };
  if (mode !== 'image' && 'backgroundColor' in result) result.backgroundColor = background(result.backgroundColor, scheme);
  if (mode !== 'image' && 'color' in result) result.color = foreground(result.color, scheme);
  if (mode !== 'image' && 'borderColor' in result) result.borderColor = background(result.borderColor, scheme);
  if (mode !== 'image' && 'borderBottomColor' in result) result.borderBottomColor = background(result.borderBottomColor, scheme);
  if (mode !== 'image' && 'borderTopColor' in result) result.borderTopColor = background(result.borderTopColor, scheme);
  if (mode !== 'image' && 'borderLeftColor' in result) result.borderLeftColor = background(result.borderLeftColor, scheme);
  if (mode !== 'image' && 'borderRightColor' in result) result.borderRightColor = background(result.borderRightColor, scheme);
  return result;
}

export function View(props: ComponentProps<typeof NativeView>) {
  const { colorScheme } = useAppTheme();
  return <NativeView {...props} style={themedStyle(props.style, colorScheme)} />;
}
export function Text(props: ComponentProps<typeof NativeText>) {
  const { colorScheme } = useAppTheme();
  return <NativeText {...props} style={themedStyle(props.style, colorScheme, 'text')} />;
}
export function Pressable(props: ComponentProps<typeof NativePressable>) {
  const { colorScheme } = useAppTheme();
  return <NativePressable {...props} style={themedStyle(props.style, colorScheme)} />;
}
export function ScrollView(props: ComponentProps<typeof NativeScrollView>) {
  const { colorScheme } = useAppTheme();
  return <NativeScrollView {...props} style={themedStyle(props.style, colorScheme)} contentContainerStyle={themedStyle(props.contentContainerStyle, colorScheme)} />;
}
export function TextInput(props: ComponentProps<typeof NativeTextInput>) {
  const { colorScheme } = useAppTheme();
  return <NativeTextInput {...props} style={themedStyle(props.style, colorScheme)} placeholderTextColor={foreground(props.placeholderTextColor, colorScheme)} />;
}
export function Modal(props: ComponentProps<typeof NativeModal>) {
  return <NativeModal {...props} />;
}
export function KeyboardAvoidingView(props: ComponentProps<typeof NativeKeyboardAvoidingView>) {
  const { colorScheme } = useAppTheme();
  return <NativeKeyboardAvoidingView {...props} style={themedStyle(props.style, colorScheme)} />;
}
export function ActivityIndicator(props: ComponentProps<typeof NativeActivityIndicator>) {
  const { colorScheme } = useAppTheme();
  return <NativeActivityIndicator {...props} color={foreground(props.color, colorScheme)} />;
}
export function RefreshControl(props: ComponentProps<typeof NativeRefreshControl>) {
  const { colorScheme } = useAppTheme();
  return <NativeRefreshControl {...props} tintColor={foreground(props.tintColor, colorScheme)} />;
}
export function Switch(props: ComponentProps<typeof NativeSwitch>) {
  const { colorScheme } = useAppTheme();
  const trackColor = props.trackColor ? Object.fromEntries(Object.entries(props.trackColor).map(([state, color]) => [state, background(color as ColorValue, colorScheme)])) : undefined;
  return <NativeSwitch {...props} trackColor={trackColor} thumbColor={foreground(props.thumbColor, colorScheme)} />;
}
export function FlatList<T>(props: FlatListProps<T> & { ref?: React.Ref<NativeFlatList<T>> }) {
  const { colorScheme } = useAppTheme();
  return <NativeFlatList<T> {...props} style={themedStyle(props.style, colorScheme)} contentContainerStyle={themedStyle(props.contentContainerStyle, colorScheme)} />;
}
export function Image(props: ImageProps) {
  const { colorScheme } = useAppTheme();
  return <NativeImage {...props} style={themedStyle(props.style, colorScheme, 'image')} />;
}
type ThemedIconProps = ComponentProps<typeof NativeFeather> & { fill?: string };
const ThemedFeather = ({ fill: _fill, ...props }: ThemedIconProps) => {
  const { colorScheme } = useAppTheme();
  return <NativeFeather {...props} color={foreground(props.color, colorScheme) as ComponentProps<typeof NativeFeather>['color']} />;
};
export const Feather = Object.assign(ThemedFeather, { glyphMap: NativeFeather.glyphMap });
const ThemedMaterialCommunityIcons = (props: ComponentProps<typeof NativeMaterialCommunityIcons>) => {
  const { colorScheme } = useAppTheme();
  return <NativeMaterialCommunityIcons {...props} color={foreground(props.color, colorScheme) as ComponentProps<typeof NativeMaterialCommunityIcons>['color']} />;
};
export const MaterialCommunityIcons = Object.assign(ThemedMaterialCommunityIcons, { glyphMap: NativeMaterialCommunityIcons.glyphMap });
