import 'dart:io';
import 'package:dio/dio.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';

class DownloadService {
  final Dio _dio = Dio();

  Future<bool> requestPermission() async {
    // Gal handles permission requests for saving to gallery on Android & iOS.
    // On Android 10+, this might not even prompt significantly, but it ensures access.
    return await Gal.requestAccess();
  }

  Future<Map<String, dynamic>> downloadVideo(
    String url,
    String fileName, {
    required Function(double) onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      print('DownloadService: Starting download for $url');
      final dir = await getTemporaryDirectory();
      final savePath = '${dir.path}/$fileName.mp4';
      print('DownloadService: Saving to $savePath');

      await _dio.download(
        url,
        savePath,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            onProgress(received / total);
            // Too noisy to print every progress update
          }
        },
        cancelToken: cancelToken,
      );

      final file = File(savePath);
      final size = await file.length();
      print('DownloadService: Download complete. Size: $size bytes');

      // Save to Gallery
      // album: "InstaDownloader" creates/uses this album
      print('DownloadService: Saving to gallery...');
      await Gal.putVideo(savePath, album: "InstaDownloader");
      print('DownloadService: Saved to gallery successfully');

      return {'path': savePath, 'size': size};
    } catch (e) {
      print('DownloadService: Error - $e');
      // Clean up file if needed? usually temp files are ok to leave or overwritten
      throw Exception('Download failed: $e');
    }
  }
}
