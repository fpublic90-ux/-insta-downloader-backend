import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../data/models/download_item.dart';
import '../../data/services/api_service.dart';
import '../../data/services/download_service.dart';
import '../../data/storage/history_storage.dart';

class DownloadProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final DownloadService _downloadService = DownloadService();
  final HistoryStorage _historyStorage = HistoryStorage();

  List<DownloadItem> _downloads = [];
  List<DownloadItem> get downloads => _downloads;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  DownloadProvider() {
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    _downloads = await _historyStorage.getHistory();
    // Sort by Date Descending
    _downloads.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    notifyListeners();
  }

  Future<void> processUrl(String url) async {
    // Check if valid URL
    if (url.isEmpty || !url.contains('instagram.com')) {
      throw Exception('Invalid Instagram URL');
    }

    _isLoading = true;
    notifyListeners();

    try {
      // 1. Extract Info
      final data = await _apiService.extractVideo(url);
      final videoUrl = data['videoUrl'];
      final resolution = data['resolution'] ?? 'HD';

      // 2. Create Download Item
      final newItem = DownloadItem(
        url: url,
        videoUrl: videoUrl,
        fileName: 'InstaVid_${DateTime.now().millisecondsSinceEpoch}',
        quality: resolution,
        status: DownloadStatus.downloading,
      );

      _downloads.insert(0, newItem); // Add to top
      notifyListeners();
      _saveToHistory();

      _isLoading = false; // Extraction done, now start download in background
      notifyListeners();

      // 3. Start Download
      await _startDownload(newItem);
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> _startDownload(DownloadItem item) async {
    try {
      final index = _downloads.indexWhere((element) => element.id == item.id);
      if (index == -1) return;

      await _downloadService.downloadVideo(
        item.videoUrl!,
        item.fileName,
        onProgress: (progress) {
          // Update progress
          final idx = _downloads.indexWhere((element) => element.id == item.id);
          if (idx != -1) {
            _downloads[idx] = _downloads[idx].copyWith(progress: progress);
            notifyListeners();
          }
        },
      );

      // Complete
      final idx = _downloads.indexWhere((element) => element.id == item.id);
      if (idx != -1) {
        _downloads[idx] = _downloads[idx].copyWith(
          status: DownloadStatus.completed,
          progress: 1.0,
        );
        notifyListeners();
        _saveToHistory();
      }
    } catch (e) {
      final idx = _downloads.indexWhere((element) => element.id == item.id);
      if (idx != -1) {
        _downloads[idx] =
            _downloads[idx].copyWith(status: DownloadStatus.failed);
        notifyListeners();
        _saveToHistory();
      }
      throw e;
    }
  }

  void retryDownload(DownloadItem item) async {
    final idx = _downloads.indexWhere((element) => element.id == item.id);
    if (idx != -1 && item.videoUrl != null) {
      _downloads[idx] = _downloads[idx]
          .copyWith(status: DownloadStatus.downloading, progress: 0);
      notifyListeners();
      _startDownload(_downloads[idx]);
    } else {
      // Re-process if videoUrl expired (not implemented simple retry here assume link is fresh for now)
      // Or remove and re-add
    }
  }

  void clearHistory() {
    _downloads.clear();
    _historyStorage.clearHistory();
    notifyListeners();
  }

  Future<void> _saveToHistory() async {
    await _historyStorage.saveHistory(_downloads);
  }
}
