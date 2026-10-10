import 'package:flutter/material.dart';
import '../colors.dart';
import '../spacing.dart';
import '../theme.dart';

/// Custom primary button following design system
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool loading;
  final bool fullWidth;
  final IconData? icon;
  final Size? minimumSize;

  const PrimaryButton({
    Key? key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.fullWidth = false,
    this.icon,
    this.minimumSize,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: fullWidth ? double.infinity : null,
      height: Spacing.buttonHeightMd,
      child: ElevatedButton.icon(
        onPressed: loading ? null : onPressed,
        icon: loading
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    Theme.of(context).colorScheme.onPrimary,
                  ),
                ),
              )
            : icon != null
                ? Icon(icon, size: Spacing.iconSm)
                : const SizedBox.shrink(),
        label: Text(label),
      ),
    );
  }
}

/// Custom secondary button
class SecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool loading;
  final bool fullWidth;
  final IconData? icon;

  const SecondaryButton({
    Key? key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.fullWidth = false,
    this.icon,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: fullWidth ? double.infinity : null,
      height: Spacing.buttonHeightMd,
      child: OutlinedButton.icon(
        onPressed: loading ? null : onPressed,
        icon: loading
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    Theme.of(context).colorScheme.primary,
                  ),
                ),
              )
            : icon != null
                ? Icon(icon, size: Spacing.iconSm)
                : const SizedBox.shrink(),
        label: Text(label),
      ),
    );
  }
}

/// Custom small button for compact layouts
class SmallButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool fullWidth;
  final IconData? icon;

  const SmallButton({
    Key? key,
    required this.label,
    required this.onPressed,
    this.fullWidth = false,
    this.icon,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: fullWidth ? double.infinity : null,
      height: Spacing.buttonHeightSm,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: icon != null ? Icon(icon, size: 16) : const SizedBox.shrink(),
        label: Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

/// Custom danger button for destructive actions
class DangerButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool fullWidth;
  final IconData? icon;

  const DangerButton({
    Key? key,
    required this.label,
    required this.onPressed,
    this.fullWidth = false,
    this.icon,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: fullWidth ? double.infinity : null,
      height: Spacing.buttonHeightMd,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: DesignColors.criticalRed,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Spacing.radiusMd),
          ),
        ),
        icon: icon != null ? Icon(icon, size: Spacing.iconSm) : const SizedBox.shrink(),
        label: Text(label),
      ),
    );
  }
}

/// Custom icon button
class CustomIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final Color? color;
  final double? size;
  final String? tooltip;

  const CustomIconButton({
    Key? key,
    required this.icon,
    required this.onPressed,
    this.color,
    this.size,
    this.tooltip,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip ?? '',
      child: IconButton(
        icon: Icon(icon),
        onPressed: onPressed,
        iconSize: size ?? Spacing.iconMd,
        color: color,
      ),
    );
  }
}

/// Ghost button - transparent with text color
class GhostButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool fullWidth;
  final IconData? icon;
  final Color? textColor;

  const GhostButton({
    Key? key,
    required this.label,
    required this.onPressed,
    this.fullWidth = false,
    this.icon,
    this.textColor,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: fullWidth ? double.infinity : null,
      height: Spacing.buttonHeightMd,
      child: TextButton.icon(
        onPressed: onPressed,
        icon: icon != null ? Icon(icon, size: 18) : const SizedBox.shrink(),
        label: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: textColor ?? Theme.of(context).colorScheme.primary,
          ),
        ),
      ),
    );
  }
}
