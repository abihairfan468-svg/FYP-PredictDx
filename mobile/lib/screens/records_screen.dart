import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const _kinds = ['All', 'Consultation', 'Prescription', 'Lab', 'Imaging', 'AI report'];

IconData _iconFor(String kind) => switch (kind) {
      'AI report' || 'Imaging' => Icons.document_scanner_outlined,
      'Prescription' => Icons.medication_outlined,
      'Lab' => Icons.science_outlined,
      _ => Icons.description_outlined,
    };

/// Reports & care records - the patient's (or treated patients') signed documents.
class RecordsScreen extends StatefulWidget {
  const RecordsScreen({super.key});
  @override
  State<RecordsScreen> createState() => _RecordsScreenState();
}

class _RecordsScreenState extends State<RecordsScreen> {
  List all = [];
  bool loading = true;
  String kind = 'All', q = '';
  StreamSubscription? _sub;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
    _sub = realtime.on('notification').listen((_) => _load());
  }

  Future<void> _load() async {
    try {
      final l = await api.get('/records') as List;
      if (mounted) setState(() => all = l);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final patient = auth.user!.role == 'PATIENT';
    final list = all.where((r) {
      final hay = '${r['title']} ${r['source']} ${r['kind']} ${r['patient']['user']['fullName']}'.toLowerCase();
      return (kind == 'All' || r['kind'] == kind) && (q.isEmpty || hay.contains(q.toLowerCase()));
    }).toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        Band(title: 'Reports & records', sub: patient ? 'Every signed report, prescription and scan in one place.' : 'Records of patients under your care.', image: 'assets/img/card-results.jpg'),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: TextField(
            decoration: const InputDecoration(hintText: 'Search records', prefixIcon: Icon(Icons.search, size: 20)),
            onChanged: (v) => setState(() => q = v.trim()),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: _kinds.map((k) => Padding(padding: const EdgeInsets.only(right: 6), child: Pill(k == 'All' ? 'All types' : k, on: kind == k, onTap: () => setState(() => kind = k)))).toList()),
        ),
        const SizedBox(height: 12),
        Panel(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: loading
              ? const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: C.brand)))
              : list.isEmpty
                  ? const EmptyState(icon: Icons.folder_open, title: 'No records yet', sub: 'Reports appear here as soon as they are signed.')
                  : Column(
                      children: list.map((r) {
                        final ai = r['kind'] == 'AI report';
                        return ListTile(
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => RecordDetail(record: Map<String, dynamic>.from(r)))),
                          leading: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(color: C.soft(ai ? C.lime : C.brand), borderRadius: BorderRadius.circular(11)),
                            child: Icon(_iconFor(r['kind']), size: 18, color: ai ? C.lime : C.brand),
                          ),
                          title: Text(r['title'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5), maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text('${patient ? r['source'] : r['patient']['user']['fullName']} · ${fmtDate(r['createdAt'])}', style: TextStyle(color: C.muted, fontSize: 11.5)),
                          trailing: Pill(r['kind']),
                        );
                      }).toList(),
                    ),
        ),
      ]),
    );
  }
}

class RecordDetail extends StatefulWidget {
  const RecordDetail({super.key, required this.record});
  final Map<String, dynamic> record;
  @override
  State<RecordDetail> createState() => _RecordDetailState();
}

class _RecordDetailState extends State<RecordDetail> {
  @override
  void initState() {
    super.initState();
    // the server writes this read to the audit trail
    api.get('/records/${widget.record['id']}').catchError((_) => null);
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.record;
    final version = r['version'] as int? ?? 1;
    return Scaffold(
      appBar: AppBar(title: const Text('Record')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r['title'], style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('${r['kind']} · ${r['source']} · ${fmtDate(r['createdAt'])}', style: TextStyle(color: C.muted, fontSize: 12.5)),
              Text('${r['patient']['user']['fullName']} · ${r['patient']['mrn']}', style: TextStyle(color: C.muted, fontSize: 12.5)),
            ]),
          ),
          Pill(r['signed'] == true ? 'Signed' : 'Draft', tone: r['signed'] == true ? 'ok' : 'warn'),
        ]),
        if (r['kind'] == 'AI report') ...[
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              height: 170,
              child: Stack(fit: StackFit.expand, children: [
                Image.asset('assets/img/xray-chest.jpg', fit: BoxFit.cover),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(center: Alignment(-.34, -.3), radius: .6, colors: [Color(0xB3FF461E), Color(0x47FFA000), Colors.transparent], stops: [0, .5, 1]),
                  ),
                ),
              ]),
            ),
          ),
        ],
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: C.surface2, borderRadius: BorderRadius.circular(14), border: Border.all(color: C.line)),
          child: SelectableText((r['body'] as String?)?.isNotEmpty == true ? r['body'] : 'Signed clinical document.', style: TextStyle(color: C.ink2, fontSize: 13, height: 1.6)),
        ),
        const SizedBox(height: 12),
        GhostButton(
          label: 'Copy text',
          icon: Icons.copy,
          onPressed: () {
            Clipboard.setData(ClipboardData(text: '${r['title']}\n${r['kind']} · ${r['source']} · ${fmtDate(r['createdAt'])}\n\n${r['body']}'));
            toast(context, 'Copied to clipboard');
          },
        ),
        const SizedBox(height: 12),
        const Notice('Every view of this record is logged for your privacy.', tone: 'ok', icon: Icons.lock_outline),
        const SizedBox(height: 16),
        Text('VERSION HISTORY', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
        const SizedBox(height: 6),
        ...List.generate(version, (i) => version - i).map((n) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                Text('v$n', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: n == version ? C.brand : C.muted)),
                const SizedBox(width: 10),
                Text(n == version ? (version > 1 ? 'Addendum · confirmed' : 'Original signed document') : 'Earlier revision kept for audit', style: TextStyle(color: C.ink2, fontSize: 12)),
              ]),
            )),
      ]),
    );
  }
}
