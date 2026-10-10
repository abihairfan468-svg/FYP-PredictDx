import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'careconnect_screen.dart';

const _status = {'CONFIRMED': ('Booked', ''), 'CHECKED_IN': ('Checked in', 'ok'), 'IN_CONSULTATION': ('Now', 'brand'), 'COMPLETED': ('Done', 'lime')};
const _next = {'CONFIRMED': ('CHECKED_IN', 'Check in'), 'CHECKED_IN': ('IN_CONSULTATION', 'Call patient in'), 'IN_CONSULTATION': ('COMPLETED', 'Complete visit')};
String _iso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

/// Doctor workspace - today's queue.
class WorkspaceScreen extends StatefulWidget {
  const WorkspaceScreen({super.key});
  @override
  State<WorkspaceScreen> createState() => _WorkspaceScreenState();
}

class _WorkspaceScreenState extends State<WorkspaceScreen> {
  DateTime date = DateTime.now();
  Map<String, dynamic>? day;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _load();
    _sub = realtime.on('appointment:update').listen((_) => _load());
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await api.get('/workspace/day', query: {'date': _iso(date)});
      if (mounted) setState(() => day = Map<String, dynamic>.from(d));
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  void _shift(int n) {
    setState(() {
      date = date.add(Duration(days: n));
      day = null;
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final doc = day?['doctor'];
    final st = day?['stats'];
    final list = (day?['appointments'] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        Band(
          title: 'Doctor workspace',
          sub: doc != null ? '${doc['name']} · ${doc['specialization']} · PMDC ${doc['pmdcNumber']}' : 'Consultations, AI insight and digital prescriptions',
          image: 'assets/img/card-results.jpg',
        ),
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
              StatTile(label: 'Appointments', value: '${st?['total'] ?? '–'}', sub: st == null ? null : '${st['done']} done · ${st['remaining']} left', icon: Icons.event),
              StatTile(label: 'AI results', value: '${st?['aiResults'] ?? '–'}', sub: 'From Diagnosis', icon: Icons.document_scanner_outlined),
              StatTile(label: 'Rx in draft', value: '${st?['draftPrescriptions'] ?? '–'}', sub: 'Sign to send', icon: Icons.medication_outlined, tone: 'warn'),
              StatTile(label: 'Upcoming', value: '${st?['upcomingConfirmed'] ?? '–'}', sub: 'Confirmed & paid', icon: Icons.schedule, tone: 'ok'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              IconButton(onPressed: () => _shift(-1), icon: const Icon(Icons.chevron_left)),
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: date, firstDate: DateTime(2024), lastDate: DateTime(2030));
                    if (d != null) {
                      date = d;
                      _load();
                    }
                  },
                  child: Column(children: [
                    Text(fmtDay(date.toIso8601String()), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    Text('${list.length} appointments', style: TextStyle(color: C.muted, fontSize: 12)),
                  ]),
                ),
              ),
              IconButton(onPressed: () => _shift(1), icon: const Icon(Icons.chevron_right)),
            ]),
            if (day == null) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator(color: C.brand))),
            if (day != null && list.isEmpty) const EmptyState(icon: Icons.event_busy, title: 'No appointments', sub: 'Paid bookings appear here in real time.'),
            ...list.map((x) {
              final s = _status[x['status']] ?? ('', '');
              final p = x['patient'];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                onTap: () async {
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => VisitScreen(id: x['id'])));
                  _load();
                },
                leading: SizedBox(width: 58, child: Text(fmtTime(x['startAt']), style: const TextStyle(color: C.brand, fontWeight: FontWeight.w800, fontSize: 12))),
                title: Text(p['name'], style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('${p['age'] ?? '–'} ${(p['gender'] as String?)?.substring(0, 1) ?? ''} · ${x['reason'] ?? 'Consultation'}', style: TextStyle(color: C.muted, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: Pill(s.$1, tone: s.$2),
              );
            }),
          ]),
        ),
      ]),
    );
  }
}

