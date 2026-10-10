import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'theme.dart';

// ------------------------------------------------------------------ formatting
String fmtTime(String iso) => DateFormat('h:mm a').format(DateTime.parse(iso).toLocal()).toLowerCase();
String fmtDate(String iso) => DateFormat('dd MMM yyyy').format(DateTime.parse(iso).toLocal());
String fmtDay(String iso) {
  final d = DateTime.parse(iso).toLocal();
  final t = DateTime.now();
  final diff = DateTime(d.year, d.month, d.day).difference(DateTime(t.year, t.month, t.day)).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Tomorrow';
  if (diff == -1) return 'Yesterday';
  return DateFormat('EEE dd MMM').format(d);
}
String fmtWhen(String iso) => '${fmtDay(iso)} · ${fmtTime(iso)}';
String rs(num n) => n == 0 ? 'Free' : 'Rs ${NumberFormat('#,##0').format(n)}';
String ago(String iso) {
  final s = DateTime.now().difference(DateTime.parse(iso).toLocal()).inSeconds;
  if (s < 45) return 'just now';
  if (s < 3600) return '${(s / 60).round()} min ago';
  if (s < 86400) return '${(s / 3600).round()} h ago';
  return '${(s / 86400).round()} d ago';
}
String initials(String name) => name.replaceFirst(RegExp(r'^Dr\.?\s+'), '').split(RegExp(r'\s+')).take(2).map((p) => p.isEmpty ? '' : p[0].toUpperCase()).join();

void toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Row(children: [
        Icon(error ? Icons.error_outline : Icons.check_circle_outline, color: error ? C.crit : C.ok, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(msg)),
      ]),
    ));
}

// ------------------------------------------------------------------ building blocks

/// The light-blue title band with the wide blue heading (Smart Diagnostic Center design).
class Band extends StatelessWidget {
  const Band({super.key, required this.title, this.sub, this.image});
  final String title;
  final String? sub;
  final String? image;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 14),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: C.sky, borderRadius: BorderRadius.circular(10), border: Border.all(color: C.skyLine)),
      child: Stack(children: [
        if (image != null)
          Positioned.fill(
            left: 150,
            child: ShaderMask(
              shaderCallback: (r) => const LinearGradient(colors: [Colors.transparent, Colors.black], stops: [0, .5]).createShader(r),
              blendMode: BlendMode.dstIn,
              child: Image.asset(image!, fit: BoxFit.cover),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: display(22)),
            if (sub != null) ...[
              const SizedBox(height: 8),
              SizedBox(width: 260, child: Text(sub!, style: TextStyle(color: C.skyInk, fontSize: 13.5, fontWeight: FontWeight.w500, height: 1.4))),
            ],
          ]),
        ),
      ]),
    );
  }
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.margin = const EdgeInsets.fromLTRB(16, 0, 16, 12)});
  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets margin;
  @override
  Widget build(BuildContext context) => Container(
        margin: margin,
        padding: padding,
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: C.line)),
        child: child,
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.sub, this.trailing});
  final String title;
  final String? sub;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, color: C.ink)),
            if (sub != null) Padding(padding: EdgeInsets.only(top: 2), child: Text(sub!, style: TextStyle(color: C.muted, fontSize: 12.5))),
          ]),
        ),
        if (trailing != null) trailing!,
      ]);
}

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.tone = '', this.on = false, this.onTap, this.icon});
  final String label;
  final String tone;
  final bool on;
  final VoidCallback? onTap;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final color = on ? C.navy : (tone.isEmpty ? C.ink2 : C.tone(tone));
    final bg = on ? C.sky : (tone.isEmpty ? C.surface : C.soft(C.tone(tone)));
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4), border: Border.all(color: on ? C.brandRing : (tone.isEmpty ? C.line : Colors.transparent))),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: 4)],
          Text(label, style: TextStyle(color: color, fontSize: 12.5, fontWeight: FontWeight.w700)),
        ]),
      ),
    );
  }
}

