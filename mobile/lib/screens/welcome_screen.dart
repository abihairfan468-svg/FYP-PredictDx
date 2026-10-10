import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'auth_screen.dart';

/// First screen: the PredictDX cover (lungs, mark, tagline) - same as the website's sign-in art.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(children: [
        Expanded(
          child: Stack(fit: StackFit.expand, children: [
            Image.asset('assets/img/lungs-square.jpg', fit: BoxFit.cover),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.centerLeft, end: Alignment.centerRight, colors: [Color(0x8C0B2A55), Color(0x000B2A55)]),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(28, 60, 28, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.ac_unit, color: Colors.white, size: 54),
                  const SizedBox(height: 18),
                  Text('PredictDX', style: GoogleFonts.publicSans(fontSize: 46, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5)),
                  const SizedBox(height: 12),
                  const SizedBox(
                    width: 260,
                    child: Text('AI multimodal system for early detection and future risk prediction of chest diseases.',
                        style: TextStyle(color: Color(0xEBFFFFFF), fontSize: 15, height: 1.45)),
                  ),
                ]),
              ),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 26, 24, 28),
          child: Column(children: [
            Container(height: 3, width: 48, decoration: BoxDecoration(color: C.brand, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 18),
            Text('Predict disease save lives', textAlign: TextAlign.center, style: display(21, color: C.skyInk)),
            const SizedBox(height: 24),
            GradientButton(
              label: 'Get Started',
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen(signUp: true))),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())),
              child: const Text('I already have an account · Sign in', style: TextStyle(color: C.brand, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
      ]),
    );
  }
}