/// One visit: status, vitals, notes, AI insight, history and the digital prescription.
class VisitScreen extends StatefulWidget {
  const VisitScreen({super.key, required this.id});
  final String id;
  @override
  State<VisitScreen> createState() => _VisitScreenState();
}

class _VisitScreenState extends State<VisitScreen> {
  Map<String, dynamic>? d;
  final vitals = <String, TextEditingController>{for (final k in ['bp', 'spo2', 'temp', 'weight']) k: TextEditingController()};
  final notes = TextEditingController();
  final testOrder = TextEditingController();
  DateTime? followUp;
  List<Map<String, dynamic>> items = [];
  List warnings = [];
  String? code;
  bool signed = false, saving = false, busy = false;
  String? savedAt;
  Timer? _debounce;
  String _snapshot = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final r = Map<String, dynamic>.from(await api.get('/workspace/appointments/${widget.id}'));
    final c = r['consultation'];
    final rx = r['prescription'];
    setState(() {
      d = r;
      for (final k in vitals.keys) {
        vitals[k]!.text = c?['vitals']?[k]?.toString() ?? '';
      }
      notes.text = c?['notes'] ?? '';
      testOrder.text = c?['testOrder'] ?? '';
      followUp = c?['followUpAt'] == null ? null : DateTime.parse(c['followUpAt']).toLocal();
      items = ((rx?['items'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e)).toList();
      code = rx?['code'];
      signed = rx?['status'] == 'SIGNED';
      _snapshot = _current();
    });
    if (items.isNotEmpty && !signed) _saveItems(items);
  }

  String _current() => jsonEncode({
        'vitals': {for (final e in vitals.entries) e.key: e.value.text},
        'notes': notes.text,
        'testOrder': testOrder.text,
        'followUpAt': followUp?.toUtc().toIso8601String(),
      });

