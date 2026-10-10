import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart' show FormData, MultipartFile;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const labels = {'NORMAL': 'Normal', 'PNEUMONIA': 'Pneumonia', 'TUBERCULOSIS': 'Tuberculosis', 'OTHER': 'Other finding'};
String bandTone(String b) => b == 'High' ? 'crit' : b == 'Moderate' ? 'warn' : 'ok';

/// Smart diagnostic center - chest X-ray studies, upload and AI analysis.
class DiagnosisScreen extends StatefulWidget {
  const DiagnosisScreen({super.key});
  @override
  State<DiagnosisScreen> createState() => _DiagnosisScreenState();
}

class _DiagnosisScreenState extends State<DiagnosisScreen> {
  List studies = [];
  List patients = [];
  String? patientId;
  bool loading = true, uploading = false;
  final _subs = <StreamSubscription>[];

  bool get doctor => auth.user!.role == 'DOCTOR';

  @override
  void initState() {
    super.initState();
    _load();
    if (doctor) {
      api.get('/workspace/patients').then((l) {
        if (mounted) setState(() {
          patients = l as List;
          patientId = patients.isEmpty ? null : patients.first['id'];
        });
      });
    }
    for (final ev in ['study:done', 'study:failed', 'study:rejected']) {
      _subs.add(realtime.on(ev).listen((_) => _load()));
    }
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
      final l = await api.get('/diagnosis/studies') as List;
      if (mounted) setState(() => studies = l);
    } catch (_) {
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _upload(ImageSource source) async {
    if (patientId == null) return toast(context, 'Pick a patient first', error: true);
    final x = await ImagePicker().pickImage(source: source, maxWidth: 3000);
    if (x == null) return;
    final bytes = await x.readAsBytes();
    if (bytes.length > 20 * 1024 * 1024) {
      if (mounted) toast(context, 'That file is over 20 MB', error: true);
      return;
    }
    setState(() => uploading = true);
    try {
      final r = await api.post(
        '/diagnosis/studies',
        FormData.fromMap({'patientId': patientId, 'view': 'PA', 'file': MultipartFile.fromBytes(bytes, filename: x.name.isEmpty ? 'xray.jpg' : x.name)}),
      ) as Map;
      if (mounted) toast(context, 'Study ${r['code']} uploaded — run the AI analysis');
      await _load();
      final s = studies.firstWhere((e) => e['id'] == r['id'], orElse: () => null);
      if (s != null && mounted) _open(s);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> _open(Map s) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => StudyScreen(study: Map<String, dynamic>.from(s))));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        const Band(title: 'Smart diagnostic center', sub: 'Chest X-ray analysis with heatmaps, marked regions and a 12-month risk prediction.', image: 'assets/img/xray-chest.jpg'),
        if (doctor)
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SectionTitle('New study', sub: 'PNG, JPG or DICOM · up to 20 MB'),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey(patients.length),
                initialValue: patientId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Patient'),
                items: patients.map((p) => DropdownMenuItem<String>(value: p['id'], child: Text('${p['name']} · ${p['mrn']}', overflow: TextOverflow.ellipsis))).toList(),
                onChanged: (v) => setState(() => patientId = v),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: GradientButton(label: 'Choose X-ray', icon: Icons.upload_file, busy: uploading, onPressed: () => _upload(ImageSource.gallery))),
                const SizedBox(width: 8),
                GhostButton(label: 'Camera', icon: Icons.photo_camera_outlined, onPressed: uploading ? null : () => _upload(ImageSource.camera)),
              ]),
            ]),
          ),
        Panel(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('Studies queue', sub: '${studies.length} studies'),
            if (loading) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator(color: C.brand))),
            if (!loading && studies.isEmpty) const EmptyState(icon: Icons.document_scanner_outlined, title: 'No studies yet', sub: 'Upload a chest X-ray to begin.'),
            ...studies.map((s) {
              final analysed = s['status'] == 'ANALYSED';
              final gate = s['result']?['gatePassed'] == true;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                onTap: () => _open(s),
                leading: ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.asset('assets/img/xray-chest.jpg', width: 42, height: 42, fit: BoxFit.cover)),
                title: Text(s['code'], style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, letterSpacing: .3)),
                subtitle: Text('${s['patient']['name']} · ${s['view']} · ${fmtDate(s['createdAt'])}', style: TextStyle(color: C.muted, fontSize: 12)),
                trailing: Pill(
                  analysed ? (gate ? s['result']['label'] : 'Low confidence') : s['status'] == 'ANALYSING' ? 'Running' : 'New',
                  tone: analysed ? (gate ? 'lime' : 'warn') : s['status'] == 'ANALYSING' ? 'brand' : '',
                ),
              );
            }),
          ]),
        ),
      ]),
    );
  }
}

