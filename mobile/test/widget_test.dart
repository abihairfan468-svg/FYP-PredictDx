import 'package:flutter_test/flutter_test.dart';
import 'package:predictdx_mobile/ui/widgets.dart';

void main() {
  test('money is shown the Pakistani way, and zero as Free', () {
    expect(rs(2500), 'Rs 2,500');
    expect(rs(0), 'Free');
  });

  test('initials skip the Dr prefix', () {
    expect(initials('Dr Adeel Rehman'), 'AR');
    expect(initials('Ayesha Khan'), 'AK');
  });

  test('relative days read naturally', () {
    final now = DateTime.now();
    expect(fmtDay(now.toIso8601String()), 'Today');
    expect(fmtDay(now.add(const Duration(days: 1)).toIso8601String()), 'Tomorrow');
    expect(ago(now.subtract(const Duration(seconds: 10)).toIso8601String()), 'just now');
    expect(ago(now.subtract(const Duration(minutes: 5)).toIso8601String()), '5 min ago');
  });
}
