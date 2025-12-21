import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:open_file/open_file.dart';
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
    print('DownloadProvider: Processing URL: $url');
    // Check if valid URL
    if (url.isEmpty || !url.contains('instagram.com')) {
      print('DownloadProvider: Invalid URL');
      throw Exception('Invalid Instagram URL');
    }

    _isLoading = true;
    notifyListeners();

    try {
      // 1. Extract Info
      print('DownloadProvider: Extracting video info...');
      final data = await _apiService.extractVideo(url);
      print('DownloadProvider: Extraction success: $data');
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
      print('DownloadProvider: Error in processUrl: $e');
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> _startDownload(DownloadItem item) async {
    print('DownloadProvider: Starting download for ${item.fileName}');
    try {
      final index = _downloads.indexWhere((element) => element.id == item.id);
      if (index == -1) return;

      final result = await _downloadService.downloadVideo(
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

      print(
          'DownloadProvider: Download finished. Path: ${result['path']}, Size: ${result['size']}');

      // Complete
      final idx = _downloads.indexWhere((element) => element.id == item.id);
      if (idx != -1) {
        _downloads[idx] = _downloads[idx].copyWith(
          status: DownloadStatus.completed,
          progress: 1.0,
          filePath: result['path'],
          fileSize: result['size'],
        );
        notifyListeners();
        _saveToHistory();
      }
    } catch (e) {
      print('DownloadProvider: Download failed for ${item.fileName}: $e');
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
    print('DownloadProvider: Retrying download ${item.id}');
    final idx = _downloads.indexWhere((element) => element.id == item.id);
    if (idx != -1 && item.videoUrl != null) {
      _downloads[idx] = _downloads[idx]
          .copyWith(status: DownloadStatus.downloading, progress: 0);
      notifyListeners();
      _startDownload(_downloads[idx]);
    } else {
      print(
          'DownloadProvider: Cannot retry, missing videoUrl or item not found');
    }
  }

  void clearHistory() {
    print('DownloadProvider: Clearing history');
    _downloads.clear();
    _historyStorage.clearHistory();
    notifyListeners();
  }

  Future<void> openVideo(DownloadItem item) async {
    print('DownloadProvider: Request to open video: ${item.filePath}');
    if (item.filePath == null) {
      print('DownloadProvider: File path is null');
      return;
    }

    try {
      final result = await OpenFile.open(item.filePath);
      print(
          'DownloadProvider: Open result: ${result.type} - ${result.message}');
    } catch (e) {
      print('DownloadProvider: Error opening file: $e');
    }
  }

  Future<void> _saveToHistory() async {
    await _historyStorage.saveHistory(_downloads);
  }
}
