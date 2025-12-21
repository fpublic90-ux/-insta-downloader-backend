import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/download_item.dart';

class HistoryStorage {
  static const String key = 'download_history';

  Future<List<DownloadItem>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(key);
    if (jsonString == null) return [];

    try {
      final List<dynamic> decoded = jsonDecode(jsonString);
      return decoded.map((e) => DownloadItem.fromJson(e)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> saveHistory(List<DownloadItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(items.map((e) => e.toJson()).toList());
    await prefs.setString(key, jsonString);
  }

  Future<void> clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }
}
