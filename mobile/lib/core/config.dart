import 'package:flutter/foundation.dart';

/// Where the PredictDx API lives.
///
/// Override at build/run time:
///   flutter run --dart-define=API_URL=http://192.168.1.20:3000
/// Defaults: the same machine for web builds, 10.0.2.2 (the host PC) for the Android emulator.
class AppConfig {
  static const _fromBuild = String.fromEnvironment('API_URL');

  static String get apiUrl {
    if (_fromBuild.isNotEmpty) return _fromBuild;
    if (kIsWeb) return '${Uri.base.scheme}://${Uri.base.host}:3000';
    return 'http://10.0.2.2:3000';
  }

  static String get api => '$apiUrl/api/v1';
}
