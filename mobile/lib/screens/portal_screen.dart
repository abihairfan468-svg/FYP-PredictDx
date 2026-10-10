import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'careconnect_screen.dart';

/// Opens Google Maps directions to the hospital, found by name + address (stored coordinates are approximate).
void openDirections(Map f) => launchUrl(
      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${Uri.encodeComponent('${f['name']}, ${f['address']}')}'),
      mode: LaunchMode.externalApplication,
    );

const _cityCentre = {'Islamabad': (33.6844, 73.0479), 'Rawalpindi': (33.5651, 73.0169), 'Lahore': (31.5204, 74.3587), 'Karachi': (24.8607, 67.0011)};
const _status = {
  'PENDING_PAYMENT': ('Awaiting payment', 'warn'),
  'CONFIRMED': ('Confirmed', 'ok'),
  'CHECKED_IN': ('Checked in', 'brand'),
  'IN_CONSULTATION': ('With doctor now', 'brand'),
  'COMPLETED': ('Completed', ''),
  'CANCELLED': ('Cancelled', 'crit'),
};

/// My Health Portal - find a specialist, book, pay, manage visits.
class PortalScreen extends StatefulWidget {
  const PortalScreen({super.key});
  @override
  State<PortalScreen> createState() => _PortalScreenState();
}

class _PortalScreenState extends State<PortalScreen> {
  Map<String, dynamic>? summary;
  List upcoming = [];
  List doctors = [];
  int total = 0;
  List<String> specialities = [];
  List<String> cities = [];
  String q = '', spec = 'All', city = 'All', sort = 'soonest';
  bool today = false, loading = true;
  (double, double, String)? here;
  Timer? _debounce;
  final _subs = <StreamSubscription>[];

  @override
  void initState() {
    super.initState();
    _loadAll();
    _subs.add(realtime.on('appointment:update').listen((_) => _loadAll()));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadAll() async {
    try {
      final r = await Future.wait([api.get('/portal/summary'), api.get('/appointments/mine'), api.get('/doctors/filters')]);
      if (!mounted) return;
      setState(() {
        summary = Map<String, dynamic>.from(r[0]);
        upcoming = (r[1] as Map)['upcoming'] as List;
        specialities = List<String>.from((r[2] as Map)['specializations']);
        cities = List<String>.from((r[2] as Map)['cities']);
      });
    } catch (_) {}
    await _loadDoctors();
  }

  Future<void> _loadDoctors() async {
    setState(() => loading = true);
    try {
      final r = await api.get('/doctors', query: {
        'sort': sort,
        if (q.isNotEmpty) 'q': q,
        if (spec != 'All') 'specialization': spec,
        if (city != 'All') 'city': city,
        if (today) 'availableToday': 'true',
        if (here != null) ...{'lat': '${here!.$1}', 'lng': '${here!.$2}'},
      }) as Map;
      if (mounted) setState(() {
        doctors = r['results'];
        total = r['total'];
      });
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _nearMe() async {
    if (here != null) {
      setState(() {
        here = null;
        sort = 'soonest';
      });
      return _loadDoctors();
    }
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) throw Exception();
      final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(timeLimit: Duration(seconds: 8)));
      here = (p.latitude, p.longitude, 'your location');
    } catch (_) {
      final c = auth.user?.patient?['city'] ?? 'Islamabad';
      final centre = _cityCentre[c] ?? _cityCentre['Islamabad']!;
      here = (centre.$1, centre.$2, '$c centre');
      if (mounted) toast(context, 'Location not shared — showing doctors nearest $c centre');
    }
    setState(() => sort = 'nearest');
    _loadDoctors();
  }