class GradientButton extends StatelessWidget {
  const GradientButton({super.key, required this.label, required this.onPressed, this.busy = false, this.icon, this.small = false});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;
  final bool small;
  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    return Opacity(
      opacity: enabled ? 1 : .55,
      child: Container(
        decoration: BoxDecoration(
          color: C.brand,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(6),
            onTap: enabled ? onPressed : null,
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: small ? 9 : 14, horizontal: small ? 14 : 18),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: small ? MainAxisSize.min : MainAxisSize.max, children: [
                if (busy) const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                if (!busy && icon != null) Icon(icon, size: 17, color: Colors.white),
                if (busy || icon != null) const SizedBox(width: 8),
                Text(label, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: small ? 13 : 15)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class GhostButton extends StatelessWidget {
  const GhostButton({super.key, required this.label, required this.onPressed, this.icon, this.danger = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool danger;
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: onPressed,
        icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 16),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        style: OutlinedButton.styleFrom(
          foregroundColor: danger ? C.crit : C.ink,
          backgroundColor: danger ? C.soft(C.crit) : C.surface,
          side: BorderSide(color: danger ? Colors.transparent : C.line),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        ),
      );
}

class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 42, this.variant = 0, this.online = false});
  final String name;
  final double size;
  final int variant;
  final bool online;
  @override
  Widget build(BuildContext context) {
    final fills = C.dark ? const [Color(0xFF1A3558), Color(0xFF12352A), Color(0xFF22264F)] : const [Color(0xFFDBE8F7), Color(0xFFDCEFE7), Color(0xFFE5E7F8)];
    final inks = C.dark ? const [Color(0xFF9CC4F0), Color(0xFF6FD3A8), Color(0xFFAAB0F5)] : const [Color(0xFF174E8C), Color(0xFF1E6B52), Color(0xFF3F47A3)];
    return Stack(clipBehavior: Clip.none, children: [
      Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(shape: BoxShape.circle, color: fills[variant % 3]),
        child: Text(initials(name), style: TextStyle(color: inks[variant % 3], fontWeight: FontWeight.w800, fontSize: size * .36)),
      ),
      if (online)
        Positioned(right: 0, bottom: 0, child: Container(width: 11, height: 11, decoration: BoxDecoration(color: C.ok, shape: BoxShape.circle, border: Border.all(color: C.surface, width: 2)))),
    ]);
  }
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.sub, required this.icon, this.tone = 'brand'});
  final String label;
  final String value;
  final String? sub;
  final IconData icon;
  final String tone;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: C.line)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: C.soft(C.tone(tone)), borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 18, color: C.tone(tone))),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label.toUpperCase(), style: TextStyle(color: C.ink2, fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: .6)),
              const SizedBox(height: 3),
              Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: C.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
              if (sub != null) Text(sub!, style: TextStyle(color: C.muted, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
      );
}

class Notice extends StatelessWidget {
  const Notice(this.text, {super.key, this.tone = 'brand', this.icon = Icons.info_outline});
  final String text;
  final String tone;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: C.soft(C.tone(tone)), borderRadius: BorderRadius.circular(6)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 16, color: C.tone(tone)),
          const SizedBox(width: 9),
          Expanded(child: Text(text, style: TextStyle(color: C.ink, fontSize: 12.5, fontWeight: FontWeight.w500, height: 1.4))),
        ]),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.sub});
  final IconData icon;
  final String title;
  final String? sub;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
        child: Column(children: [
          Icon(icon, color: C.muted, size: 30),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          if (sub != null) Padding(padding: EdgeInsets.only(top: 4), child: Text(sub!, textAlign: TextAlign.center, style: TextStyle(color: C.muted, fontSize: 12))),
        ]),
      );
}

class Meter extends StatelessWidget {
  const Meter(this.value, {super.key, this.color = C.brand});
  final double value;
  final Color color;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: 7, color: color, backgroundColor: C.surface3),
      );
}

/// Six boxes for a one-time code: auto-advance, backspace, paste, submit when full.
class OtpBoxes extends StatefulWidget {
  const OtpBoxes({super.key, required this.onComplete, this.enabled = true});
  final FutureOr<void> Function(String code) onComplete;
  final bool enabled;
  @override
  State<OtpBoxes> createState() => _OtpBoxesState();
}

class _OtpBoxesState extends State<OtpBoxes> {
  final _c = List.generate(6, (_) => TextEditingController());
  final _f = List.generate(6, (_) => FocusNode());

  @override
  void dispose() {
    for (final x in _c) {
      x.dispose();
    }
    for (final x in _f) {
      x.dispose();
    }
    super.dispose();
  }

  void _changed(int i, String v) {
    final digits = v.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      // paste / autofill: spread across the boxes
      for (var k = 0; k < 6 && i + k < 6 && k < digits.length; k++) {
        _c[i + k].text = digits[k];
      }
      _f[(i + digits.length).clamp(0, 5)].requestFocus();
    } else {
      _c[i].text = digits;
      if (digits.isNotEmpty && i < 5) _f[i + 1].requestFocus();
      if (digits.isEmpty && i > 0) _f[i - 1].requestFocus();
    }
    final code = _c.map((e) => e.text).join();
    if (code.length == 6) {
      for (final f in _f) {
        f.unfocus();
      }
      // Ready for another try if the code was wrong - only once the check is done and we are still on screen.
      Future.sync(() => widget.onComplete(code)).whenComplete(() {
        if (!mounted) return;
        for (final x in _c) {
          x.clear();
        }
        _f[0].requestFocus();
      });
    }
  }

  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(
          6,
          (i) => SizedBox(
            width: 46,
            child: TextField(
              controller: _c[i],
              focusNode: _f[i],
              enabled: widget.enabled,
              autofocus: i == 0,
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(vertical: 14), counterText: ''),
              onChanged: (v) => _changed(i, v),
            ),
          ),
        ),
      );
}
