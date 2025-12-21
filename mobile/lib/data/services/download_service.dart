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

  Future<String> downloadVideo(
    String url,
    String fileName, {
    required Function(double) onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      final dir = await getTemporaryDirectory();
      final savePath = '${dir.path}/$fileName.mp4';

      await _dio.download(
        url,
        savePath,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            onProgress(received / total);
          }
        },
        cancelToken: cancelToken,
      );

      // Save to Gallery
      // album: "InstaDownloader" creates/uses this album
      await Gal.putVideo(savePath, album: "InstaDownloader");

      return savePath;
    } catch (e) {
      // Clean up file if needed? usually temp files are ok to leave or overwritten
      throw Exception('Download failed: $e');
    }
  }
}