  /// Autosave 700 ms after the doctor stops typing.
  void _changed() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 700), () async {
      final now = _current();
      if (now == _snapshot) return;
      _snapshot = now;
      setState(() => saving = true);
      try {
        final r = await api.put('/workspace/appointments/${widget.id}/consultation', jsonDecode(now));
        if (mounted) setState(() => savedAt = fmtTime(r['savedAt']));
      } on ApiException catch (e) {
        if (mounted) toast(context, e.message, error: true);
      } finally {
        if (mounted) setState(() => saving = false);
      }
    });
  }

  Future<void> _saveItems(List<Map<String, dynamic>> next) async {
    setState(() => items = next);
    try {
      final r = await api.put('/workspace/appointments/${widget.id}/prescription', {'items': next}) as Map;
      if (mounted) setState(() {
        warnings = r['warnings'];
        code = r['code'];
      });
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _setStatus(String status) async {
    try {
      await api.patch('/workspace/appointments/${widget.id}/status', {'status': status});
      if (mounted) {
        toast(context, status == 'IN_CONSULTATION' ? '${d!['patient']['name']} has been called in' : status == 'COMPLETED' ? 'Visit completed' : 'Patient checked in');
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _sign() async {
    setState(() => busy = true);
    try {
      final r = await api.post('/workspace/appointments/${widget.id}/prescription/sign') as Map;
      if (mounted) toast(context, '${r['code']} signed and sent to ${d!['patient']['name']}');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (d == null) return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator(color: C.brand)));
    final p = d!['patient'];
    final next = _next[d!['status']];
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(p['name']),
          bottom: TabBar(
            indicatorColor: C.brand,
            labelColor: C.brand,
            unselectedLabelColor: C.muted,
            tabs: [Tab(text: 'Visit'), Tab(text: 'AI insight'), Tab(text: 'Prescription')],
          ),
        ),
        body: TabBarView(children: [_visitTab(p, next), _aiTab(), _rxTab()]),
      ),
    );
  }

  Widget _visitTab(Map p, (String, String)? next) {
    Color? warnColor(String k, String v) =>
        (k == 'spo2' && (int.tryParse(v) ?? 100) < 95) || (k == 'temp' && (double.tryParse(v) ?? 0) > 37.5) ? C.warn : null;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Avatar(p['name'], size: 48),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${p['name']}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            Text('${p['mrn']} · ${p['age'] ?? '–'} yrs · ${(p['gender'] as String?)?.toLowerCase() ?? '–'}', style: TextStyle(color: C.muted, fontSize: 12)),
            Text('${d!['reason'] ?? 'Consultation'} · ${fmtTime(d!['startAt'])} · ${d!['paid'] == true ? 'Fee paid' : 'Unpaid'}', style: TextStyle(color: C.muted, fontSize: 12)),
          ]),
        ),
      ]),
      if ((p['flags'] as List).isNotEmpty) ...[
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: (p['flags'] as List).map((f) => Pill(f, tone: RegExp('TB|allergy', caseSensitive: false).hasMatch(f) ? 'crit' : RegExp('smok|diab', caseSensitive: false).hasMatch(f) ? 'warn' : 'ok')).toList(),
        ),
      ],
      const SizedBox(height: 14),
      Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        if (next != null) GradientButton(label: next.$2, small: true, icon: Icons.medical_services_outlined, onPressed: () => _setStatus(next.$1)),
        if (d!['status'] == 'COMPLETED') const Pill('Visit completed', tone: 'lime', icon: Icons.check),
        GhostButton(label: 'Message patient', icon: Icons.chat_bubble_outline, onPressed: () => openChatWith(context, p['userId'])),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: Text('VITALS', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2))),
        Pill(saving ? 'Saving…' : savedAt != null ? 'Auto-saved $savedAt' : 'Auto-save on'),
      ]),
      const SizedBox(height: 8),
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 2.6,
        children: [('bp', 'Blood pressure'), ('spo2', 'SpO₂ %'), ('temp', 'Temperature °C'), ('weight', 'Weight kg')]
            .map((v) => StatefulBuilder(
                  builder: (_, set) => TextField(
                    controller: vitals[v.$1],
                    style: TextStyle(fontWeight: FontWeight.w800, color: warnColor(v.$1, vitals[v.$1]!.text)),
                    decoration: InputDecoration(labelText: v.$2),
                    onChanged: (_) {
                      set(() {});
                      _changed();
                    },
                  ),
                ))
            .toList(),
      ),
      const SizedBox(height: 14),
      TextField(
        controller: notes,
        minLines: 6,
        maxLines: 14,
        maxLength: 5000,
        onChanged: (_) => _changed(),
        decoration: const InputDecoration(labelText: 'Consultation note', hintText: 'History, examination, impression, plan…', alignLabelWithHint: true),
      ),
      Text('Signed together with the prescription as a consultation summary record.', style: TextStyle(color: C.muted, fontSize: 11.5)),
      const SizedBox(height: 18),
      Text('HISTORY', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
      ...(d!['history'] as List).map((h) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Visit · ${fmtDate(h['startAt'])}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            subtitle: Text((h['notes'] as String?)?.isNotEmpty == true ? h['notes'] : 'No note recorded.', style: TextStyle(color: C.muted, fontSize: 12)),
          )),
      ...(d!['records'] as List).map((r) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(r['title'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            subtitle: Text('${r['source']} · ${fmtDate(r['createdAt'])}', style: TextStyle(color: C.muted, fontSize: 12)),
            trailing: Pill(r['kind']),
          )),
      if ((d!['history'] as List).isEmpty && (d!['records'] as List).isEmpty) const EmptyState(icon: Icons.history, title: 'First visit', sub: 'No earlier visits or records.'),
    ]);
  }

  Widget _aiTab() {
    final ins = d!['aiInsight'];
    final ai = ins?['result'];
    if (ai == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Column(children: [
          EmptyState(icon: Icons.document_scanner_outlined, title: 'No analysed X-ray yet', sub: 'Upload one in the Diagnosis tab and the result appears here.'),
        ]),
      );
    }
    final conf = (ai['confidence'] as num).toDouble();
    final tone = ai['label'] == 'Normal' ? 'ok' : conf >= 70 ? 'crit' : 'warn';
    final band = ai['risk']['band'] as String;
    return ListView(padding: const EdgeInsets.all(16), children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          height: 220,
          child: Stack(fit: StackFit.expand, children: [
            Image.asset('assets/img/xray-chest.jpg', fit: BoxFit.cover),
            if (ai['label'] != 'Normal')
              const DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: Alignment(-.32, -.32), radius: .7, colors: [Color(0xBFFF461E), Color(0x4DFFA000), Colors.transparent], stops: [0, .5, 1]))),
          ]),
        ),
      ),
      const SizedBox(height: 14),
      Row(children: [
        Text(ai['label'], style: display(24, color: C.ink)),
        const SizedBox(width: 10),
        Pill('$band risk', tone: band == 'High' ? 'crit' : band == 'Moderate' ? 'warn' : 'ok'),
      ]),
      const SizedBox(height: 12),
      Row(children: [Expanded(child: Text('Model confidence', style: TextStyle(color: C.ink2, fontSize: 12))), Text('${conf.round()}%', style: TextStyle(fontWeight: FontWeight.w800))]),
      const SizedBox(height: 6),
      Meter(conf / 100, color: C.tone(tone)),
      const SizedBox(height: 12),
      Wrap(spacing: 6, runSpacing: 6, children: (ai['probabilities'] as Map).entries.map((e) => Pill('${e.key} ${e.value}%')).toList()),
      const SizedBox(height: 10),
      Text('${ins['code']} · ${fmtDate(ins['createdAt'])} · AI assisted', style: TextStyle(color: C.muted, fontSize: 11.5)),
      const SizedBox(height: 14),
      GhostButton(
        label: d!['consultation']?['aiDisagree'] == true ? 'Disagreement logged' : 'Disagree with AI',
        icon: Icons.thumb_down_alt_outlined,
        onPressed: d!['consultation']?['aiDisagree'] == true
            ? null
            : () async {
                await api.post('/workspace/appointments/${widget.id}/ai-disagree');
                if (mounted) toast(context, 'Your disagreement has been recorded for review');
                _load();
              },
      ),
    ]);
  }

  Widget _rxTab() {
    final major = warnings.any((w) => w['severity'] == 'major');
    return ListView(padding: const EdgeInsets.all(16), children: [
      SectionTitle('Digital prescription', sub: code ?? 'New', trailing: Pill(signed ? 'Signed' : 'Draft', tone: signed ? 'ok' : 'warn')),
      const SizedBox(height: 12),
      if (items.isEmpty) Padding(padding: EdgeInsets.all(14), child: Center(child: Text('No medicines on this prescription yet.', style: TextStyle(color: C.muted, fontSize: 12.5)))),
      ...items.asMap().entries.map((e) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            decoration: BoxDecoration(border: Border.all(color: C.line), borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(e.value['name'], style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  Text(e.value['frequency'], style: TextStyle(color: C.muted, fontSize: 12)),
                ]),
              ),
              Pill(e.value['dose'], on: true),
              if (!signed) IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => _saveItems([...items]..removeAt(e.key))),
            ]),
          )),
      if (!signed)
        GhostButton(
          label: 'Add medicine',
          icon: Icons.add,
          onPressed: () async {
            final m = await showModalBottomSheet<Map<String, dynamic>>(context: context, isScrollControlled: true, builder: (_) => const _MedicinePicker());
            if (m != null) {
              _saveItems([...items, m]);
              if (mounted) toast(context, '${m['name']} added');
            }
          },
        ),
      const SizedBox(height: 12),
      if (items.isNotEmpty && warnings.isEmpty) const Notice('Interaction check passed — no conflicts with this record.', tone: 'ok', icon: Icons.check_circle_outline),
      ...warnings.map((w) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Notice('${(w['severity'] as String).toUpperCase()} · ${w['message']}', tone: w['severity'] == 'major' ? 'crit' : w['severity'] == 'moderate' ? 'warn' : 'brand', icon: Icons.warning_amber_rounded),
          )),
      const SizedBox(height: 12),
      TextField(controller: testOrder, enabled: !signed, onChanged: (_) => _changed(), decoration: const InputDecoration(labelText: 'Diagnostic test', hintText: 'e.g. Sputum smear × 2 · urgent', prefixIcon: Icon(Icons.biotech_outlined, size: 20))),
      const SizedBox(height: 10),
      InkWell(
        onTap: signed
            ? null
            : () async {
                final dd = await showDatePicker(context: context, initialDate: followUp ?? DateTime.now().add(const Duration(days: 14)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                if (dd == null || !mounted) return;
                final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
                setState(() => followUp = DateTime(dd.year, dd.month, dd.day, t?.hour ?? 10, t?.minute ?? 0));
                _changed();
              },
        child: InputDecorator(
          decoration: const InputDecoration(labelText: 'Follow-up', prefixIcon: Icon(Icons.event, size: 20)),
          child: Text(followUp == null ? 'Not set' : fmtWhen(followUp!.toIso8601String())),
        ),
      ),
      const SizedBox(height: 16),
      GradientButton(
        label: signed ? 'Sent to patient' : major ? 'Sign despite warning & send' : 'Sign & send to patient',
        icon: Icons.check,
        busy: busy,
        onPressed: signed || items.isEmpty ? null : _sign,
      ),
      const SizedBox(height: 10),
      Text('Signing files the prescription and consultation summary into the patient\'s records and notifies them instantly.', textAlign: TextAlign.center, style: TextStyle(color: C.muted, fontSize: 11.5, height: 1.5)),
    ]);
  }
}

