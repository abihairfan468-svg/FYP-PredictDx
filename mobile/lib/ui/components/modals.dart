import 'package:flutter/material.dart';
import '../colors.dart';
import '../spacing.dart';

/// Show custom dialog
Future<T?> showCustomDialog<T>({
  required BuildContext context,
  required String title,
  required Widget content,
  List<Widget>? actions,
  bool barrierDismissible = true,
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    builder: (BuildContext context) {
      return AlertDialog(
        title: Text(title),
        content: content,
        actions: actions,
      );
    },
  );
}

/// Show confirmation dialog
Future<bool?> showConfirmDialog({
  required BuildContext context,
  required String title,
  required String message,
  String confirmText = 'Confirm',
  String cancelText = 'Cancel',
  bool isDangerous = false,
}) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: true,
    builder: (BuildContext context) {
      return AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(cancelText),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: isDangerous
                  ? DesignColors.criticalRed
                  : Theme.of(context).colorScheme.primary,
            ),
            child: Text(confirmText),
          ),
        ],
      );
    },
  );
}

/// Show error dialog
Future<void> showErrorDialog({
  required BuildContext context,
  required String title,
  required String message,
  String actionText = 'OK',
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (BuildContext context) {
      return AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.error, color: DesignColors.criticalRed),
            const SizedBox(width: Spacing.md),
            Text(title),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            style: TextButton.styleFrom(
              foregroundColor: DesignColors.criticalRed,
            ),
            child: Text(actionText),
          ),
        ],
      );
    },
  );
}

/// Show success dialog
Future<void> showSuccessDialog({
  required BuildContext context,
  required String title,
  required String message,
  String actionText = 'OK',
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (BuildContext context) {
      return AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: DesignColors.successGreen),
            const SizedBox(width: Spacing.md),
            Text(title),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            style: TextButton.styleFrom(
              foregroundColor: DesignColors.successGreen,
            ),
            child: Text(actionText),
          ),
        ],
      );
    },
  );
}

/// Bottom sheet dialog
Future<T?> showCustomBottomSheet<T>({
  required BuildContext context,
  required String title,
  required Widget content,
  List<Widget>? actions,
}) {
  return showModalBottomSheet<T>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.only(
        topLeft: Radius.circular(Spacing.radiusXl),
        topRight: Radius.circular(Spacing.radiusXl),
      ),
    ),
    builder: (BuildContext context) {
      return Container(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: Spacing.lg),
            content,
            if (actions != null) ...[
              const SizedBox(height: Spacing.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: actions,
              ),
            ]
          ],
        ),
      );
    },
  );
}

/// Loading dialog that can't be dismissed
Future<void> showLoadingDialog({
  required BuildContext context,
  String message = 'Loading...',
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext context) {
      return WillPopScope(
        onWillPop: () async => false,
        child: AlertDialog(
          content: Row(
            children: [
              const CircularProgressIndicator(),
              const SizedBox(width: Spacing.lg),
              Text(message),
            ],
          ),
        ),
      );
    },
  );
}

/// Input dialog
Future<String?> showInputDialog({
  required BuildContext context,
  required String title,
  String? initialValue,
  String? hintText,
  String submitText = 'OK',
  String cancelText = 'Cancel',
  String? Function(String?)? validator,
}) {
  final controller = TextEditingController(text: initialValue);
  final formKey = GlobalKey<FormState>();

  return showDialog<String?>(
    context: context,
    builder: (BuildContext context) {
      return AlertDialog(
        title: Text(title),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            decoration: InputDecoration(
              hintText: hintText,
            ),
            validator: validator,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(null),
            child: Text(cancelText),
          ),
          TextButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                Navigator.of(context).pop(controller.text);
              }
            },
            child: Text(submitText),
          ),
        ],
      );
    },
  ).then((value) {
    controller.dispose();
    return value;
  });
}
