import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import 'core/auth.dart';
import 'screens/shell.dart';
import 'screens/welcome_screen.dart';
import 'ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // In the browser, expose the accessibility tree from the start (screen readers, browser automation).
  if (kIsWeb) SemanticsBinding.instance.ensureSemantics();
  runApp(const PredictDxApp());
  themeController.restore();
  auth.restore();
}

class PredictDxApp extends StatelessWidget {
  const PredictDxApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: themeController,
      builder: (context, _) => MaterialApp(
      title: 'PredictDx',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: ListenableBuilder(
        listenable: auth,
        builder: (context, _) {
          if (!auth.ready) {
            return const Scaffold(body: Center(child: CircularProgressIndicator(color: C.brand)));
          }
          return auth.user == null ? const WelcomeScreen() : Shell(key: ValueKey(auth.user!.id));
        },
      ),
      ),
    );
  }
}