class _MedicinePicker extends StatefulWidget {
  const _MedicinePicker();
  @override
  State<_MedicinePicker> createState() => _MedicinePickerState();
}

class _MedicinePickerState extends State<_MedicinePicker> {
  List list = [];
  Timer? _t;
  final name = TextEditingController(), dose = TextEditingController(), freq = TextEditingController();

  @override
  void initState() {
    super.initState();
    _search('');
  }

  Future<void> _search(String q) async {
    final l = await api.get('/workspace/medicines', query: {'q': q}) as List;
    if (mounted) setState(() => list = l);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 18, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * .75,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Add a medicine', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          TextField(
            autofocus: true,
            decoration: const InputDecoration(hintText: 'Search medicine or class, e.g. rifampicin', prefixIcon: Icon(Icons.search, size: 20)),
            onChanged: (v) {
              _t?.cancel();
              _t = Timer(const Duration(milliseconds: 250), () => _search(v));
            },
          ),
          Expanded(
            child: ListView(children: [
              ...list.map((m) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(m['name'], style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${m['group']} · ${m['frequency']}', style: TextStyle(color: C.muted, fontSize: 12)),
                    trailing: Pill(m['dose'], on: true),
                    onTap: () => Navigator.pop(context, {'name': m['name'], 'dose': m['dose'], 'frequency': m['frequency']}),
                  )),
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text('Not in the list? Add a custom medicine', style: TextStyle(fontSize: 13, color: C.ink2)),
                children: [
                  TextField(controller: name, decoration: const InputDecoration(hintText: 'Name')),
                  const SizedBox(height: 8),
                  TextField(controller: dose, decoration: const InputDecoration(hintText: 'Dose')),
                  const SizedBox(height: 8),
                  TextField(controller: freq, decoration: const InputDecoration(hintText: 'Frequency')),
                  const SizedBox(height: 10),
                  GradientButton(
                    label: 'Add',
                    onPressed: () {
                      if (name.text.trim().isEmpty || dose.text.trim().isEmpty || freq.text.trim().isEmpty) return;
                      Navigator.pop(context, {'name': name.text.trim(), 'dose': dose.text.trim(), 'frequency': freq.text.trim()});
                    },
                  ),
                ],
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
