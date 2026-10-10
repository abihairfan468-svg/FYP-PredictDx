import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const _action = {
  'auth.login': 'Signed in',
  'auth.login.after_verify': 'Signed in after verifying e-mail',
  'auth.login_failed': 'Wrong password',
  'auth.mfa_challenge': 'Two-step code requested',
  'auth.mfa_failed': 'Wrong two-step code',
  'auth.locked': 'Account locked',
  'auth.password_reset': 'Password reset',
  'auth.register': 'Account created',
  'auth.email_verified': 'E-mail verified',
  'auth.refresh_reuse_detected': 'Stolen-token attempt blocked',
};

String _device(String? ua) {
  if (ua == null) return 'Unknown device';
  if (ua.contains('Dart/')) return 'PredictDx mobile app';
  final b = ua.contains('Edg/') ? 'Edge' : ua.contains('Chrome/') ? 'Chrome' : ua.contains('Firefox/') ? 'Firefox' : ua.contains('Safari/') ? 'Safari' : 'Browser';
  final os = ua.contains('Windows') ? 'Windows' : ua.contains('Android') ? 'Android' : RegExp('iPhone|iPad').hasMatch(ua) ? 'iOS' : ua.contains('Mac OS') ? 'macOS' : ua.contains('Linux') ? 'Linux' : '';
  return '$b${os.isEmpty ? '' : ' on $os'}';
}

