import 'package:flutter_test/flutter_test.dart';
import 'package:luvia_mobile/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const LuviaApp());

    // Verify that the title 'Luvia' is present.
    expect(find.text('Luvia'), findsAtLeastNWidgets(1));
  });
}
