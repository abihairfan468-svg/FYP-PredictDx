import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const _filters = [('All roles', <String, String>{}), ('Patients', {'role': 'PATIENT'}), ('Doctors', {'role': 'DOCTOR'}), ('Blocked', {'status': 'BLOCKED'})];

String _readable(String action) {
  final parts = action.split('.');
  final what = parts.skip(1).join(' ').replaceAll('_', ' ');
  return '${parts.first[0].toUpperCase()}${parts.first.substring(1)}${what.isEmpty ? '' : ': $what'}';
}

/// System management - licence verification, user access and the audit trail.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});
  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  Map<String, dynamic>? ov;
  List users = [], audit = [];
  int filter = 0;
  String q = '';
  Timer? _t;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _loadAll();
    _sub = realtime.on('notification').listen((_) => _loadAll());
  }

  @override
  void dispose() {
    _sub?.cancel();
    _t?.cancel();
    super.dispose();
  }

  Future<void> _loadAll() async {
    try {
      final r = await Future.wait([api.get('/admin/overview'), api.get('/admin/audit', query: {'take': '14'})]);
      if (mounted) setState(() {
        ov = Map<String, dynamic>.from(r[0]);
        audit = r[1] as List;
      });
    } catch (_) {}
    await _loadUsers();
  }

  Future<void> _loadUsers() async {
    try {
      final l = await api.get('/admin/users', query: {..._filters[filter].$2, if (q.isNotEmpty) 'q': q}) as List;
      if (mounted) setState(() => users = l);
    } catch (_) {}
  }

  Future<void> _decide(Map d, bool approve) async {
    String? reason;
    if (!approve) {
      final c = TextEditingController();
      reason = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Reject ${d['name']}?'),
          content: TextField(controller: c, maxLines: 3, decoration: const InputDecoration(hintText: 'Reason sent to the doctor, e.g. licence number does not match the PMDC register')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Back')),
            TextButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: Text('Reject', style: TextStyle(color: C.crit))),
          ],
        ),
      );
      if (reason == null) return;
    }
    try {
      await api.post('/admin/doctors/${d['doctorId']}/decision', {'approve': approve, if (reason != null && reason.isNotEmpty) 'reason': reason});
      if (mounted) toast(context, approve ? 'Doctor verified — patients can now book them' : 'Application rejected — the doctor has been e-mailed');
      _loadAll();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _toggle(Map u) async {
    final status = u['status'] == 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    try {
      await api.patch('/admin/users/${u['id']}/status', {'status': status});
      if (mounted) toast(context, status == 'BLOCKED' ? '${u['fullName']} blocked — signed out everywhere' : '${u['fullName']} can sign in again');
      _loadAll();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  void _licence(Map d) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${d['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          Text('PMDC ${d['pmdcNumber']} · ${d['qualification']} · ${d['hospital']}', style: TextStyle(color: C.muted, fontSize: 12.5)),
          const SizedBox(height: 14),
          if (d['licenceFileId'] == null)
            Notice('Licence file: ${d['licenceFile'] ?? 'not uploaded'}', icon: Icons.description_outlined)
          else
            FutureBuilder<List<int>>(
              future: api.bytes('/files/${d['licenceFileId']}'),
              builder: (_, s) {
                if (!s.hasData) return const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(color: C.brand)));
                final b = Uint8List.fromList(s.data!);
                final pdf = b.length > 4 && String.fromCharCodes(b.sublist(0, 4)) == '%PDF';
                if (pdf) return Notice('PDF licence · ${(b.length / 1024).round()} KB · open it on the website to read every page.', icon: Icons.picture_as_pdf_outlined);
                return ClipRRect(borderRadius: BorderRadius.circular(12), child: ConstrainedBox(constraints: const BoxConstraints(maxHeight: 420), child: Image.memory(b, fit: BoxFit.contain)));
              },
            ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: GradientButton(
                label: 'Approve',
                icon: Icons.verified_outlined,
                onPressed: () {
                  Navigator.pop(context);
                  _decide(d, true);
                },
              ),
            ),
            const SizedBox(width: 8),
            GhostButton(
              label: 'Reject',
              danger: true,
              onPressed: () {
                Navigator.pop(context);
                _decide(d, false);
              },
            ),
          ]),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final k = ov?['kpi'];
    final pending = (ov?['pending'] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: _loadAll,
      child: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        const Band(title: 'System management', sub: 'Verify doctors, manage access and review every sensitive action.', image: 'assets/img/card-process.jpg'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.55,
            children: [
              StatTile(label: 'Users', value: '${k?['users'] ?? '–'}', sub: 'Active accounts', icon: Icons.people_outline),
              StatTile(label: 'Doctors', value: '${k?['doctors'] ?? '–'}', sub: '${pending.length} awaiting check', icon: Icons.verified_user_outlined, tone: 'ok'),
              StatTile(label: 'Visits today', value: '${k?['apptsToday'] ?? '–'}', sub: 'All hospitals', icon: Icons.event, tone: 'warn'),
              StatTile(label: 'X-ray studies', value: '${k?['scans'] ?? '–'}', sub: 'Stored securely', icon: Icons.document_scanner_outlined, tone: 'lime'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('Licence verification', sub: 'PMDC check before a doctor can see patients', trailing: Pill('${pending.length} pending', tone: pending.isEmpty ? 'ok' : 'warn')),
            if (pending.isEmpty) const EmptyState(icon: Icons.verified_outlined, title: 'Queue is clear', sub: 'New doctor sign-ups appear here instantly.'),
            ...pending.map((d) => Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Row(children: [
                    Avatar(d['name'], size: 40),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(d['name'], style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text('${d['specialization']} · PMDC ${d['pmdcNumber']}', style: TextStyle(color: C.muted, fontSize: 12)),
                        Text('Waiting ${ago(d['waitingSince'])}', style: TextStyle(color: C.muted, fontSize: 11)),
                      ]),
                    ),
                    GradientButton(label: 'Review', small: true, onPressed: () => _licence(d)),
                  ]),
                )),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('Users & access', sub: '${users.length} shown'),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(hintText: 'Search name or email', prefixIcon: Icon(Icons.search, size: 20)),
              onChanged: (v) {
                _t?.cancel();
                _t = Timer(const Duration(milliseconds: 300), () {
                  q = v.trim();
                  _loadUsers();
                });
              },
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: _filters.asMap().entries.map((e) => Pill(e.value.$1, on: filter == e.key, onTap: () {
                    setState(() => filter = e.key);
                    _loadUsers();
                  })).toList(),
            ),
            ...users.map((u) {
              final me = u['id'] == auth.user!.id;
              final blocked = u['status'] == 'BLOCKED';
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Avatar(u['fullName'], size: 38, online: u['online'] == true, variant: u['role'] == 'DOCTOR' ? 1 : 0),
                title: Text(u['fullName'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                subtitle: Text('${u['email']}\n${(u['role'] as String).toLowerCase()} · ${u['lastLoginAt'] != null ? 'seen ${ago(u['lastLoginAt'])}' : 'never signed in'}',
                    style: TextStyle(color: C.muted, fontSize: 11.5)),
                isThreeLine: true,
                trailing: me
                    ? const Pill('You')
                    : Pill(blocked ? 'Unblock' : 'Block', tone: blocked ? 'ok' : 'crit', onTap: () => _toggle(u)),
              );
            }),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SectionTitle('Audit trail', sub: 'Every sensitive action, who did it and when'),
            const SizedBox(height: 6),
            ...audit.map((a) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Padding(padding: EdgeInsets.only(top: 5), child: Icon(Icons.circle, size: 7, color: C.brand)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(_readable(a['action']), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                        Text(
                          '${a['actor']?['fullName'] ?? 'System'}${a['detail'] != null ? ' · ${(a['detail'] as String).replaceAll(' (preview model)', '')}' : ''}',
                          style: TextStyle(color: C.muted, fontSize: 11.5),
                        ),
                      ]),
                    ),
                    Text(ago(a['createdAt']), style: TextStyle(color: C.muted, fontSize: 10.5)),
                  ]),
                )),
          ]),
        ),
      ]),
    );
  }
}