/// Account & security - profile, password, two-step sign-in, devices, activity.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  List sessions = [], activity = [];
  late final name = TextEditingController(text: auth.user!.fullName);
  late final phone = TextEditingController(text: auth.user!.raw['phone'] ?? '');
  late final city = TextEditingController(text: auth.user!.patient?['city'] ?? '');
  final cur = TextEditingController(), next = TextEditingController(), confirm = TextEditingController();
  String? pwErr;
  bool savingProfile = false, savingPw = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait([api.get('/account/sessions'), api.get('/account/activity')]);
      if (mounted) setState(() {
        sessions = r[0] as List;
        activity = r[1] as List;
      });
    } catch (_) {}
  }

  Future<void> _saveProfile() async {
    setState(() => savingProfile = true);
    try {
      final body = {'fullName': name.text.trim(), if (phone.text.trim().isNotEmpty) 'phone': phone.text.trim(), if (city.text.trim().isNotEmpty && auth.user!.role != 'ADMIN') 'city': city.text.trim()};
      auth.setUser(Map<String, dynamic>.from(await api.patch('/account/profile', body)));
      if (mounted) toast(context, 'Profile saved');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => savingProfile = false);
    }
  }

  Future<void> _changePw() async {
    setState(() => pwErr = null);
    if (next.text != confirm.text) return setState(() => pwErr = 'The new passwords do not match');
    setState(() => savingPw = true);
    try {
      final r = await api.post('/account/password', {'currentPassword': cur.text, 'newPassword': next.text}) as Map;
      cur.clear();
      next.clear();
      confirm.clear();
      if (mounted) toast(context, 'Password changed · ${r['otherSessionsEnded']} other device(s) signed out');
      _load();
    } on ApiException catch (e) {
      setState(() => pwErr = e.message);
    } finally {
      if (mounted) setState(() => savingPw = false);
    }
  }

  Future<void> _toggleMfa() async {
    try {
      auth.setUser(Map<String, dynamic>.from(await api.post('/account/mfa', {'enabled': !auth.user!.mfaEnabled})));
      if (mounted) toast(context, auth.user!.mfaEnabled ? 'Two-step sign-in is on' : 'Two-step sign-in is off');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _setupTotp() async {
    final t = await api.post('/account/mfa/totp/setup') as Map;
    if (!mounted) return;
    final qr = base64Decode((t['qr'] as String).split(',').last);
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Set up an authenticator app', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text('Open Google or Microsoft Authenticator, scan this code or add the key, then enter the 6-digit code it shows.', textAlign: TextAlign.center, style: TextStyle(color: C.ink2, fontSize: 12.5)),
          const SizedBox(height: 14),
          Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)), child: Image.memory(qr, width: 180, height: 180)),
          const SizedBox(height: 8),
          SelectableText(t['secret'], style: TextStyle(fontSize: 12, letterSpacing: 1, color: C.muted)),
          TextButton.icon(onPressed: () => launchUrl(Uri.parse(t['otpauth'])), icon: const Icon(Icons.open_in_new, size: 16), label: const Text('Open in authenticator app on this phone')),
          const SizedBox(height: 10),
          OtpBoxes(onComplete: (code) async {
            try {
              auth.setUser(Map<String, dynamic>.from(await api.post('/account/mfa/totp/enable', {'code': code})));
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) toast(context, 'Authenticator app is now your second factor');
            } on ApiException catch (e) {
              if (mounted) toast(context, e.message, error: true);
            }
          }),
        ]),
      ),
    );
  }

  Future<void> _removeTotp() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Remove the authenticator app', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text('Enter a current code from the app to confirm. Sign-in codes will go to your e-mail instead.', textAlign: TextAlign.center, style: TextStyle(color: C.ink2, fontSize: 12.5)),
          const SizedBox(height: 14),
          OtpBoxes(onComplete: (code) async {
            try {
              auth.setUser(Map<String, dynamic>.from(await api.post('/account/mfa/totp/disable', {'code': code})));
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) toast(context, 'Authenticator removed — e-mail codes are back on');
            } on ApiException catch (e) {
              if (mounted) toast(context, e.message, error: true);
            }
          }),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = auth.user!;
    final totp = u.raw['mfaMethod'] == 'TOTP';
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        const Band(title: 'Account & security', sub: 'Your profile, password, two-step sign-in and signed-in devices.', image: 'assets/img/lungs-wide.jpg'),
        Panel(
          child: Row(children: [
            Avatar(u.fullName, size: 52),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(u.fullName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                Text(u.email, style: TextStyle(color: C.muted, fontSize: 12.5)),
                Text(u.subtitle, style: TextStyle(color: C.muted, fontSize: 12)),
              ]),
            ),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SectionTitle('Profile'),
            const SizedBox(height: 12),
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
            const SizedBox(height: 10),
            TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile number', hintText: '03xx xxxxxxx')),
            if (u.role != 'ADMIN') ...[
              const SizedBox(height: 10),
              TextField(controller: city, decoration: const InputDecoration(labelText: 'City')),
            ],
            const SizedBox(height: 12),
            GradientButton(label: 'Save profile', busy: savingProfile, onPressed: _saveProfile),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SectionTitle('Change password', sub: 'Other devices are signed out when you change it.'),
            const SizedBox(height: 12),
            TextField(controller: cur, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
            const SizedBox(height: 10),
            TextField(controller: next, obscureText: true, decoration: const InputDecoration(labelText: 'New password', helperText: 'At least 8 characters with a letter and a number')),
            const SizedBox(height: 10),
            TextField(controller: confirm, obscureText: true, decoration: const InputDecoration(labelText: 'Confirm new password')),
            if (pwErr != null) ...[const SizedBox(height: 10), Notice(pwErr!, tone: 'crit', icon: Icons.error_outline)],
            const SizedBox(height: 12),
            GradientButton(label: 'Change password', busy: savingPw, onPressed: _changePw),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('Two-step sign-in', sub: 'A second factor after your password.', trailing: Pill(u.mfaEnabled ? 'On' : 'Off', tone: u.mfaEnabled ? 'ok' : 'warn')),
            const SizedBox(height: 6),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.mail_outline, color: C.brand),
              title: const Text('E-mail code', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              subtitle: Text('6-digit code, 5-minute expiry, 5 attempts', style: TextStyle(color: C.muted, fontSize: 12)),
              trailing: !totp && u.mfaEnabled ? const Pill('In use', tone: 'ok') : null,
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.phonelink_lock_outlined, color: C.brand),
              title: const Text('Authenticator app', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              subtitle: Text('Google / Microsoft Authenticator', style: TextStyle(color: C.muted, fontSize: 12)),
              trailing: totp ? Pill('Remove', tone: 'crit', onTap: _removeTotp) : Pill('Set up', tone: 'brand', onTap: _setupTotp),
            ),
            const SizedBox(height: 6),
            if (u.mfaMandatory)
              Notice('Mandatory for ${u.role == 'DOCTOR' ? 'doctors' : 'administrators'} — it cannot be switched off.', icon: Icons.shield_outlined)
            else
              SizedBox(width: double.infinity, child: GhostButton(label: u.mfaEnabled ? 'Turn two-step sign-in off' : 'Turn two-step sign-in on', onPressed: _toggleMfa)),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('Signed-in devices', sub: '${sessions.length} active'),
            ...sessions.map((s) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon((s['userAgent'] ?? '').toString().contains('Dart/') ? Icons.phone_android : Icons.laptop, color: C.ink2),
                  title: Text(_device(s['userAgent']), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  subtitle: Text('${s['ip'] ?? ''} · active ${ago(s['lastUsedAt'])}', style: TextStyle(color: C.muted, fontSize: 12)),
                  trailing: s['current'] == true
                      ? const Pill('This device', tone: 'ok')
                      : Pill('Sign out', tone: 'crit', onTap: () async {
                          await api.delete('/account/sessions/${s['id']}');
                          if (!mounted) return;
                          toast(context, 'That device has been signed out');
                          _load();
                        }),
                )),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SectionTitle('Security activity', sub: 'Recent sign-in events on your account'),
            const SizedBox(height: 6),
            ...activity.map((a) {
              final bad = RegExp('failed|locked|reuse').hasMatch(a['action']);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  Icon(Icons.circle, size: 7, color: bad ? C.crit : C.ok),
                  const SizedBox(width: 10),
                  Expanded(child: Text('${_action[a['action']] ?? a['action']}${a['detail'] != null ? ' · ${a['detail']}' : ''}', style: TextStyle(color: C.ink2, fontSize: 12, fontWeight: FontWeight.w600))),
                  Text(ago(a['createdAt']), style: TextStyle(color: C.muted, fontSize: 10.5)),
                ]),
              );
            }),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GhostButton(label: 'Sign out', icon: Icons.logout, danger: true, onPressed: () => auth.logout()),
        ),
      ]),
    );
  }
}
