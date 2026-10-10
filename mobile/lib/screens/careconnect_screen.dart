import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const _prompts = ['When is my next appointment?', 'Do I have anything to pay?', 'What is on my prescription?', 'What does my risk band mean?', 'Can I stop my medicine early?'];

/// Opens (or creates) the conversation with [userId] and shows it.
Future<void> openChatWith(BuildContext context, String userId) async {
  try {
    final t = Map<String, dynamic>.from(await api.post('/chat/threads', {'userId': userId}));
    if (context.mounted) await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatScreen(thread: t)));
  } on ApiException catch (e) {
    if (context.mounted) toast(context, e.message, error: true);
  }
}

/// CareConnect hub - conversations with doctors / patients and CareBot.
class CareConnectScreen extends StatefulWidget {
  const CareConnectScreen({super.key});
  @override
  State<CareConnectScreen> createState() => _CareConnectScreenState();
}

class _CareConnectScreenState extends State<CareConnectScreen> {
  List threads = [];
  bool loading = true;
  String filter = '';
  final typing = <String, String>{};
  final _subs = <StreamSubscription>[];

  @override
  void initState() {
    super.initState();
    _load();
    _subs
      ..add(realtime.on('message:new').listen((_) => _load()))
      ..add(realtime.on('presence').listen((_) => setState(() {})))
      ..add(realtime.on('typing').listen((p) => setState(() {
            if (p['typing'] == true) {
              typing[p['threadId']] = p['name'];
            } else {
              typing.remove(p['threadId']);
            }
          })));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final l = await api.get('/chat/threads') as List;
      if (mounted) setState(() => threads = l);
    } catch (_) {
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _newChat() async {
    final contacts = await api.get('/chat/contacts') as List;
    if (!mounted) return;
    final c = await showModalBottomSheet<Map>(
      context: context,
      builder: (_) => ListView(shrinkWrap: true, padding: const EdgeInsets.symmetric(vertical: 16), children: [
        const Padding(padding: EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text('New conversation', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
        if (contacts.isEmpty) const EmptyState(icon: Icons.person_search, title: 'No contacts yet', sub: 'You can message doctors you have booked with.'),
        ...contacts.map((x) => ListTile(
              leading: Avatar(x['name'], size: 38, online: x['online'] == true),
              title: Text(x['name'], style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(x['subtitle'], style: TextStyle(color: C.muted, fontSize: 12)),
              onTap: () => Navigator.pop(context, x),
            )),
      ]),
    );
    if (c != null && mounted) {
      await openChatWith(context, c['userId']);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final shown = threads.where((t) => filter.isEmpty || '${t['other']['name']} ${t['lastMessage']?['body'] ?? ''}'.toLowerCase().contains(filter.toLowerCase())).toList();
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: _newChat,
        backgroundColor: C.brand,
        foregroundColor: Colors.white,
        child: const Icon(Icons.edit_outlined),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.only(bottom: 90), children: [
          const Band(title: 'CareConnect hub', sub: 'Message your care team and get instant answers from CareBot.', image: 'assets/img/doctors-review.jpg'),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(decoration: const InputDecoration(hintText: 'Search conversations', prefixIcon: Icon(Icons.search, size: 20)), onChanged: (v) => setState(() => filter = v.trim())),
          ),
          Panel(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: loading
                ? const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: C.brand)))
                : shown.isEmpty
                    ? const EmptyState(icon: Icons.forum_outlined, title: 'No conversations', sub: 'Tap the pencil to start one.')
                    : Column(
                        children: shown.map((t) {
                          final bot = t['kind'] == 'BOT';
                          final unread = t['unread'] as int? ?? 0;
                          final last = t['lastMessage'];
                          final who = typing[t['id']];
                          return ListTile(
                            onTap: () async {
                              await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatScreen(thread: Map<String, dynamic>.from(t))));
                              _load();
                            },
                            leading: bot
                                ? Container(width: 42, height: 42, decoration: BoxDecoration(shape: BoxShape.circle, color: C.soft(C.lime)), child: Icon(Icons.smart_toy_outlined, color: C.lime))
                                : Avatar(t['other']['name'], online: realtime.online.contains(t['other']['userId'])),
                            title: Text(t['other']['name'], style: TextStyle(fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w700, fontSize: 14)),
                            subtitle: Text(
                              who != null ? 'typing…' : (last?['body'] ?? t['other']['subtitle']),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: who != null ? C.brand : C.muted, fontSize: 12),
                            ),
                            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                              if (last != null) Text(ago(last['createdAt']), style: TextStyle(color: C.muted, fontSize: 10.5)),
                              if (unread > 0) ...[
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(color: C.brand, borderRadius: BorderRadius.circular(99)),
                                  child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                                ),
                              ],
                            ]),
                          );
                        }).toList(),
                      ),
          ),
        ]),
      ),
    );
  }
}