  @override
  Widget build(BuildContext context) {
    final s = summary;
    final next = s?['nextAppointment'];
    return RefreshIndicator(
      onRefresh: _loadAll,
      child: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        Band(title: 'My health portal', sub: 'Assalam o alaikum ${auth.user!.firstName} · ${auth.user!.patient?['mrn'] ?? ''}', image: 'assets/img/card-importance.jpg'),
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
              StatTile(label: 'Next visit', value: next != null ? fmtDay(next['startAt']) : 'None', sub: next != null ? '${fmtTime(next['startAt'])} · ${next['doctor']['name']}' : 'Book below', icon: Icons.event),
              StatTile(label: 'Reports', value: '${s?['newReports'] ?? '–'} new', sub: 'This week', icon: Icons.description_outlined),
              StatTile(label: 'Prescriptions', value: '${s?['activePrescriptions'] ?? '–'}', sub: 'Active', icon: Icons.medication_outlined, tone: 'ok'),
              StatTile(label: 'To pay', value: s == null ? '–' : rs(s['outstanding']), sub: (s?['outstanding'] ?? 0) > 0 ? 'Finish payment' : 'Nothing due', icon: Icons.account_balance_wallet_outlined, tone: (s?['outstanding'] ?? 0) > 0 ? 'warn' : 'ok'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('Upcoming appointments', trailing: Pill('${upcoming.length}')),
            if (upcoming.isEmpty) const EmptyState(icon: Icons.event_available, title: 'No upcoming visit', sub: 'Book a chest specialist below.'),
            ...upcoming.map((a) => _apptTile(Map<String, dynamic>.from(a))),
          ]),
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SectionTitle('Find a chest specialist', sub: '${doctors.length} of $total verified doctors'),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Search name, speciality, hospital or area', prefixIcon: Icon(Icons.search, size: 20)),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 300), () {
                  q = v.trim();
                  _loadDoctors();
                });
              },
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                Pill(here == null ? 'Near me' : 'Near ${here!.$3}', icon: Icons.near_me_outlined, on: here != null, onTap: _nearMe),
                const SizedBox(width: 6),
                Pill('Available today', on: today, onTap: () {
                  today = !today;
                  _loadDoctors();
                }),
                const SizedBox(width: 6),
                ...['All', ...cities].map((c) => Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: Pill(c == 'All' ? 'All cities' : c, on: city == c, onTap: () {
                        city = c;
                        _loadDoctors();
                      }),
                    )),
              ]),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                ...['All', ...specialities].map((sp) => Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: Pill(sp == 'All' ? 'All specialities' : sp, on: spec == sp, onTap: () {
                        spec = sp;
                        _loadDoctors();
                      }),
                    )),
              ]),
            ),
            const SizedBox(height: 6),
            Row(children: [
              Text('Sort:', style: TextStyle(color: C.muted, fontSize: 12)),
              const SizedBox(width: 6),
              DropdownButton<String>(
                value: sort,
                underline: const SizedBox.shrink(),
                style: const TextStyle(color: C.brand, fontWeight: FontWeight.w700, fontSize: 13),
                items: [
                  const DropdownMenuItem(value: 'soonest', child: Text('Soonest first')),
                  const DropdownMenuItem(value: 'fee', child: Text('Lowest fee')),
                  const DropdownMenuItem(value: 'rating', child: Text('Highest rated')),
                  if (here != null) const DropdownMenuItem(value: 'nearest', child: Text('Nearest first')),
                ],
                onChanged: (v) {
                  sort = v!;
                  _loadDoctors();
                },
              ),
            ]),
            if (loading) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator(color: C.brand))),
            if (!loading && doctors.isEmpty) const EmptyState(icon: Icons.search_off, title: 'No doctor matches', sub: 'Clear a filter to widen the search.'),
            if (!loading) ...doctors.map((d) => _doctorTile(Map<String, dynamic>.from(d))),
          ]),
        ),
      ]),
    );
  }

  Widget _apptTile(Map<String, dynamic> a) {
    final st = _status[a['status']] ?? ('', '');
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar(a['doctor']['name'], size: 40, variant: 1),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(a['doctor']['name'], style: const TextStyle(fontWeight: FontWeight.w800)),
              Text('${fmtWhen(a['startAt'])} · ${a['doctor']['room']}', style: TextStyle(color: C.muted, fontSize: 12)),
            ]),
          ),
          Pill(st.$1, tone: st.$2),
        ]),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (a['status'] == 'PENDING_PAYMENT') GradientButton(label: 'Pay now', small: true, onPressed: () => _pay(a)),
          if (a['status'] == 'CONFIRMED')
            GhostButton(label: 'Reschedule', onPressed: () => _book({'id': a['doctor']['id'], 'name': a['doctor']['name'], 'fee': a['doctor']['fee'], 'specialization': a['doctor']['specialization'], 'hospital': a['doctor']['hospital']}, reschedule: a)),
          if (['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].contains(a['status'])) GhostButton(label: 'Cancel', danger: true, onPressed: () => _cancel(a)),
          if (a['status'] != 'PENDING_PAYMENT') GhostButton(label: 'Message', icon: Icons.chat_bubble_outline, onPressed: () => openChatWith(context, a['doctor']['userId'])),
        ]),
      ]),
    );
  }

  Widget _doctorTile(Map<String, dynamic> d) {
    final f = d['facility'];
    return InkWell(
      onTap: d['nextSlot'] == null ? null : () => _book(d),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Avatar(d['name'], size: 46, variant: d['specialization'] == 'Radiology' ? 1 : 0, online: d['online'] == true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d['name'], style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
              Text('${d['specialization']} · ${d['qualification']}', style: TextStyle(color: C.ink2, fontSize: 12)),
              Text(f != null ? '${f['name']} · ${f['area']}, ${d['city']}' : '${d['hospital']} · ${d['city']}', style: TextStyle(color: C.muted, fontSize: 12)),
              const SizedBox(height: 3),
              Text('${d['schedule']}${d['distanceKm'] != null ? ' · ${d['distanceKm']} km away' : ''}', style: TextStyle(color: C.muted, fontSize: 11.5)),
              const SizedBox(height: 7),
              Wrap(spacing: 6, runSpacing: 6, children: [
                Pill('★ ${d['rating']} (${d['reviews']})'),
                Pill(rs(d['fee'])),
                Pill(d['nextSlot'] == null ? 'Fully booked' : '${d['nextSlot']['day']} ${d['nextSlot']['label']}', tone: d['availableToday'] == true ? 'ok' : ''),
              ]),
            ]),
          ),
          const SizedBox(width: 6),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            GradientButton(label: 'Book', small: true, onPressed: d['nextSlot'] == null ? null : () => _book(d)),
            if (f != null)
              TextButton.icon(
                onPressed: () => openDirections(f),
                icon: const Icon(Icons.directions, size: 16),
                label: const Text('Directions', style: TextStyle(fontSize: 12)),
              ),
          ]),
        ]),
      ),
    );
  }

  Future<void> _cancel(Map<String, dynamic> a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cancel this appointment?'),
        content: Text('${a['doctor']['name']} · ${fmtWhen(a['startAt'])}. The slot is released${a['payment']?['status'] == 'PAID' ? ' and your payment is refunded' : ''}.'),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text('Keep it')), TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Cancel appointment', style: TextStyle(color: C.crit)))],
      ),
    );
    if (ok != true) return;
    try {
      final r = await api.patch('/appointments/${a['id']}/cancel') as Map;
      if (mounted) toast(context, r['refunded'] == true ? 'Appointment cancelled — refund issued' : 'Appointment cancelled');
      _loadAll();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _book(Map<String, dynamic> d, {Map<String, dynamic>? reschedule}) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _BookSheet(doctor: d, reschedule: reschedule),
    );
    if (result == null) return;
    await _loadAll();
    if (result['status'] == 'PENDING_PAYMENT' && mounted) _pay(result);
  }

  Future<void> _pay(Map<String, dynamic> a) async {
    final paid = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => _PaySheet(appt: a));
    if (paid == true) _loadAll();
  }
}

