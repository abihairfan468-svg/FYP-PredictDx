import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';

/// Light / dark switch. Light is the default; the choice is remembered on the device.
class ThemeController extends ChangeNotifier {
  static const _key = 'predictdx_theme';
  final _storage = const FlutterSecureStorage();

  bool get dark => C.dark;

  Future<void> restore() async {
    try {
      if (await _storage.read(key: _key) == 'dark') _set(true);
    } catch (_) {/* storage unavailable: stay light */}
  }

  void toggle() {
    _set(!C.dark);
    _storage.write(key: _key, value: C.dark ? 'dark' : 'light').catchError((_) {});
  }

  void _set(bool v) {
    C.dark = v;
    notifyListeners();
    // Colours are read at build time, so rebuild every widget (state is kept).
    void rebuild(Element e) {
      e.markNeedsBuild();
      e.visitChildren(rebuild);
    }
    WidgetsBinding.instance.rootElement?.visitChildren(rebuild);
  }
}

final themeController = ThemeController();

/// Sun/moon button for app bars.
class ThemeToggleButton extends StatelessWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: C.dark ? 'Switch to light mode' : 'Switch to dark mode',
        icon: Icon(C.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
        onPressed: themeController.toggle,
      );
}

/// PredictDx palette, from the PredictDX Screens PDF: grey-blue page, white
/// cards, pale-blue hero band, navy type and one solid action blue.
/// Each neutral has a dark-theme twin, picked by [C.dark].
class C {
  static bool dark = false;
  static Color _p(int light, int darkValue) => Color(dark ? darkValue : light);

  static Color get bg => _p(0xFFF3F6FA, 0xFF0B1422);
  static Color get bgDeep => _p(0xFFFFFFFF, 0xFF0F1B2D);
  static Color get surface => _p(0xFFFFFFFF, 0xFF111D30);
  static Color get surface2 => _p(0xFFF5F8FC, 0xFF16243A);
  static Color get surface3 => _p(0xFFE9EFF6, 0xFF1C2D47);
  static Color get line => _p(0xFFD9E1EA, 0xFF26374F);
  static Color get lineSoft => _p(0xFFE5EAF0, 0xFF1E2E45);
  static Color get ink => _p(0xFF0F2744, 0xFFE6EDF7);
  static Color get ink2 => _p(0xFF3B4B61, 0xFFB8C5D8);
  static Color get muted => _p(0xFF64748B, 0xFF8A9AB2);
  static Color get sky => _p(0xFFE7F0FB, 0xFF13294A);
  static Color get skyLine => _p(0xFFBCD4EE, 0xFF24446E);
  static Color get skyInk => _p(0xFF1D5A99, 0xFF9CC4F0);
  static Color get title => ink;
  static Color get navy => _p(0xFF174E8C, 0xFF9CC4F0);
  static const brand = Color(0xFF1A6DC4);
  static const brandDeep = Color(0xFF155AA3);
  static Color get brandRing => _p(0xFFA9C7EA, 0xFF2D5A8E);
  static Color get ok => _p(0xFF15803D, 0xFF4ADE80);
  static Color get warn => _p(0xFFB45309, 0xFFFBBF24);
  static Color get crit => _p(0xFFB91C1C, 0xFFF87171);
  static Color get lime => _p(0xFF4450C8, 0xFF8B93F0); // AI / CareBot accent (indigo)
  static const grad = LinearGradient(colors: [brand, brand]);

  static Color soft(Color c) {
    if (c == ok) return _p(0xFFE6F4EA, 0xFF10301F);
    if (c == warn) return _p(0xFFFDF1E3, 0xFF33260C);
    if (c == crit) return _p(0xFFFDECEC, 0xFF3A1515);
    if (c == lime) return _p(0xFFEEF0FC, 0xFF1C1F45);
    if (c == brand) return sky;
    return c.withValues(alpha: dark ? 0.18 : 0.10);
  }
  static Color tone(String t) => switch (t) {
        'ok' => ok,
        'warn' => warn,
        'crit' => crit,
        'lime' => lime,
        _ => brand
      };
}

/// Heading style used for bands and large titles.
TextStyle display(double size, {Color? color, FontWeight weight = FontWeight.w800}) =>
    GoogleFonts.publicSans(fontSize: size, fontWeight: weight, color: color ?? C.ink, height: 1.15);

ThemeData buildTheme() {
  final base = C.dark ? ThemeData.dark(useMaterial3: true) : ThemeData.light(useMaterial3: true);
  final text = GoogleFonts.publicSansTextTheme(base.textTheme).apply(bodyColor: C.ink, displayColor: C.ink);
  final radius = BorderRadius.circular(6);
  OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c, width: w));

  return base.copyWith(
    scaffoldBackgroundColor: C.bg,
    colorScheme: (C.dark ? ColorScheme.dark : ColorScheme.light)(
      primary: C.brand,
      onPrimary: Colors.white,
      secondary: C.navy,
      onSecondary: Colors.white,
      surface: C.surface,
      onSurface: C.ink,
      error: C.crit,
      onError: Colors.white,
      outline: C.line,
    ),
    textTheme: text,
    dividerColor: C.lineSoft,
    appBarTheme: AppBarTheme(
      backgroundColor: C.surface,
      foregroundColor: C.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: Border(bottom: BorderSide(color: C.line)),
      titleTextStyle: GoogleFonts.publicSans(fontSize: 18, fontWeight: FontWeight.w800, color: C.ink),
      iconTheme: IconThemeData(color: C.ink),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: C.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: C.sky,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => GoogleFonts.publicSans(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: s.contains(WidgetState.selected) ? C.navy : C.muted,
          )),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? C.navy : C.muted)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 13, vertical: 13),
      hintStyle: TextStyle(color: C.dark ? const Color(0xFF6B7C95) : const Color(0xFF7A8799)),
      labelStyle: TextStyle(color: C.ink2),
      prefixIconColor: C.muted,
      suffixIconColor: C.muted,
      border: border(C.dark ? C.line : Color(0xFFCFD9E4)),
      enabledBorder: border(C.dark ? C.line : Color(0xFFCFD9E4)),
      focusedBorder: border(C.brand, 1.5),
      errorBorder: border(C.crit),
      focusedErrorBorder: border(C.crit, 1.5),
      errorStyle: TextStyle(color: C.crit),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: C.surface,
      contentTextStyle: GoogleFonts.publicSans(color: C.ink, fontWeight: FontWeight.w600),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: C.line)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: C.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(14))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: C.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: C.brand,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: C.ink,
        backgroundColor: C.surface,
        side: BorderSide(color: C.line),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: C.brand, textStyle: const TextStyle(fontWeight: FontWeight.w700)),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? C.surface : C.surface3),
        foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? C.ink : C.ink2),
        side: WidgetStatePropertyAll(BorderSide(color: C.line)),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: radius)),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? C.brand : Colors.transparent),
      side: const BorderSide(color: Color(0xFF94A3B8), width: 1.5),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: C.brand, linearTrackColor: C.surface3),
    listTileTheme: ListTileThemeData(iconColor: C.ink2, textColor: C.ink),
    chipTheme: base.chipTheme.copyWith(backgroundColor: C.surface, side: BorderSide(color: C.line), labelStyle: TextStyle(color: C.ink, fontWeight: FontWeight.w700)),
  );
}
