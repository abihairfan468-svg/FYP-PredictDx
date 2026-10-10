import 'package:flutter/material.dart';

/// Design system colors for PredictDx
class DesignColors {
  // ═════════════════════════════════════════════════════════════
  // PRIMARY COLORS
  // ═════════════════════════════════════════════════════════════

  /// Primary Blue - #0066CC (Actions, CTAs, focus states)
  static const Color primaryBlue = Color(0xFF1A6DC4);

  /// Primary Blue Hover - #0052A3 (Hover states)
  static const Color primaryBlueDark = Color(0xFF155AA3);

  /// Primary Blue Light - #EFF6FF (Light backgrounds)
  static const Color primaryBlueLightSoft = Color(0xFFE7F0FB);

  /// Primary Blue Lighter - #F0F4FF (Lighter backgrounds)
  static const Color primaryBlueLighter = Color(0xFFF0F4FF);

  /// Medical Blue - #1B5E9C (Secondary accent)
  static const Color medicalBlue = Color(0xFF1B5E9C);

  // ═════════════════════════════════════════════════════════════
  // STATUS COLORS
  // ═════════════════════════════════════════════════════════════

  /// Success Green - #10B981 (Positive states)
  static const Color successGreen = Color(0xFF15803D);

  /// Success Green Dark - #047857 (Dark green for text)
  static const Color successGreenDark = Color(0xFF047857);

  /// Success Green Light - #ECFDF5 (Light backgrounds)
  static const Color successGreenLight = Color(0xFFECFDF5);

  /// Warning Amber - #F59E0B (Caution, alerts)
  static const Color warningAmber = Color(0xFFB45309);

  /// Warning Amber Dark - #B45309 (Dark amber for text)
  static const Color warningAmberDark = Color(0xFFB45309);

  /// Warning Amber Light - #FFFBEB (Light backgrounds)
  static const Color warningAmberLight = Color(0xFFFFFBEB);

  /// Critical Red - #EF4444 (Errors, high-risk)
  static const Color criticalRed = Color(0xFFB91C1C);

  /// Critical Red Dark - #B91C1C (Dark red for text)
  static const Color criticalRedDark = Color(0xFFB91C1C);

  /// Critical Red Light - #FEF2F2 (Light backgrounds)
  static const Color criticalRedLight = Color(0xFFFEF2F2);

  /// Status Info - #0284C7 (Informational)
  static const Color statusInfo = Color(0xFF0284C7);

  /// Status Info Light - #F0F9FF (Light backgrounds)
  static const Color statusInfoLight = Color(0xFFF0F9FF);

  // ═════════════════════════════════════════════════════════════
  // LIGHT MODE NEUTRALS
  // ═════════════════════════════════════════════════════════════

  /// Background Light - #FFFFFF
  static const Color bgLight = Color(0xFFFFFFFF);

  /// Background Light Secondary - #F8FAFC
  static const Color bgLightSecondary = Color(0xFFF3F6FA);

  /// Surface Light - #F8FAFC
  static const Color surfaceLight = Color(0xFFFFFFFF);

  /// Surface Light 2 - #F1F5F9
  static const Color surfaceLight2 = Color(0xFFF1F5F9);

  /// Text Primary Light - #0F172A
  static const Color textLightPrimary = Color(0xFF0F2744);

  /// Text Secondary Light - #64748B
  static const Color textLightSecondary = Color(0xFF64748B);

  /// Text Muted Light - #94A3B8
  static const Color textLightMuted = Color(0xFF94A3B8);

  /// Border Light - #E2E8F0
  static const Color borderLight = Color(0xFFD9E1EA);

  // ═════════════════════════════════════════════════════════════
  // DARK MODE NEUTRALS
  // ═════════════════════════════════════════════════════════════

  /// Background Dark - #0F172A
  static const Color bgDark = Color(0xFF0F172A);

  /// Background Dark Secondary - #1E293B
  static const Color bgDarkSecondary = Color(0xFF1E293B);

  /// Surface Dark - #1E293B
  static const Color surfaceDark = Color(0xFF1E293B);

  /// Surface Dark 2 - #334155
  static const Color surfaceDark2 = Color(0xFF334155);

  /// Text Primary Dark - #F8FAFC
  static const Color textDarkPrimary = Color(0xFFF8FAFC);

  /// Text Secondary Dark - #CBD5E1
  static const Color textDarkSecondary = Color(0xFFCBD5E1);

  /// Text Muted Dark - #94A3B8
  static const Color textDarkMuted = Color(0xFF94A3B8);

  /// Border Dark - #334155
  static const Color borderDark = Color(0xFF334155);

  // ═════════════════════════════════════════════════════════════
  // SEMANTIC COLORS
  // ═════════════════════════════════════════════════════════════

  static const Color errorRed = criticalRed;
  static const Color errorRedLight = criticalRedLight;
  static const Color okGreen = successGreen;
  static const Color okGreenLight = successGreenLight;
  static const Color warningYellow = warningAmber;
  static const Color warningYellowLight = warningAmberLight;
  static const Color infoBlue = statusInfo;
  static const Color infoBlueLight = statusInfoLight;
}

/// Status tone helper for color selection
enum StatusTone { ok, warn, crit, info }

/// Get color based on status tone
Color getToneColor(StatusTone tone, {bool isDark = false}) {
  switch (tone) {
    case StatusTone.ok:
      return DesignColors.successGreen;
    case StatusTone.warn:
      return DesignColors.warningAmber;
    case StatusTone.crit:
      return DesignColors.criticalRed;
    case StatusTone.info:
      return DesignColors.statusInfo;
  }
}

/// Get background color based on status tone
Color getToneBgColor(StatusTone tone) {
  switch (tone) {
    case StatusTone.ok:
      return DesignColors.successGreenLight;
    case StatusTone.warn:
      return DesignColors.warningAmberLight;
    case StatusTone.crit:
      return DesignColors.criticalRedLight;
    case StatusTone.info:
      return DesignColors.statusInfoLight;
  }
}

/// Get text color for tone backgrounds
Color getToneTextColor(StatusTone tone) {
  switch (tone) {
    case StatusTone.ok:
      return DesignColors.successGreenDark;
    case StatusTone.warn:
      return DesignColors.warningAmberDark;
    case StatusTone.crit:
      return DesignColors.criticalRedDark;
    case StatusTone.info:
      return DesignColors.statusInfo;
  }
}

/// Adaptive colors that change based on theme
class AdaptiveColors {
  static Color bgColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? DesignColors.bgDark
        : DesignColors.bgLight;
  }

  static Color surfaceColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? DesignColors.surfaceDark
        : DesignColors.surfaceLight;
  }

  static Color surface2Color(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? DesignColors.surfaceDark2
        : DesignColors.surfaceLight2;
  }

  static Color textPrimaryColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? DesignColors.textDarkPrimary
        : DesignColors.textLightPrimary;
  }

  static Color textSecondaryColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? DesignColors.textDarkSecondary
        : DesignColors.textLightSecondary;
  }

  static Color textMutedColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? DesignColors.textDarkMuted
        : DesignColors.textLightMuted;
  }

  static Color borderColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? DesignColors.borderDark
        : DesignColors.borderLight;
  }
}
