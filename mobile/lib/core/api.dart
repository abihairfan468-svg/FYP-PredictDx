import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'config.dart';

/// Error with the API's human-readable message.
class ApiException implements Exception {
  ApiException(this.message, [this.status = 0]);
  final String message;
  final int status;
  @override
  String toString() => message;
}

/// HTTP client for the PredictDx API.
///
/// - Sends `X-Client: mobile`, so the API returns the refresh token in the body.
/// - Keeps the refresh token in the phone's encrypted secure storage, the access token in memory.
/// - On a 401 it refreshes once, transparently, and retries the request.
class Api {
  Api._() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.api,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'X-Client': 'mobile'},
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (accessToken != null) options.headers['Authorization'] = 'Bearer $accessToken';
        handler.next(options);
      },
      onError: (e, handler) async {
        final path = e.requestOptions.path;
        final retried = e.requestOptions.extra['retried'] == true;
        if (e.response?.statusCode == 401 && !retried && !path.startsWith('/auth/')) {
          if (await refresh() != null) {
            final opts = e.requestOptions..extra['retried'] = true;
            opts.headers['Authorization'] = 'Bearer $accessToken';
            try {
              return handler.resolve(await _dio.fetch(opts));
            } on DioException catch (err) {
              return handler.next(err);
            }
          }
          onSessionLost?.call();
        }
        handler.next(e);
      },
    ));
  }

  static final Api instance = Api._();
  late final Dio _dio;
  final _storage = const FlutterSecureStorage();
  static const _key = 'pdx_refresh_token';

  String? accessToken;
  void Function()? onSessionLost;
  Future<Map<String, dynamic>?>? _refreshing;

  // Browsers only allow encrypted storage on https:// or localhost. Opened over plain http on the
  // local Wi-Fi (e.g. http://192.168.x.x:5174) it throws, so the token is then kept in memory only.
  String? _memoryToken;
  bool _secureStorageOk = true;

  Future<String?> storedRefreshToken() async {
    if (!_secureStorageOk) return _memoryToken;
    try {
      return await _storage.read(key: _key);
    } catch (_) {
      _secureStorageOk = false;
      return _memoryToken;
    }
  }

  Future<void> saveRefreshToken(String? token) async {
    _memoryToken = token;
    if (!_secureStorageOk) return;
    try {
      if (token == null) {
        await _storage.delete(key: _key);
      } else {
        await _storage.write(key: _key, value: token);
      }
    } catch (_) {
      _secureStorageOk = false;
    }
  }

  /// Trades the stored refresh token for a new session (rotates the token).
  Future<Map<String, dynamic>?> refresh() {
    return _refreshing ??= () async {
      try {
        final token = await storedRefreshToken();
        if (token == null) return null;
        final res = await _dio.post('/auth/refresh', data: {'refreshToken': token});
        final data = Map<String, dynamic>.from(res.data as Map);
        accessToken = data['accessToken'] as String?;
        await saveRefreshToken(data['refreshToken'] as String?);
        return data;
      } catch (_) {
        accessToken = null;
        await saveRefreshToken(null);
        return null;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _call(() => _dio.get(path, queryParameters: query));
  Future<dynamic> post(String path, [Object? body]) => _call(() => _dio.post(path, data: body ?? {}));
  Future<dynamic> put(String path, [Object? body]) => _call(() => _dio.put(path, data: body ?? {}));
  Future<dynamic> patch(String path, [Object? body]) => _call(() => _dio.patch(path, data: body ?? {}));
  Future<dynamic> delete(String path) => _call(() => _dio.delete(path));

  /// Raw bytes, e.g. an X-ray image.
  Future<List<int>> bytes(String path) async {
    final res = await _call(() => _dio.get<List<int>>(path, options: Options(responseType: ResponseType.bytes)));
    return res as List<int>;
  }

  Future<dynamic> _call(Future<Response> Function() fn) async {
    try {
      final res = await fn();
      return res.data;
    } on DioException catch (e) {
      final data = e.response?.data;
      var msg = 'Cannot reach the PredictDx server. Check your connection.';
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        msg = m is List ? m.first.toString() : m.toString();
      } else if (e.response != null) {
        msg = 'Request failed (${e.response!.statusCode})';
      }
      throw ApiException(msg, e.response?.statusCode ?? 0);
    }
  }
}

final api = Api.instance;
