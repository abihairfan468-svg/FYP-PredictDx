import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'account_screen.dart';
import 'admin_screen.dart';
import 'careconnect_screen.dart';
import 'diagnosis_screen.dart';
import 'portal_screen.dart';
import 'records_screen.dart';
import 'workspace_screen.dart';

class _Tab {
  const _Tab(this.label, this.icon, this.screen);
  final String label;
  final IconData icon;
  final Widget screen;
}

/// Signed-in frame: bottom navigation for the user's role, notifications, live connection.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int index = 0;
  List<Map<String, dynamic>> notifs = [];
  StreamSubscription? _sub;

  List<_Tab> get tabs => switch (auth.user!.role) {
        'DOCTOR' => const [
            _Tab('Workspace', Icons.medical_services_outlined, WorkspaceScreen()),
            _Tab('Diagnosis', Icons.document_scanner_outlined, DiagnosisScreen()),
            _Tab('Chat', Icons.chat_bubble_outline, CareConnectScreen()),
            _Tab('Records', Icons.description_outlined, RecordsScreen()),
            _Tab('Account', Icons.lock_outline, AccountScreen()),
          ],
        'ADMIN' => const [
            _Tab('Manage', Icons.shield_outlined, AdminScreen()),
            _Tab('Diagnosis', Icons.document_scanner_outlined, DiagnosisScreen()),
            _Tab('Records', Icons.description_outlined, RecordsScreen()),
            _Tab('Account', Icons.lock_outline, AccountScreen()),
          ],
        _ => const [
            _Tab('Home', Icons.home_outlined, PortalScreen()),
            _Tab('Records', Icons.description_outlined, RecordsScreen()),
            _Tab('Chat', Icons.chat_bubble_outline, CareConnectScreen()),
            _Tab('Account', Icons.lock_outline, AccountScreen()),
          ],
      };

  @override
  void initState() {
    super.initState();
    realtime.connect();
    _loadNotifs();
    _sub = realtime.on('notification').listen((n) {
      setState(() => notifs.insert(0, Map<String, dynamic>.from(n)));
      if (mounted) toast(context, '${n['title']} — ${n['body']}');
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    realtime.disconnect();
    super.dispose();
  }

  Future<void> _loadNotifs() async {
    try {
      final l = await api.get('/notifications') as List;
      if (mounted) setState(() => notifs = l.map((e) => Map<String, dynamic>.from(e)).toList());
    } catch (_) {}
  }

  int get unread => notifs.where((n) => n['readAt'] == null).length;

  void _openNotifications() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheet) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: .6,
        builder: (_, scroll) => Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 6),
            child: Row(children: [
              const Expanded(child: Text('Notifications', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
              TextButton(
                onPressed: unread == 0
                    ? null
                    : () async {
                        await api.post('/notifications/read-all');
                        setState(() => notifs = notifs.map((n) => {...n, 'readAt': n['readAt'] ?? DateTime.now().toIso8601String()}).toList());
                        if (sheet.mounted) Navigator.pop(sheet);
                      },
                child: const Text('Mark all read'),
              ),
            ]),
          ),
          Expanded(
            child: notifs.isEmpty
                ? const EmptyState(icon: Icons.notifications_none, title: 'You are all caught up')
                : ListView.separated(
                    controller: scroll,
                    itemCount: notifs.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final n = notifs[i];
                      return Opacity(
                        opacity: n['readAt'] == null ? 1 : .6,
                        child: ListTile(
                          leading: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(color: C.soft(C.brand), borderRadius: BorderRadius.circular(10)),
                            child: const Icon(Icons.notifications_outlined, color: C.brand, size: 18),
                          ),
                          title: Text(n['title'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                          subtitle: Text(n['body'], style: TextStyle(color: C.muted, fontSize: 12)),
                          trailing: Text(ago(n['createdAt']), style: TextStyle(color: C.muted, fontSize: 11)),
                          onTap: () {
                            if (n['readAt'] == null) {
                              api.patch('/notifications/${n['id']}/read').catchError((_) => null);
                              setState(() => n['readAt'] = DateTime.now().toIso8601String());
                            }
                          },
                        ),
                      );
                    },
                  ),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = tabs;
    final u = auth.user!;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: C.brand, borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.ac_unit, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('PredictDx', style: TextStyle(color: C.title, fontWeight: FontWeight.w800, fontSize: 17)),
            Text(u.role == 'DOCTOR' ? 'Doctor workspace' : u.role == 'ADMIN' ? 'Admin console' : 'Patient portal',
                style: TextStyle(color: C.muted, fontSize: 11.5, fontWeight: FontWeight.w500)),
          ]),
        ]),
        actions: [
          const ThemeToggleButton(),
          IconButton(
            onPressed: _openNotifications,
            icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), backgroundColor: C.brand, child: const Icon(Icons.notifications_none)),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: IndexedStack(index: index, children: t.map((e) => e.screen).toList()),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
        destinations: t.map((e) => NavigationDestination(icon: Icon(e.icon), label: e.label)).toList(),
      ),
    );
  }
}
