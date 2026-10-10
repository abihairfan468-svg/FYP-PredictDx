import 'package:flutter/material.dart';

/// Spacing tokens for PredictDx
/// Based on 4px baseline grid
class Spacing {
  // ═════════════════════════════════════════════════════════════
  // SPACING (4px baseline grid)
  // ═════════════════════════════════════════════════════════════

  static const double xs = 4.0;      // Extra small
  static const double sm = 8.0;      // Small
  static const double md = 12.0;     // Medium
  static const double lg = 16.0;     // Large
  static const double xl = 24.0;     // Extra large
  static const double xxl = 32.0;    // 2X large
  static const double xxxl = 48.0;   // 3X large

  // ═════════════════════════════════════════════════════════════
  // BORDER RADIUS
  // ═════════════════════════════════════════════════════════════

  static const double radiusXs = 4.0;
  static const double radiusSm = 6.0;
  static const double radiusMd = 8.0;
  static const double radiusLg = 12.0;
  static const double radiusXl = 16.0;
  static const double radiusFull = 999.0;

  // ═════════════════════════════════════════════════════════════
  // SHADOWS
  // ═════════════════════════════════════════════════════════════

  static const BoxShadow shadowSm = BoxShadow(
    color: Color.fromARGB(13, 0, 0, 0),
    blurRadius: 3.0,
    offset: Offset(0, 1),
  );

  static const BoxShadow shadowMd = BoxShadow(
    color: Color.fromARGB(31, 0, 0, 0),
    blurRadius: 8.0,
    offset: Offset(0, 2),
  );

  static const BoxShadow shadowLg = BoxShadow(
    color: Color.fromARGB(31, 0, 0, 0),
    blurRadius: 24.0,
    offset: Offset(0, 8),
  );

  static const BoxShadow shadowXl = BoxShadow(
    color: Color.fromARGB(38, 0, 0, 0),
    blurRadius: 32.0,
    offset: Offset(0, 12),
  );

  static const List<BoxShadow> shadowSmList = [shadowSm];
  static const List<BoxShadow> shadowMdList = [shadowMd];
  static const List<BoxShadow> shadowLgList = [shadowLg];
  static const List<BoxShadow> shadowXlList = [shadowXl];

  // ═════════════════════════════════════════════════════════════
  // FOCUS SHADOWS
  // ═════════════════════════════════════════════════════════════

  static const BoxShadow shadowFocus = BoxShadow(
    color: Color.fromARGB(25, 0, 102, 204),
    blurRadius: 0.0,
    spreadRadius: 3.0,
    offset: Offset(0, 0),
  );

  static const List<BoxShadow> shadowFocusList = [shadowFocus];

  // ═════════════════════════════════════════════════════════════
  // ICON SIZES
  // ═════════════════════════════════════════════════════════════

  static const double iconXs = 16.0;
  static const double iconSm = 20.0;
  static const double iconMd = 24.0;
  static const double iconLg = 32.0;
  static const double iconXl = 48.0;

  // ═════════════════════════════════════════════════════════════
  // BUTTON SIZES
  // ═════════════════════════════════════════════════════════════

  static const double buttonHeightXs = 32.0;
  static const double buttonHeightSm = 40.0;
  static const double buttonHeightMd = 48.0;
  static const double buttonHeightLg = 56.0;

  static const EdgeInsets buttonPaddingXs = EdgeInsets.symmetric(
    horizontal: md,
    vertical: xs,
  );

  static const EdgeInsets buttonPaddingSm = EdgeInsets.symmetric(
    horizontal: lg,
    vertical: sm,
  );

  static const EdgeInsets buttonPaddingMd = EdgeInsets.symmetric(
    horizontal: xl,
    vertical: md,
  );

  static const EdgeInsets buttonPaddingLg = EdgeInsets.symmetric(
    horizontal: xxl,
    vertical: lg,
  );

  // ═════════════════════════════════════════════════════════════
  // INPUT SIZES
  // ═════════════════════════════════════════════════════════════

  static const double inputHeight = 48.0;
  static const EdgeInsets inputPadding = EdgeInsets.symmetric(
    horizontal: lg,
    vertical: md,
  );

  // ═════════════════════════════════════════════════════════════
  // CARD PADDING
  // ═════════════════════════════════════════════════════════════

  static const EdgeInsets cardPaddingSm = EdgeInsets.all(md);
  static const EdgeInsets cardPaddingMd = EdgeInsets.all(lg);
  static const EdgeInsets cardPaddingLg = EdgeInsets.all(xl);

  // ═════════════════════════════════════════════════════════════
  // SCREEN PADDING
  // ═════════════════════════════════════════════════════════════

  static const EdgeInsets screenPadding = EdgeInsets.symmetric(
    horizontal: lg,
    vertical: xl,
  );

  static const EdgeInsets screenPaddingCompact = EdgeInsets.all(md);

  // ═════════════════════════════════════════════════════════════
  // DIVIDER HEIGHTS
  // ═════════════════════════════════════════════════════════════

  static const double dividerThickness = 1.0;
  static const double dividerThicknessBold = 2.0;

  // ═════════════════════════════════════════════════════════════
  // GAP VALUES
  // ═════════════════════════════════════════════════════════════

  static SizedBox gapXs = const SizedBox(width: xs, height: xs);
  static SizedBox gapSm = const SizedBox(width: sm, height: sm);
  static SizedBox gapMd = const SizedBox(width: md, height: md);
  static SizedBox gapLg = const SizedBox(width: lg, height: lg);
  static SizedBox gapXl = const SizedBox(width: xl, height: xl);
  static SizedBox gapXxl = const SizedBox(width: xxl, height: xxl);
  static SizedBox gapXxxl = const SizedBox(width: xxxl, height: xxxl);

  // Horizontal only
  static SizedBox hgapXs = const SizedBox(width: xs);
  static SizedBox hgapSm = const SizedBox(width: sm);
  static SizedBox hgapMd = const SizedBox(width: md);
  static SizedBox hgapLg = const SizedBox(width: lg);
  static SizedBox hgapXl = const SizedBox(width: xl);
  static SizedBox hgapXxl = const SizedBox(width: xxl);
  static SizedBox hgapXxxl = const SizedBox(width: xxxl);

  // Vertical only
  static SizedBox vgapXs = const SizedBox(height: xs);
  static SizedBox vgapSm = const SizedBox(height: sm);
  static SizedBox vgapMd = const SizedBox(height: md);
  static SizedBox vgapLg = const SizedBox(height: lg);
  static SizedBox vgapXl = const SizedBox(height: xl);
  static SizedBox vgapXxl = const SizedBox(height: xxl);
  static SizedBox vgapXxxl = const SizedBox(height: xxxl);
}

/// Responsive spacing that adjusts based on screen size
class ResponsiveSpacing {
  final BuildContext context;

  ResponsiveSpacing(this.context);

  bool get isCompact => MediaQuery.of(context).size.width < 600;
  bool get isTablet =>
      MediaQuery.of(context).size.width >= 600 &&
      MediaQuery.of(context).size.width < 1024;
  bool get isDesktop => MediaQuery.of(context).size.width >= 1024;

  // Responsive padding
  EdgeInsets get screenPadding {
    if (isCompact) {
      return const EdgeInsets.symmetric(horizontal: 12.0, vertical: 16.0);
    } else if (isTablet) {
      return const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0);
    } else {
      return const EdgeInsets.symmetric(horizontal: 26.0, vertical: 22.0);
    }
  }

  // Responsive gap
  double get defaultGap => isCompact ? 12.0 : 16.0;
}