// ------------------------------------------------------------------ booking sheet
class _BookSheet extends StatefulWidget {
  const _BookSheet({required this.doctor, this.reschedule});
  final Map<String, dynamic> doctor;
  final Map<String, dynamic>? reschedule;
  @override
  State<_BookSheet> createState() => _BookSheetState();
}

class _BookSheetState extends State<_BookSheet> {
  List slots = [];
  String? day, pick;
  bool loading = true, busy = false;
  String? error;
  final reason = TextEditingController();

  @override
  void initState() {
    super.initState();
    api.get('/doctors/${widget.doctor['id']}/slots').then((r) {
      if (!mounted) return;
      setState(() {
        slots = (r as Map)['slots'];
        day = slots.isEmpty ? null : slots.first['day'];
        loading = false;
      });
    });
  }

  Future<void> _submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final res = widget.reschedule != null
          ? await api.patch('/appointments/${widget.reschedule!['id']}/reschedule', {'startAt': pick})
          : await api.post('/appointments', {'doctorId': widget.doctor['id'], 'startAt': pick, if (reason.text.trim().isNotEmpty) 'reason': reason.text.trim()});
      if (mounted) {
        if (widget.reschedule != null) toast(context, 'Moved to ${fmtWhen(res['startAt'])}');
        Navigator.pop(context, Map<String, dynamic>.from(res));
      }
    } on ApiException catch (e) {
      setState(() {
        error = e.message;
        if (e.status == 409) pick = null;
      });
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.doctor;
    final f = d['facility'];
    final days = <String>[];
    for (final s in slots) {
      if (!days.contains(s['day'])) days.add(s['day']);
    }
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(widget.reschedule != null ? 'RESCHEDULE' : 'NEW APPOINTMENT', style: const TextStyle(color: C.brand, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
          const SizedBox(height: 4),
          Text('${widget.reschedule != null ? 'Reschedule with' : 'Book'} ${d['name']}', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('${d['specialization']} · ${f != null ? f['address'] : d['hospital']}', style: TextStyle(color: C.muted, fontSize: 12.5)),
          if (d['schedule'] != null) Text(d['schedule'], style: TextStyle(color: C.muted, fontSize: 12)),
          if (f != null)
            TextButton.icon(
              onPressed: () => openDirections(f),
              icon: const Icon(Icons.directions, size: 18),
              label: const Text('Directions'),
            ),
          const SizedBox(height: 10),
          if (loading) const Center(child: CircularProgressIndicator(color: C.brand)),
          if (!loading && days.isEmpty) Text('No free slots in the next 7 days.', style: TextStyle(color: C.muted)),
          if (days.isNotEmpty) ...[
            Text('PICK A DAY', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
            const SizedBox(height: 8),
            Wrap(spacing: 7, runSpacing: 7, children: days.map((x) => Pill(x, on: day == x, onTap: () => setState(() {
                  day = x;
                  pick = null;
                }))).toList()),
            const SizedBox(height: 14),
            Text('PICK A TIME', style: TextStyle(color: C.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: slots.where((s) => s['day'] == day).map((s) => Pill(s['label'], on: pick == s['startAt'], onTap: () => setState(() => pick = s['startAt']))).toList(),
            ),
          ],
          if (widget.reschedule == null) ...[
            const SizedBox(height: 14),
            TextField(controller: reason, decoration: const InputDecoration(labelText: 'Reason for visit (optional)', hintText: 'e.g. cough for two weeks')),
          ],
          const SizedBox(height: 12),
          Notice(widget.reschedule != null ? 'Current slot: ${fmtWhen(widget.reschedule!['startAt'])}' : 'Your slot is held for 10 minutes while you complete the payment.', icon: Icons.lock_outline),
          if (error != null) ...[const SizedBox(height: 10), Notice(error!, tone: 'crit', icon: Icons.error_outline)],
          const SizedBox(height: 14),
          GradientButton(
            label: widget.reschedule != null ? 'Move my appointment' : 'Hold slot and pay ${rs(d['fee'])}',
            busy: busy,
            onPressed: pick == null ? null : _submit,
          ),
        ]),
      ),
    );
  }
}

