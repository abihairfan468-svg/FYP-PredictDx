import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

enum _Step { signin, signup, verify, mfa, forgot, reset, pending }

const _roles = [
  ('PATIENT', 'Patient', Icons.person_outline),
  ('DOCTOR', 'Doctor', Icons.medical_services_outlined),
  ('ADMIN', 'Admin', Icons.shield_outlined),
];
final _pwRules = <(RegExp, String)>[
  (RegExp(r'.{8,}'), '8+ characters'),
  (RegExp(r'[A-Z]'), 'upper-case'),
  (RegExp(r'[a-z]'), 'lower-case'),
  (RegExp(r'\d'), 'number'),
  (RegExp(r'[^A-Za-z0-9]'), 'symbol'),
];

/// Sign in, create account, e-mail verification, two-step code and password reset.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, this.signUp = false});
  final bool signUp;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late _Step step = widget.signUp ? _Step.signup : _Step.signin;
  String role = 'PATIENT';
  bool busy = false;
  String? error;
  bool showPw = false;

  final email = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  final name = TextEditingController();
  final phone = TextEditingController();
  final city = TextEditingController(text: 'Islamabad');
  final pmdc = TextEditingController();
  final qualification = TextEditingController();
  final hospital = TextEditingController();
  final fee = TextEditingController(text: '2000');
  final newPw = TextEditingController();
  String gender = 'FEMALE';
  String speciality = 'Pulmonology';
  bool agree = false;

  String masked = '';
  String mfaToken = '';
  String mfaMethod = 'EMAIL';
  int cooldown = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => cooldown = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || cooldown <= 1) {
        t.cancel();
        if (mounted) setState(() => cooldown = 0);
      } else {
        setState(() => cooldown--);
      }
    });
  }

  void _showCode(String? code) {
    if (code != null) toast(context, 'Verification code: $code');
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await fn();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _after(AuthStep s) {
    switch (s.status) {
      case 'OK':
        Navigator.of(context).popUntil((r) => r.isFirst);
      case 'VERIFY_EMAIL':
        masked = s.maskedEmail ?? '';
        email.text = s.email ?? email.text;
        _startCooldown();
        _showCode(s.devCode);
        setState(() => step = _Step.verify);
      case 'MFA_REQUIRED':
        masked = s.maskedEmail ?? '';
        mfaToken = s.mfaToken ?? '';
        mfaMethod = s.method ?? 'EMAIL';
        _startCooldown();
        _showCode(s.devCode);
        setState(() => step = _Step.mfa);
      case 'PENDING_APPROVAL':
        setState(() => step = _Step.pending);
    }
  }

  bool get _pwOk => _pwRules.every((r) => r.$1.hasMatch(password.text));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(title: const Text('PredictDx'), actions: const [ThemeToggleButton()]),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 30), children: [
          const Text('WELCOME TO PREDICTDX', style: TextStyle(color: C.brand, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
          const SizedBox(height: 12),
          if (step == _Step.signin || step == _Step.signup) ..._modeAndRoles(),
          if (error != null) ...[const SizedBox(height: 12), Notice(error!, tone: 'crit', icon: Icons.error_outline)],
          const SizedBox(height: 14),
          ...switch (step) {
            _Step.signin => _signin(),
            _Step.signup => _signup(),
            _Step.verify || _Step.mfa => _otp(),
            _Step.forgot => _forgot(),
            _Step.reset => _reset(),
            _Step.pending => _pending(),
          },
        ]),
      ),
    );
  }

  List<Widget> _modeAndRoles() => [
        Text(step == _Step.signin ? 'Sign in' : 'Create account', style: TextStyle(color: C.ink, fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        Text('I AM A', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        Row(
          children: _roles.map((r) {
            final disabled = step == _Step.signup && r.$1 == 'ADMIN';
            final on = role == r.$1;
            return Expanded(
              child: GestureDetector(
                onTap: disabled ? null : () => setState(() => role = r.$1),
                child: Opacity(
                  opacity: disabled ? .45 : 1,
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: on ? C.soft(C.brand) : C.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: on ? C.brand : C.line),
                    ),
                    child: Column(children: [
                      Icon(r.$3, color: on ? C.brand : C.muted, size: 20),
                      const SizedBox(height: 4),
                      Text(r.$2, style: TextStyle(fontWeight: FontWeight.w800, color: on ? C.ink : C.ink2, fontSize: 13)),
                    ]),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ];

  Widget _pwField(TextEditingController c, String label) => TextField(
        controller: c,
        obscureText: !showPw,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: const Icon(Icons.lock_outline, size: 18),
          suffixIcon: IconButton(icon: Icon(showPw ? Icons.visibility_off : Icons.visibility, size: 18), onPressed: () => setState(() => showPw = !showPw)),
        ),
      );

  Widget _strength(String value) {
    final met = _pwRules.where((r) => r.$1.hasMatch(value)).length;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Meter(met / 5, color: met <= 2 ? C.crit : met < 5 ? C.warn : C.ok),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: _pwRules.map((r) => Pill('${r.$1.hasMatch(value) ? '✓' : '·'} ${r.$2}', tone: r.$1.hasMatch(value) ? 'ok' : '')).toList()),
    ]);
  }

  List<Widget> _signin() => [
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'E-mail address', prefixIcon: Icon(Icons.mail_outline, size: 18))),
        const SizedBox(height: 12),
        _pwField(password, 'Password'),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(onPressed: () => setState(() => step = _Step.forgot), child: const Text('Forgot password?', style: TextStyle(color: C.brand))),
        ),
        GradientButton(
          label: 'Sign in as ${_roles.firstWhere((r) => r.$1 == role).$2.toLowerCase()}',
          busy: busy,
          onPressed: () {
            if (email.text.trim().isEmpty || password.text.isEmpty) return setState(() => error = 'Enter your e-mail and password');
            _run(() async => _after(await auth.login(email.text, password.text, role)));
          },
        ),
        const SizedBox(height: 12),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.lock_outline, size: 13, color: C.muted),
          SizedBox(width: 5),
          Text('Two-step sign-in is on', style: TextStyle(color: C.muted, fontSize: 12)),
        ]),
        _switchLine('New to PredictDx?', 'Create an account', _Step.signup),
      ];

  /// "New to PredictDx? Create an account" / "Already have an account? Sign in" under each form.
  Widget _switchLine(String text, String action, _Step to) => Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(text, style: TextStyle(color: C.ink2, fontSize: 13)),
        TextButton(
          onPressed: () => setState(() {
            step = to;
            error = null;
            if (to == _Step.signup && role == 'ADMIN') role = 'PATIENT';
          }),
          child: Text(action, style: const TextStyle(color: C.brand, fontWeight: FontWeight.w700)),
        ),
      ]);

  List<Widget> _signup() => [
        TextField(controller: name, decoration: InputDecoration(labelText: 'Full name', hintText: role == 'DOCTOR' ? 'Dr Firstname Lastname' : 'Firstname Lastname')),
        const SizedBox(height: 10),
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'E-mail')),
        const SizedBox(height: 10),
        TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone (optional)', hintText: '+92 300 1234567')),
        const SizedBox(height: 10),
        if (role == 'PATIENT') ...[
          DropdownButtonFormField<String>(
            initialValue: gender,
            decoration: const InputDecoration(labelText: 'Gender'),
            items: const [DropdownMenuItem(value: 'FEMALE', child: Text('Female')), DropdownMenuItem(value: 'MALE', child: Text('Male')), DropdownMenuItem(value: 'OTHER', child: Text('Other'))],
            onChanged: (v) => setState(() => gender = v!),
          ),
          const SizedBox(height: 10),
        ] else ...[
          DropdownButtonFormField<String>(
            initialValue: speciality,
            decoration: const InputDecoration(labelText: 'Speciality'),
            items: ['Pulmonology', 'Chest Specialist', 'General Physician', 'Radiology', 'Internal Medicine', 'Paediatrics'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => speciality = v!),
          ),
          const SizedBox(height: 10),
          TextField(controller: pmdc, decoration: const InputDecoration(labelText: 'PMDC number')),
          const SizedBox(height: 10),
          TextField(controller: qualification, decoration: const InputDecoration(labelText: 'Qualification', hintText: 'MBBS, FCPS')),
          const SizedBox(height: 10),
          TextField(controller: hospital, decoration: const InputDecoration(labelText: 'Hospital or clinic')),
          const SizedBox(height: 10),
          TextField(controller: fee, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Consultation fee (Rs)')),
          const SizedBox(height: 10),
        ],
        TextField(controller: city, decoration: const InputDecoration(labelText: 'City')),
        const SizedBox(height: 10),
        _pwField(password, 'Password'),
        const SizedBox(height: 10),
        _pwField(confirm, 'Confirm password'),
        const SizedBox(height: 10),
        _strength(password.text),
        CheckboxListTile(
          value: agree,
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          onChanged: (v) => setState(() => agree = v ?? false),
          title: Text('I understand PredictDx is a decision-support tool and agree to my data being processed for my care.', style: TextStyle(fontSize: 12, color: C.ink2)),
        ),
        if (role == 'DOCTOR') ...[
          const Notice('After you verify your e-mail, an administrator checks your PMDC licence before you can sign in. You can upload the licence from the website.'),
          const SizedBox(height: 12),
        ],
        GradientButton(
          label: 'Create ${role == 'DOCTOR' ? 'doctor' : 'patient'} account',
          busy: busy,
          onPressed: () {
            if (name.text.trim().length < 3) return setState(() => error = 'Enter your full name');
            if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email.text.trim())) return setState(() => error = 'Enter a valid e-mail address');
            if (!_pwOk) return setState(() => error = 'Password does not meet every rule');
            if (password.text != confirm.text) return setState(() => error = 'Passwords do not match');
            if (!agree) return setState(() => error = 'Please accept to continue');
            final body = <String, dynamic>{
              'role': role,
              'fullName': name.text.trim(),
              'email': email.text.trim().toLowerCase(),
              'password': password.text,
              'city': city.text.trim(),
              if (phone.text.trim().isNotEmpty) 'phone': phone.text.trim(),
              if (role == 'PATIENT') 'gender': gender,
              if (role == 'DOCTOR') ...{
                'specialization': speciality,
                'pmdcNumber': pmdc.text.trim(),
                'qualification': qualification.text.trim(),
                'hospital': hospital.text.trim(),
                'fee': int.tryParse(fee.text) ?? 0,
              },
            };
            _run(() async => _after(await auth.register(body)));
          },
        ),
        const SizedBox(height: 4),
        _switchLine('Already have an account?', 'Sign in', _Step.signin),
      ];

  List<Widget> _otp() => [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(color: C.soft(C.brand), borderRadius: BorderRadius.circular(16)),
          child: Icon(step == _Step.mfa && mfaMethod == 'TOTP' ? Icons.phone_android : Icons.mail_outline, color: C.brand),
        ),
        const SizedBox(height: 14),
        Text(step == _Step.verify ? 'Verify your e-mail' : 'Two-step verification', style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(
          step == _Step.mfa && mfaMethod == 'TOTP' ? 'Enter the 6-digit code from your authenticator app.' : 'We sent a 6-digit code to $masked. It expires in 5 minutes.',
          style: TextStyle(color: C.muted),
        ),
        const SizedBox(height: 18),
        OtpBoxes(
          enabled: !busy,
          onComplete: (code) => _run(() async {
            _after(step == _Step.verify ? await auth.verifyEmail(email.text.trim().toLowerCase(), code) : await auth.verifyMfa(mfaToken, code));
          }),
        ),
        const SizedBox(height: 10),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          TextButton(onPressed: () => setState(() => step = _Step.signin), child: const Text('‹ Back')),
          if (!(step == _Step.mfa && mfaMethod == 'TOTP'))
            TextButton(
              onPressed: cooldown > 0 || busy
                  ? null
                  : () => _run(() async {
                        _showCode(step == _Step.verify ? await auth.resend('VERIFY_EMAIL', email: email.text.trim().toLowerCase()) : await auth.resend('LOGIN_MFA', mfaToken: mfaToken));
                        _startCooldown();
                      }),
              child: Text(cooldown > 0 ? 'Resend in ${cooldown}s' : 'Resend code'),
            ),
        ]),
        const SizedBox(height: 8),
        const Notice('Never share this code. PredictDx staff will never ask for it.', icon: Icons.shield_outlined),
      ];

  List<Widget> _forgot() => [
        const Text('Reset your password', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text('Enter your account e-mail and we will send a reset code.', style: TextStyle(color: C.muted)),
        const SizedBox(height: 16),
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'E-mail address')),
        const SizedBox(height: 16),
        GradientButton(
          label: 'Send reset code',
          busy: busy,
          onPressed: () => _run(() async {
            _showCode(await auth.forgot(email.text.trim().toLowerCase()));
            _startCooldown();
            setState(() => step = _Step.reset);
          }),
        ),
        TextButton(onPressed: () => setState(() => step = _Step.signin), child: const Text('‹ Back to sign in')),
      ];

  List<Widget> _reset() => [
        const Text('Choose a new password', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        _pwField(newPw, 'New password'),
        const SizedBox(height: 10),
        _strength(newPw.text),
        const SizedBox(height: 16),
        Text('RESET CODE', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        OtpBoxes(
          enabled: !busy,
          onComplete: (code) {
            if (!_pwRules.every((r) => r.$1.hasMatch(newPw.text))) return setState(() => error = 'Password does not meet every rule');
            _run(() async {
              await auth.reset(email.text.trim().toLowerCase(), code, newPw.text);
              if (mounted) toast(context, 'Password changed. Sign in with your new password.');
              setState(() => step = _Step.signin);
            });
          },
        ),
      ];

  List<Widget> _pending() => [
        Icon(Icons.verified_outlined, color: C.ok, size: 40),
        const SizedBox(height: 12),
        const Text('E-mail verified', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text('Your PMDC licence is now with an administrator. You will get an e-mail as soon as your doctor account is approved.', style: TextStyle(color: C.muted)),
        const SizedBox(height: 18),
        GhostButton(label: 'Back to sign in', onPressed: () => setState(() => step = _Step.signin)),
      ];
}
