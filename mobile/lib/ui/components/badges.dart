import 'package:flutter/material.dart';
import '../colors.dart';
import '../spacing.dart';

enum StatusTone { ok, warn, crit, info }

/// Get color for status tone
Color getToneColor(StatusTone tone) {
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

/// Get background color for status tone
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

/// Custom badge widget
class CustomBadge extends StatelessWidget {
  final String label;
  final StatusTone tone;
  final IconData? icon;
  final EdgeInsets padding;

  const CustomBadge({
    Key? key,
    required this.label,
    this.tone = StatusTone.info,
    this.icon,
    this.padding = const EdgeInsets.symmetric(horizontal: Spacing.sm, vertical: Spacing.xs),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: getToneBgColor(tone),
        border: Border.all(color: getToneColor(tone).withOpacity(0.3)),
        borderRadius: BorderRadius.circular(Spacing.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: getToneColor(tone)),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: getToneColor(tone),
            ),
          ),
        ],
      ),
    );
  }
}

/// Status badge with predefined styles
class StatusBadge extends StatelessWidget {
  final String label;
  final StatusTone tone;

  const StatusBadge({
    Key? key,
    required this.label,
    required this.tone,
  }) : super(key: key);

  IconData _getIcon() {
    switch (tone) {
      case StatusTone.ok:
        return Icons.check_circle;
      case StatusTone.warn:
        return Icons.warning;
      case StatusTone.crit:
        return Icons.error;
      case StatusTone.info:
        return Icons.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    return CustomBadge(
      label: label,
      tone: tone,
      icon: _getIcon(),
    );
  }
}

/// Chip widget for multiple selection
class CustomChip extends StatelessWidget {
  final String label;
  final StatusTone tone;
  final bool selected;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;
  final IconData? icon;

  const CustomChip({
    Key? key,
    required this.label,
    this.tone = StatusTone.info,
    this.selected = false,
    this.onTap,
    this.onRemove,
    this.icon,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: Spacing.md,
          vertical: Spacing.sm,
        ),
        decoration: BoxDecoration(
          color: selected ? getToneColor(tone) : getToneBgColor(tone),
          border: Border.all(
            color: getToneColor(tone),
            width: selected ? 0 : 1,
          ),
          borderRadius: BorderRadius.circular(Spacing.radiusFull),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 16,
                color: selected ? Colors.white : getToneColor(tone),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : getToneColor(tone),
              ),
            ),
            if (onRemove != null) ...[
              const SizedBox(width: 6),
              GestureDetector(
                onTap: onRemove,
                child: Icon(
                  Icons.close,
                  size: 16,
                  color: selected ? Colors.white : getToneColor(tone),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Status dot indicator
class StatusDot extends StatelessWidget {
  final StatusTone tone;
  final double size;

  const StatusDot({
    Key? key,
    required this.tone,
    this.size = 8,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: getToneColor(tone),
        shape: BoxShape.circle,
      ),
    );
  }
}

/// Notification badge (e.g., for unread counts)
class NotificationBadge extends StatelessWidget {
  final int count;
  final Offset offset;

  const NotificationBadge({
    Key? key,
    required this.count,
    this.offset = const Offset(0, 0),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Positioned(
      right: offset.dx,
      top: offset.dy,
      child: Container(
        width: 20,
        height: 20,
        decoration: BoxDecoration(
          color: DesignColors.criticalRed,
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Text(
            count > 99 ? '99+' : count.toString(),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