// ------------------------------------------------------------------ payment sheet
class _PaySheet extends StatefulWidget {
  const _PaySheet({required this.appt});
  final Map<String, dynamic> appt;
  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  String method = 'JAZZCASH';
  bool busy = false;
  String? error;
  late int left;
  Timer? _t;

  @override
  void initState() {
    super.initState();
    final exp = widget.appt['holdExpiresAt'];
    left = exp == null ? 600 : DateTime.parse(exp).difference(DateTime.now()).inSeconds.clamp(0, 600);
    _t = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => left = (left - 1).clamp(0, 600)));
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.appt;
    final amount = a['payment']?['amount'] ?? a['doctor']['fee'];
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        const Text('SECURE PAYMENT', style: TextStyle(color: C.brand, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
        const SizedBox(height: 4),
        Row(children: [
          Expanded(child: Text('Pay ${rs(amount)}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
          Pill('${left ~/ 60}:${(left % 60).toString().padLeft(2, '0')}', tone: left < 60 ? 'crit' : 'warn', icon: Icons.timer_outlined),
        ]),
        Text('${a['doctor']['name']} · ${fmtWhen(a['startAt'])} · ${a['payment']?['invoiceNo'] ?? ''}', style: TextStyle(color: C.muted, fontSize: 12.5)),
        const SizedBox(height: 14),
        ...[('JAZZCASH', 'JazzCash', 'Mobile wallet', Icons.account_balance_wallet_outlined), ('EASYPAISA', 'EasyPaisa', 'Mobile wallet', Icons.account_balance_wallet_outlined), ('CARD', 'Debit / credit card', 'Visa · Mastercard · UnionPay', Icons.credit_card)].map(
          (m) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(color: method == m.$1 ? C.soft(C.brand) : C.surface2, borderRadius: BorderRadius.circular(12), border: Border.all(color: method == m.$1 ? C.brand : C.line)),
            child: ListTile(
              onTap: () => setState(() => method = m.$1),
              leading: Icon(method == m.$1 ? Icons.radio_button_checked : Icons.radio_button_off, color: method == m.$1 ? C.brand : C.muted),
              title: Text(m.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(m.$3, style: TextStyle(color: C.muted, fontSize: 12)),
              trailing: Icon(m.$4, color: C.ink2),
            ),
          ),
        ),
        const Notice('You will be asked to approve the payment in your JazzCash, EasyPaisa or banking app.', icon: Icons.info_outline),
        if (error != null) ...[const SizedBox(height: 10), Notice(error!, tone: 'crit', icon: Icons.error_outline)],
        const SizedBox(height: 14),
        GradientButton(
          label: left == 0 ? 'Hold expired — book again' : 'Confirm and pay ${rs(amount)}',
          busy: busy,
          onPressed: left == 0
              ? null
              : () async {
                  setState(() {
                    busy = true;
                    error = null;
                  });
                  try {
                    final r = await api.post('/appointments/${a['id']}/pay', {'method': method}) as Map;
                    if (context.mounted) {
                      toast(context, 'Appointment confirmed with ${r['doctor']['name']}');
                      Navigator.pop(context, true);
                    }
                  } on ApiException catch (e) {
                    setState(() => error = e.message);
                  } finally {
                    if (mounted) setState(() => busy = false);
                  }
                },
        ),
      ]),
    );
  }
}
