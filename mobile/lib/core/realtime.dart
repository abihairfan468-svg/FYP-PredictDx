import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api.dart';
import 'config.dart';

/// One authenticated Socket.IO connection: chat, typing, read receipts, notifications,
/// appointment updates and X-ray analysis progress - the same channel the website uses.
class Realtime {
  Realtime._();
  static final Realtime instance = Realtime._();

  io.Socket? _socket;
  final _events = StreamController<(String, dynamic)>.broadcast();
  final online = <String>{};

  bool get connected => _socket?.connected ?? false;

  /// Listen to one server event, e.g. `on('message:new')`.
  Stream<dynamic> on(String event) => _events.stream.where((e) => e.$1 == event).map((e) => e.$2);

  void connect() {
    disconnect();
    final s = io.io(
      AppConfig.apiUrl,
      io.OptionBuilder().setTransports(['websocket']).disableAutoConnect().setAuthFn((cb) => cb({'token': api.accessToken})).build(),
    );
    for (final ev in ['message:new', 'typing', 'thread:read', 'notification', 'appointment:update', 'study:progress', 'study:done', 'study:failed', 'study:rejected']) {
      s.on(ev, (data) => _events.add((ev, data)));
    }
    s.on('ready', (data) {
      online
        ..clear()
        ..addAll(List<String>.from((data as Map)['onlineUserIds'] ?? []));
      _events.add(('presence', null));
    });
    s.on('presence', (data) {
      final m = data as Map;
      if (m['online'] == true) {
        online.add(m['userId']);
      } else {
        online.remove(m['userId']);
      }
      _events.add(('presence', m));
    });
    s.on('auth_error', (_) async {
      if (await api.refresh() != null) s.connect();
    });
    s.connect();
    _socket = s;
  }

  void emit(String event, Map<String, dynamic> data) => _socket?.emit(event, data);

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    online.clear();
  }
}

final realtime = Realtime.instance;
