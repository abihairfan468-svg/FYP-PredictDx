import 'package:flutter/material.dart';
import '../colors.dart';
import '../spacing.dart';

/// Custom text field with label and error handling
class CustomTextField extends StatefulWidget {
  final String? label;
  final String? hintText;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final bool obscureText;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final IconData? prefixIcon;
  final IconData? suffixIcon;
  final bool required;
  final int? maxLines;
  final int? minLines;
  final String? helperText;

  const CustomTextField({
    Key? key,
    this.label,
    this.hintText,
    this.controller,
    this.keyboardType = TextInputType.text,
    this.obscureText = false,
    this.validator,
    this.onChanged,
    this.prefixIcon,
    this.suffixIcon,
    this.required = false,
    this.maxLines = 1,
    this.minLines,
    this.helperText,
  }) : super(key: key);

  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  late FocusNode _focusNode;
  bool _showPassword = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _focusNode = FocusNode();
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.label != null)
            Padding(
              padding: const EdgeInsets.only(bottom: Spacing.sm),
              child: RichText(
                text: TextSpan(
                  text: widget.label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  children: widget.required
                      ? [
                    TextSpan(
                      text: ' *',
                      style: TextStyle(
                        color: DesignColors.criticalRed,
                      ),
                    ),
                  ]
                      : [],
                ),
              ),
            ),
          TextFormField(
            controller: widget.controller,
            keyboardType: widget.keyboardType,
            obscureText: widget.obscureText && !_showPassword,
            validator: (value) {
              final error = widget.validator?.call(value);
              setState(() {
                _errorText = error;
              });
              return error;
            },
            onChanged: widget.onChanged,
            focusNode: _focusNode,
            maxLines: widget.obscureText ? 1 : widget.maxLines,
            minLines: widget.minLines,
            decoration: InputDecoration(
              hintText: widget.hintText,
              prefixIcon: widget.prefixIcon != null
                  ? Icon(widget.prefixIcon, size: 20)
                  : null,
              suffixIcon: widget.suffixIcon != null || widget.obscureText
                  ? Padding(
                padding: const EdgeInsets.only(right: 12.0),
                child: GestureDetector(
                  onTap: widget.obscureText
                      ? () {
                    setState(() {
                      _showPassword = !_showPassword;
                    });
                  }
                      : null,
                  child: Icon(
                    widget.obscureText
                        ? (_showPassword
                        ? Icons.visibility
                        : Icons.visibility_off)
                        : widget.suffixIcon,
                    size: 20,
                  ),
                ),
              )
                  : null,
              errorText: _errorText,
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(Spacing.radiusMd),
                borderSide: const BorderSide(color: DesignColors.criticalRed),
              ),
            ),
          ),
          if (widget.helperText != null && _errorText == null)
            Padding(
              padding: const EdgeInsets.only(top: Spacing.xs),
              child: Text(
                widget.helperText!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DesignColors.textLightMuted,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Email field with email validation
class EmailField extends StatelessWidget {
  final String? label;
  final TextEditingController? controller;
  final void Function(String)? onChanged;

  const EmailField({
    Key? key,
    this.label,
    this.controller,
    this.onChanged,
  }) : super(key: key);

  String? _validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return 'Email is required';
    }
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(value)) {
      return 'Please enter a valid email';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return CustomTextField(
      label: label ?? 'Email',
      hintText: 'your@email.com',
      controller: controller,
      keyboardType: TextInputType.emailAddress,
      prefixIcon: Icons.email_outlined,
      validator: _validateEmail,
      onChanged: onChanged,
      required: true,
    );
  }
}

/// Password field with show/hide toggle
class PasswordField extends StatelessWidget {
  final String? label;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;

  const PasswordField({
    Key? key,
    this.label,
    this.controller,
    this.validator,
    this.onChanged,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CustomTextField(
      label: label ?? 'Password',
      hintText: '••••••••',
      controller: controller,
      keyboardType: TextInputType.visiblePassword,
      obscureText: true,
      prefixIcon: Icons.lock_outline,
      validator: validator,
      onChanged: onChanged,
      required: true,
    );
  }
}

/// Multi-line text area
class CustomTextArea extends StatelessWidget {
  final String? label;
  final String? hintText;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final int lines;
  final bool required;

  const CustomTextArea({
    Key? key,
    this.label,
    this.hintText,
    this.controller,
    this.validator,
    this.onChanged,
    this.lines = 4,
    this.required = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CustomTextField(
      label: label,
      hintText: hintText,
      controller: controller,
      validator: validator,
      onChanged: onChanged,
      maxLines: lines,
      minLines: lines,
      required: required,
    );
  }
}

/// Dropdown/Select field
class CustomDropdown<T> extends StatelessWidget {
  final String? label;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final void Function(T?)? onChanged;
  final String? Function(T?)? validator;
  final bool required;

  const CustomDropdown({
    Key? key,
    this.label,
    required this.value,
    required this.items,
    this.onChanged,
    this.validator,
    this.required = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label != null)
            Padding(
              padding: const EdgeInsets.only(bottom: Spacing.sm),
              child: RichText(
                text: TextSpan(
                  text: label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  children: required
                      ? [
                    TextSpan(
                      text: ' *',
                      style: TextStyle(
                        color: DesignColors.criticalRed,
                      ),
                    ),
                  ]
                      : [],
                ),
              ),
            ),
          DropdownButtonFormField<T>(
            value: value,
            items: items,
            onChanged: onChanged,
            validator: validator,
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: Spacing.lg,
                vertical: Spacing.md,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
