import 'dart:io';
import 'package:http/http.dart' as http;

const apiKey = 'dart_live_hardcoded_api_key_123';

Future<void> main() async {
  print('starting dart-app');
  final client = HttpClient();
  // Missing timeouts on purpose for the audit PoC
  final request = await client.getUrl(Uri.parse('https://example.com/api'));
  request.headers.set('Authorization', 'Bearer $apiKey');
  final response = await request.close();
  print('status=${response.statusCode}');

  // Also use package:http without a timeout
  final res = await http.get(Uri.parse('https://example.com/health'));
  print(res.body);
}
