import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { fonts, radius, toneColors, useTheme, type Tone } from "@/theme";

// ─── Type ────────────────────────────────────────────────────────────────────

/** Archivo condensed, uppercase: titles, times, counts. */
export function Disp({ size = 32, style, color, children, ...rest }: TextProps & { size?: number; color?: string }) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 0.94, color: color ?? c.ink, textTransform: "uppercase", letterSpacing: -0.1 }, style]}
    >
      {children}
    </Text>
  );
}

export function Body({
  size = 15,
  weight = "regular",
  color,
  style,
  children,
  ...rest
}: TextProps & { size?: number; weight?: "regular" | "medium" | "semibold"; color?: string }) {
  const { c } = useTheme();
  const family = weight === "semibold" ? fonts.semibold : weight === "medium" ? fonts.medium : fonts.body;
  return (
    <Text {...rest} style={[{ fontFamily: family, fontSize: size, lineHeight: size * 1.4, color: color ?? c.ink }, style]}>
      {children}
    </Text>
  );
}

/** Geist Mono labels. `eyebrow` is the small uppercase kicker above titles. */
export function Mono({ size = 11, color, eyebrow, style, children, ...rest }: TextProps & { size?: number; color?: string; eyebrow?: boolean }) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: fonts.monoMedium, fontSize: size, color: color ?? c.muted, letterSpacing: eyebrow ? 1.2 : 0.2 },
        eyebrow && { textTransform: "uppercase" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lime" | "white" | "outlineNight";

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  style,
  haptic = true,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const { c } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.btn, fg: c.btnInk },
    secondary: { bg: c.surface, fg: c.ink, border: c.lineStrong },
    ghost: { bg: "transparent", fg: c.ink },
    danger: { bg: c.dangerSoft, fg: c.danger },
    lime: { bg: c.lime, fg: c.limeInk },
    white: { bg: "#FFFFFF", fg: "#0C0D0C" },
    outlineNight: { bg: "rgba(255,255,255,0.06)", fg: "#FFFFFF", border: "rgba(255,255,255,0.22)" },
  };
  const p = palette[variant];
  const h = size === "lg" ? 56 : size === "sm" ? 36 : 48;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        if (haptic) void Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: size === "sm" ? 14 : 22,
          borderRadius: radius.pill,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={p.fg} /> : icon}
      <Text style={{ fontFamily: fonts.semibold, fontSize: size === "sm" ? 14 : 16, color: p.fg }}>{title}</Text>
    </Pressable>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

export function Badge({ tone = "neutral", label, dot }: { tone?: Tone; label: string; dot?: boolean }) {
  const { c } = useTheme();
  const t = toneColors(c, tone);
  return (
    <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: t.bg, flexDirection: "row", alignItems: "center", gap: 6 }}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} />}
      <Text numberOfLines={1} style={{ fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: t.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Card({ children, onPress, style, ...rest }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> } & Omit<PressableProps, "style" | "children">) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 16 };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable {...rest} onPress={onPress} style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.99 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <Body size={17} weight="semibold">{children}</Body>
      {action}
    </View>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Mono eyebrow size={10.5} color={c.ink2}>
        {label}
      </Mono>
      {children}
      {error ? (
        <Body size={13} color={c.danger}>
          {error}
        </Body>
      ) : hint ? (
        <Body size={13} color={c.muted}>
          {hint}
        </Body>
      ) : null}
    </View>
  );
}

export function Input({ style, ...props }: TextInputProps & { style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.muted}
      {...props}
      style={[
        {
          minHeight: 50,
          borderRadius: 14,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.lineStrong,
          paddingHorizontal: 14,
          paddingVertical: props.multiline ? 12 : 0,
          fontFamily: fonts.body,
          fontSize: 16,
          color: c.ink,
          textAlignVertical: props.multiline ? "top" : "center",
        },
        style,
      ]}
    />
  );
}

export function SwitchRow({ label, hint, value, onValueChange }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onValueChange(!value)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <Body weight="medium">{label}</Body>
        {hint ? (
          <Body size={13} color={c.muted}>
            {hint}
          </Body>
        ) : null}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: c.night, false: c.surface2 }}
        thumbColor={value ? c.lime : "#FFFFFF"}
        ios_backgroundColor={c.surface2}
        {...({ activeThumbColor: c.lime } as object)}
      />
    </Pressable>
  );
}

/** Segmented choice, like the website's day chips and type cards. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: c.surface2, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.night : "transparent" }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? c.lime : c.ink2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 32, paddingHorizontal: 20, borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: c.lineStrong }}>
      {icon}
      <Body weight="semibold" size={17}>
        {title}
      </Body>
      {children ? (
        <Body size={14} color={c.muted} style={{ textAlign: "center" }}>
          {children}
        </Body>
      ) : null}
      {action ? <View style={{ marginTop: 6 }}>{action}</View> : null}
    </View>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const { c } = useTheme();
  const t = toneColors(c, tone);
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
      <Body size={14} color={t.fg}>
        {children}
      </Body>
    </View>
  );
}

/** A scrolling page with pull to refresh. Leaves room for the floating tab bar. */
export function Page({
  children,
  refreshing,
  onRefresh,
  padTop = 0,
  tabBar = true,
  style,
  onScroll,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padTop?: number;
  tabBar?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A plain handler, or an `Animated.event` (native driver works: the page is an Animated.ScrollView). */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { c } = useTheme();
  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ paddingTop: padTop, paddingBottom: tabBar ? 120 : 48 }, style]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.muted} /> : undefined}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 16 : undefined}
    >
      {children}
    </Animated.ScrollView>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
      <ActivityIndicator color={c.muted} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24, backgroundColor: c.bg }}>
      <Body color={c.muted} style={{ textAlign: "center" }}>
        {message}
      </Body>
      {onRetry && <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} />}
    </View>
  );
}