/// One study: the film with heatmap / boxes, live analysis progress and the AI result.
class StudyScreen extends StatefulWidget {
  const StudyScreen({super.key, required this.study});
  final Map<String, dynamic> study;
  @override
  State<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends State<StudyScreen> {
  late Map<String, dynamic> st = widget.study;
  Uint8List? img;
  bool heat = true, boxes = true, invert = false, acting = false;
  double op = .7;
  (int, List)? run;
  final issues = <int, String>{};
  final _subs = <StreamSubscription>[];

  String get id => st['id'];

  @override
  void initState() {
    super.initState();
    api.bytes('/diagnosis/studies/$id/image').then((b) {
      if (mounted) setState(() => img = Uint8List.fromList(b));
    }).catchError((_) {});
    _subs
      ..add(realtime.on('study:progress').listen((p) {
        if (p['id'] == id) setState(() => run = (p['step'] as int, p['steps'] as List));
      }))
      ..add(realtime.on('study:done').listen((p) {
        if (p['id'] != id || !mounted) return;
        setState(() => run = null);
        _reload();
        toast(context, 'Analysis complete — ${p['result']['label']} at ${p['result']['confidence']}%');
      }))
      ..add(realtime.on('study:failed').listen((p) {
        if (p['id'] != id || !mounted) return;
        setState(() => run = null);
        toast(context, p['message'] ?? 'Analysis failed', error: true);
        _reload();
      }))
      ..add(realtime.on('study:rejected').listen((p) {
        if (p['id'] != id || !mounted) return;
        setState(() => run = null);
        toast(context, 'Not a chest X-ray — ${p['reason']}', error: true);
        _reload();
      }));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    super.dispose();
  }

  Future<void> _reload() async {
    final l = await api.get('/diagnosis/studies') as List;
    final s = l.firstWhere((e) => e['id'] == id, orElse: () => null);
    if (s != null && mounted) setState(() => st = Map<String, dynamic>.from(s));
  }

  Future<void> _analyse() async {
    try {
      final r = await api.post('/diagnosis/studies/$id/analyse') as Map;
      setState(() {
        run = (0, r['steps'] as List);
        st['status'] = 'ANALYSING';
      });
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _confirm(String label) async {
    try {
      await api.patch('/diagnosis/studies/$id/label', {'label': label});
      setState(() => st['verifiedLabel'] = label);
      if (mounted) toast(context, 'Diagnosis confirmed: ${labels[label]}');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _act(String what) async {
    setState(() => acting = true);
    try {
      final accepted = issues.values.where((v) => v == 'accepted').length;
      final r = await api.post('/diagnosis/studies/$id/$what', what == 'report' ? {'acceptedFindings': accepted} : {}) as Map;
      if (mounted) toast(context, r['message']);
      _reload();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = st['result'];
    final done = st['status'] == 'ANALYSED' && r != null && r['isChestXray'] != false;
    final conf = done ? (r['confidence'] as num).toDouble() : 0.0;
    final tone = done ? (r['label'] == 'Normal' ? 'ok' : conf >= 70 ? 'crit' : 'warn') : 'ok';
    final probs = done ? ((r['probabilities'] as Map).entries.toList()..sort((a, b) => (b.value as num).compareTo(a.value as num))) : <MapEntry>[];
    final regions = done ? (r['regions'] as List) : [];
    return Scaffold(
      appBar: AppBar(title: Text(st['code'])),
      body: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        // ------------------------------------------------ viewer
        Container(
          color: Colors.black,
          child: AspectRatio(
            aspectRatio: 1,
            child: LayoutBuilder(builder: (_, box) {
              final w = box.maxWidth, h = box.maxHeight;
              return Stack(fit: StackFit.expand, children: [
                if (img != null)
                  ColorFiltered(
                    colorFilter: invert
                        ? const ColorFilter.matrix([-1, 0, 0, 0, 255, 0, -1, 0, 0, 255, 0, 0, -1, 0, 255, 0, 0, 0, 1, 0])
                        : const ColorFilter.mode(Colors.transparent, BlendMode.dst),
                    child: Image.memory(img!, fit: BoxFit.contain),
                  )
                else
                  const Center(child: CircularProgressIndicator(color: C.brand)),
                if (done && heat)
                  ...regions.map((g) => Positioned(
                        left: (g['x'] - g['w'] * .3) / 100 * w,
                        top: (g['y'] - g['h'] * .3) / 100 * h,
                        width: g['w'] * 1.6 / 100 * w,
                        height: g['h'] * 1.6 / 100 * h,
                        child: IgnorePointer(
                          child: Opacity(
                            opacity: op,
                            child: const DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: RadialGradient(colors: [Color(0xF2FF3A24), Color(0x8CFF9200), Color(0x2EFFE246), Colors.transparent], stops: [0, .38, .7, 1]),
                              ),
                            ),
                          ),
                        ),
                      )),
                if (done && boxes)
                  ...regions.map((g) => Positioned(
                        left: g['x'] / 100 * w,
                        top: g['y'] / 100 * h,
                        width: g['w'] / 100 * w,
                        height: g['h'] / 100 * h,
                        child: Container(
                          decoration: BoxDecoration(border: Border.all(color: const Color(0xFFFF6B4A), width: 1.5)),
                          alignment: Alignment.topLeft,
                          child: Container(
                            color: const Color(0xFFFF6B4A),
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            child: Text('${(g['label'] as String).toUpperCase()} · ${g['score']}', style: const TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w800)),
                          ),
                        ),
                      )),
                if (run != null)
                  Container(
                    color: const Color(0xC704070D),
                    padding: const EdgeInsets.all(30),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('ANALYSING ${st['code']}', style: const TextStyle(color: Color(0xFF3FD7EF), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
                      const SizedBox(height: 14),
                      ...run!.$2.asMap().entries.map((e) {
                        final i = e.key, step = run!.$1;
                        final c = i < step ? C.ok : i == step ? Color(0xFF3FD7EF) : Color(0xFF57708C);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(children: [
                            SizedBox(width: 18, child: Text(i < step ? '✓' : i == step ? '▸' : '·', style: TextStyle(color: c))),
                            Expanded(child: Text(e.value, style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w600))),
                          ]),
                        );
                      }),
                      const SizedBox(height: 8),
                      Meter((run!.$1 + 1) / run!.$2.length, color: const Color(0xFF3FD7EF)),
                    ]),
                  ),
                if (!done && run == null && st['status'] != 'ANALYSING')
                  Container(
                    color: const Color(0x5904070D),
                    alignment: Alignment.center,
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Text('STUDY LOADED · NOT YET ANALYSED', style: TextStyle(color: Color(0xFF9FB4D0), fontSize: 11, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      GradientButton(label: 'Run AI analysis', small: true, icon: Icons.auto_awesome, onPressed: _analyse),
                    ]),
                  ),
              ]);
            }),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
            Pill('Heatmap', on: heat, onTap: () => setState(() => heat = !heat)),
            Pill('Lesion boxes', on: boxes, onTap: () => setState(() => boxes = !boxes)),
            Pill('Invert', on: invert, onTap: () => setState(() => invert = !invert)),
          ]),
        ),
        if (done && heat)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              Text('Heat ${(op * 100).round()}%', style: TextStyle(color: C.muted, fontSize: 11.5)),
              Expanded(child: Slider(value: op, onChanged: (v) => setState(() => op = v), activeColor: C.brand)),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: Text('${st['patient']['name']} · ${st['view']} · ${st['originalName']} · ${fmtWhen(st['createdAt'])}', style: TextStyle(color: C.muted, fontSize: 11.5)),
        ),
        // ------------------------------------------------ AI analysis
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('AI analysis', trailing: Pill(done ? 'Completed' : 'Pending', tone: done ? 'ok' : 'warn')),
            const SizedBox(height: 12),
            const Notice('AI results support clinical judgement — a doctor reviews every finding before a report is released.', tone: 'warn', icon: Icons.warning_amber_rounded),
            if (!done)
              EmptyState(icon: Icons.document_scanner_outlined, title: 'Nothing to show yet', sub: st['status'] == 'ANALYSING' ? 'Analysis is running…' : 'Run the analysis to see probabilities, regions and the risk band.'),
            if (done) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: C.soft(C.tone(tone)), borderRadius: BorderRadius.circular(14), border: Border.all(color: C.tone(tone))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('PRIMARY FINDING', style: TextStyle(color: C.tone(tone), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                  const SizedBox(height: 3),
                  Text(r['label'], style: display(23, color: C.ink)),
                  const SizedBox(height: 4),
                  Text('${conf.round()}% confidence · ${r['gatePassed'] == true ? 'above' : 'below'} the 70% auto-report gate', style: TextStyle(color: C.ink2, fontSize: 12)),
                ]),
              ),
              if (r['gatePassed'] != true) ...[
                const SizedBox(height: 10),
                const Notice('Routed to radiologist review — no report is released on the model alone.', tone: 'warn', icon: Icons.warning_amber_rounded),
              ],
              const SizedBox(height: 16),
              Text('CLASS PROBABILITIES', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
              ...probs.asMap().entries.map((e) => Padding(
                    padding: const EdgeInsets.only(top: 9),
                    child: Column(children: [
                      Row(children: [
                        Expanded(child: Text(e.value.key, style: TextStyle(fontWeight: e.key == 0 ? FontWeight.w800 : FontWeight.w600, fontSize: 12.5))),
                        Text('${e.value.value}%', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                      ]),
                      const SizedBox(height: 5),
                      Meter((e.value.value as num) / 100, color: e.key == 0 ? C.tone(tone) : C.brand),
                    ]),
                  )),
              const SizedBox(height: 16),
              Text('DETECTED REGIONS', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
              if (regions.isEmpty) Padding(padding: EdgeInsets.only(top: 8), child: Text('No regions above the detection threshold.', style: TextStyle(color: C.muted, fontSize: 12))),
              ...regions.asMap().entries.map((e) => Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: issues[e.key] == 'accepted' ? C.ok : issues[e.key] == 'dismissed' ? C.muted : C.crit)),
                      const SizedBox(width: 8),
                      Expanded(child: Text('${e.value['label']}  ${e.value['score']}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600))),
                      if (issues[e.key] != null)
                        Pill(issues[e.key]!)
                      else ...[
                        Pill('Accept', tone: 'ok', onTap: () {
                          setState(() => issues[e.key] = 'accepted');
                          toast(context, 'Finding accepted into the report');
                        }),
                        const SizedBox(width: 6),
                        Pill('Dismiss', onTap: () {
                          setState(() => issues[e.key] = 'dismissed');
                          toast(context, 'Finding dismissed');
                        }),
                      ],
                    ]),
                  )),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: C.surface2, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
                child: Column(children: [
                  Row(children: [
                    Expanded(child: Text('${r['risk']['horizonMonths']}-month risk', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5))),
                    Pill('${r['risk']['band']} · ${r['risk']['score']}', tone: bandTone(r['risk']['band'])),
                  ]),
                  const SizedBox(height: 9),
                  Meter((r['risk']['score'] as num) / 100, color: C.tone(bandTone(r['risk']['band']))),
                ]),
              ),
              if (auth.user!.role == 'DOCTOR') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: C.surface2, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Expanded(child: Text("Doctor's confirmed diagnosis", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5))),
                      Pill(st['verifiedLabel'] != null ? 'Confirmed' : 'Pending', tone: st['verifiedLabel'] != null ? 'ok' : 'warn'),
                    ]),
                    const SizedBox(height: 9),
                    Wrap(spacing: 6, runSpacing: 6, children: labels.entries.map((e) => Pill(e.value, on: st['verifiedLabel'] == e.key, onTap: () => _confirm(e.key))).toList()),
                  ]),
                ),
                const SizedBox(height: 14),
                GradientButton(label: 'Generate diagnostic report', icon: Icons.description_outlined, busy: acting, onPressed: () => _act('report')),
                const SizedBox(height: 8),
                SizedBox(width: double.infinity, child: GhostButton(label: 'Send to radiologist', icon: Icons.send_outlined, onPressed: acting ? null : () => _act('refer'))),
              ],
            ],
          ]),
        ),
      ]),
    );
  }
}