/// One conversation, live.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.thread});
  final Map<String, dynamic> thread;
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  List<Map<String, dynamic>> msgs = [];
  bool loading = true;
  String? typingName;
  String? otherReadAt;
  final text = TextEditingController();
  final scroll = ScrollController();
  final _subs = <StreamSubscription>[];
  DateTime _typingSent = DateTime(2000);

  String get id => widget.thread['id'];
  bool get bot => widget.thread['kind'] == 'BOT';

  @override
  void initState() {
    super.initState();
    otherReadAt = widget.thread['otherLastReadAt'];
    _load();
    _subs
      ..add(realtime.on('message:new').listen((p) {
        if (p['threadId'] != id) return;
        final m = Map<String, dynamic>.from(p['message']);
        if (msgs.any((x) => x['id'] == m['id'])) return;
        setState(() {
          msgs.add(m);
          typingName = null;
        });
        if (m['senderId'] != auth.user!.id) api.post('/chat/threads/$id/read').catchError((_) => null);
        _toBottom();
      }))
      ..add(realtime.on('typing').listen((p) {
        if (p['threadId'] == id) setState(() => typingName = p['typing'] == true ? p['name'] : null);
      }))
      ..add(realtime.on('thread:read').listen((p) {
        if (p['threadId'] == id) setState(() => otherReadAt = p['at']);
      }))
      ..add(realtime.on('presence').listen((_) => setState(() {})));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    realtime.emit('typing', {'threadId': id, 'typing': false});
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final l = await api.get('/chat/threads/$id/messages') as List;
      if (mounted) setState(() => msgs = l.map((e) => Map<String, dynamic>.from(e)).toList());
      api.post('/chat/threads/$id/read').catchError((_) => null);
    } finally {
      if (mounted) setState(() => loading = false);
      _toBottom();
    }
  }

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (scroll.hasClients) scroll.animateTo(scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      });

  Future<void> _send(String body) async {
    if (body.trim().isEmpty) return;
    text.clear();
    realtime.emit('typing', {'threadId': id, 'typing': false});
    try {
      final m = Map<String, dynamic>.from(await api.post('/chat/threads/$id/messages', {'body': body.trim()}));
      if (!msgs.any((x) => x['id'] == m['id'])) setState(() => msgs.add(m));
      _toBottom();
    } on ApiException catch (e) {
      text.text = body;
      if (mounted) toast(context, e.message, error: true);
    }
  }

  void _onType(String _) {
    if (bot || DateTime.now().difference(_typingSent).inMilliseconds < 1500) return;
    _typingSent = DateTime.now();
    realtime.emit('typing', {'threadId': id, 'typing': true});
    Timer(const Duration(milliseconds: 2500), () => realtime.emit('typing', {'threadId': id, 'typing': false}));
  }

  @override
  Widget build(BuildContext context) {
    final other = widget.thread['other'];
    final me = auth.user!.id;
    final online = bot || realtime.online.contains(other['userId']);
    final lastMine = msgs.lastWhere((m) => m['senderId'] == me, orElse: () => {});
    final seen = lastMine.isNotEmpty && otherReadAt != null && DateTime.parse(otherReadAt!).isAfter(DateTime.parse(lastMine['createdAt']).subtract(const Duration(milliseconds: 1)));
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(children: [
          bot
              ? Container(width: 36, height: 36, decoration: BoxDecoration(shape: BoxShape.circle, color: C.soft(C.lime)), child: Icon(Icons.smart_toy_outlined, size: 19, color: C.lime))
              : Avatar(other['name'], size: 36, online: online),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(other['name'], style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800), overflow: TextOverflow.ellipsis),
              Text(
                typingName != null ? 'typing…' : bot ? 'Answers instantly · not medical advice' : (online ? 'Online' : other['subtitle']),
                style: TextStyle(fontSize: 11, color: typingName != null || online ? C.ok : C.muted, fontWeight: FontWeight.w600),
              ),
            ]),
          ),
        ]),
      ),
      body: Column(children: [
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator(color: C.brand))
              : ListView.builder(
                  controller: scroll,
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  itemCount: msgs.length + (typingName != null ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i == msgs.length) return _bubble(false, '•••', null, muted: true);
                    final m = msgs[i];
                    final mine = m['senderId'] == me;
                    final newDay = i == 0 || fmtDay(msgs[i - 1]['createdAt']) != fmtDay(m['createdAt']);
                    return Column(children: [
                      if (newDay)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Text(fmtDay(m['createdAt']), style: TextStyle(color: C.muted, fontSize: 11, fontWeight: FontWeight.w700)),
                        ),
                      _bubble(mine, m['body'], '${fmtTime(m['createdAt'])}${mine && identical(m, lastMine) ? (seen ? ' · Seen' : ' · Sent') : ''}'),
                    ]);
                  },
                ),
        ),
        if (bot && auth.user!.role == 'PATIENT')
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: _prompts.map((p) => Padding(padding: const EdgeInsets.only(right: 6), child: Pill(p, icon: Icons.bolt, onTap: () => _send(p)))).toList(),
            ),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 8, 10),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: text,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onChanged: _onType,
                  onSubmitted: _send,
                  decoration: InputDecoration(hintText: bot ? 'Ask CareBot…' : 'Write a message…'),
                ),
              ),
              const SizedBox(width: 6),
              IconButton.filled(
                onPressed: () => _send(text.text),
                style: IconButton.styleFrom(backgroundColor: C.brand, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
                icon: const Icon(Icons.send_rounded, size: 20),
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _bubble(bool mine, String body, String? meta, {bool muted = false}) => Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .78),
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.fromLTRB(13, 10, 13, 8),
          decoration: BoxDecoration(
            color: mine ? C.brand : C.surface,
            border: mine ? null : Border.all(color: C.line),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(body, style: TextStyle(color: mine ? Colors.white : (muted ? C.muted : C.ink), fontSize: 14, height: 1.45, fontWeight: FontWeight.w500)),
            ),
            if (meta != null) ...[
              const SizedBox(height: 3),
              Text(meta, style: TextStyle(color: mine ? Color(0xCCFFFFFF) : C.muted, fontSize: 10.5)),
            ],
          ]),
        ),
      );
}
