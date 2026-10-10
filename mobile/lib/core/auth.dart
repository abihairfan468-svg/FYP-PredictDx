import 'package:flutter/foundation.dart';

import 'api.dart';

/// Result of a sign-in step: either signed in, or the next screen to show.
class AuthStep {
  AuthStep(this.status, {this.email, this.maskedEmail, this.mfaToken, this.method, this.devCode});
  final String status; // OK | VERIFY_EMAIL | MFA_REQUIRED | PENDING_APPROVAL
  final String? email;
  final String? maskedEmail;
  final String? mfaToken;
  final String? method;
  final String? devCode;
}

class AppUser {
  AppUser(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'];
  String get fullName => raw['fullName'];
  String get email => raw['email'];
  String get role => raw['role'];
  bool get mfaEnabled => raw['mfaEnabled'] == true;
  bool get mfaMandatory => raw['mfaMandatory'] == true;
  Map<String, dynamic>? get patient => raw['patient'];
  Map<String, dynamic>? get doctor => raw['doctor'];
  String get firstName => fullName.replaceFirst(RegExp(r'^Dr\.?\s+'), '').split(' ').first;
  String get subtitle => patient?['mrn'] ?? (doctor != null ? '${doctor!['specialization']} · PMDC ${doctor!['pmdcNumber']}' : 'System administrator');
}

/// Signed-in state for the whole app.
class Auth extends ChangeNotifier {
  Auth._() {
    api.onSessionLost = () {
      user = null;
      notifyListeners();
    };
  }
  static final Auth instance = Auth._();

  AppUser? user;
  bool ready = false;

  /// Silent sign-in with the refresh token kept in secure storage.
  Future<void> restore() async {
    final s = await api.refresh();
    if (s != null) user = AppUser(Map<String, dynamic>.from(s['user']));
    ready = true;
    notifyListeners();
  }

  Future<AuthStep> _handle(dynamic res) async {
    final m = Map<String, dynamic>.from(res as Map);
    if (m['status'] == 'OK') {
      api.accessToken = m['accessToken'];
      await api.saveRefreshToken(m['refreshToken']);
      user = AppUser(Map<String, dynamic>.from(m['user']));
      notifyListeners();
    }
    return AuthStep(m['status'], email: m['email'], maskedEmail: m['maskedEmail'], mfaToken: m['mfaToken'], method: m['method'], devCode: m['devCode']);
  }

  Future<AuthStep> login(String email, String password, String role) async =>
      _handle(await api.post('/auth/login', {'email': email.trim().toLowerCase(), 'password': password, 'role': role}));

  Future<AuthStep> register(Map<String, dynamic> body) async => _handle(await api.post('/auth/register', body));

  Future<AuthStep> verifyEmail(String email, String code) async => _handle(await api.post('/auth/verify-email', {'email': email, 'code': code}));

  Future<AuthStep> verifyMfa(String mfaToken, String code) async => _handle(await api.post('/auth/mfa/verify', {'mfaToken': mfaToken, 'code': code}));

  Future<String?> resend(String purpose, {String? email, String? mfaToken}) async {
    final r = await api.post('/auth/otp/resend', {'purpose': purpose, if (email != null) 'email': email, if (mfaToken != null) 'mfaToken': mfaToken});
    return (r as Map)['devCode'] as String?;
  }

  Future<String?> forgot(String email) async => ((await api.post('/auth/password/forgot', {'email': email})) as Map)['devCode'] as String?;

  Future<void> reset(String email, String code, String password) => api.post('/auth/password/reset', {'email': email, 'code': code, 'newPassword': password});

  Future<void> reloadMe() async {
    user = AppUser(Map<String, dynamic>.from(await api.get('/auth/me')));
    notifyListeners();
  }

  void setUser(Map<String, dynamic> raw) {
    user = AppUser(raw);
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      // ends this device's session on the server too
      await api.post('/auth/logout', {'refreshToken': await api.storedRefreshToken()});
    } catch (_) {}
    api.accessToken = null;
    await api.saveRefreshToken(null);
    user = null;
    notifyListeners();
  }
}

final auth = Auth.instance;
