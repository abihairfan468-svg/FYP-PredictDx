import 'package:flutter/material.dart';
import '../colors.dart';
import '../spacing.dart';

/// Custom card widget
class CustomCard extends StatelessWidget {
  final Widget child;
  final bool clickable;
  final bool selected;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final List<BoxShadow>? shadows;

  const CustomCard({
    Key? key,
    required this.child,
    this.clickable = false,
    this.selected = false,
    this.padding = const EdgeInsets.all(Spacing.lg),
    this.onTap,
    this.backgroundColor,
    this.shadows,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: clickable ? onTap : null,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: backgroundColor ?? (isDark ? DesignColors.surfaceDark : DesignColors.surfaceLight),
          border: Border.all(
            color: selected ? DesignColors.primaryBlue : (isDark ? DesignColors.borderDark : DesignColors.borderLight),
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(Spacing.radiusLg),
          boxShadow: shadows ?? [Spacing.shadowSm],
        ),
        child: child,
      ),
    );
  }
}

/// Study/Record card with thumbnail
class StudyCard extends StatelessWidget {
  final String? thumbnailUrl;
  final String? code;
  final String? title;
  final String? subtitle;
  final String? status; // ready, pending, running, error
  final VoidCallback? onTap;

  const StudyCard({
    Key? key,
    this.thumbnailUrl,
    this.code,
    this.title,
    this.subtitle,
    this.status,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CustomCard(
      clickable: true,
      onTap: onTap,
      padding: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Row(
          children: [
            if (thumbnailUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(Spacing.radiusSm),
                child: Image.network(
                  thumbnailUrl!,
                  width: 40,
                  height: 40,
                  fit: BoxFit.cover,
                ),
              ),
            if (thumbnailUrl != null) const SizedBox(width: Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (code != null)
                    Text(
                      code!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontFamily: 'Courier',
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  if (title != null)
                    Text(
                      title!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ),
            if (status != null)
              _StatusBadge(status: status!),
          ],
        ),
      ),
    );
  }
}

/// Stat card for dashboards
class StatCard extends StatelessWidget {
  final IconData? icon;
  final String? label;
  final String value;
  final String? action;
  final VoidCallback? onActionTap;
  final Color? iconColor;

  const StatCard({
    Key? key,
    this.icon,
    this.label,
    required this.value,
    this.action,
    this.onActionTap,
    this.iconColor,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CustomCard(
      padding: const EdgeInsets.all(Spacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (icon != null)
            Icon(
              icon,
              size: 32,
              color: iconColor ?? DesignColors.primaryBlue,
            ),
          if (icon != null) const SizedBox(height: Spacing.md),
          if (label != null)
            Text(
              label!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
          const SizedBox(height: Spacing.sm),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: Spacing.md),
            GestureDetector(
              onTap: onActionTap,
              child: Text(
                action!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DesignColors.primaryBlue,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ]
        ],
      ),
    );
  }
}

/// Internal status badge widget
class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, text, icon) = switch (status) {
      'ready' => (DesignColors.successGreen, 'Ready', '✓'),
      'pending' => (DesignColors.warningAmber, 'Pending', '○'),
      'running' => (DesignColors.statusInfo, 'Running', '⟳'),
      'error' => (DesignColors.criticalRed, 'Error', '✕'),
      _ => (DesignColors.textLightMuted, status, '•'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.sm,
        vertical: Spacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        border: Border.all(color: color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(Spacing.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            icon,
            style: TextStyle(color: color, fontSize: 10),
          ),
          const SizedBox(width: 2),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
