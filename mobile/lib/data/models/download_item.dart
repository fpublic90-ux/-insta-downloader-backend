import 'package:uuid/uuid.dart';

enum DownloadStatus { pending, downloading, completed, failed, paused }

class DownloadItem {
  final String id;
  final String url;
  final String? videoUrl;
  final String? thumbnailPath;
  final String? filePath;
  final String fileName;
  final double progress;
  final DownloadStatus status;
  final DateTime createdAt;
  final String quality;

  DownloadItem({
    String? id,
    required this.url,
    this.videoUrl,
    this.thumbnailPath,
    this.filePath,
    required this.fileName,
    this.progress = 0.0,
    this.status = DownloadStatus.pending,
    DateTime? createdAt,
    this.quality = 'Unknown',
  })  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now();

  DownloadItem copyWith({
    String? videoUrl,
    String? thumbnailPath,
    String? filePath,
    double? progress,
    DownloadStatus? status,
    String? quality,
  }) {
    return DownloadItem(
      id: id,
      url: url,
      fileName: fileName,
      videoUrl: videoUrl ?? this.videoUrl,
      thumbnailPath: thumbnailPath ?? this.thumbnailPath,
      filePath: filePath ?? this.filePath,
      progress: progress ?? this.progress,
      status: status ?? this.status,
      createdAt: createdAt,
      quality: quality ?? this.quality,
    );
  }

  // To/From Json for local storage (SharedPreferences)
  Map<String, dynamic> toJson() => {
        'id': id,
        'url': url,
        'videoUrl': videoUrl,
        'thumbnailPath': thumbnailPath,
        'filePath': filePath,
        'fileName': fileName,
        'progress': progress,
        'status': status.index,
        'createdAt': createdAt.toIso8601String(),
        'quality': quality,
      };

  factory DownloadItem.fromJson(Map<String, dynamic> json) => DownloadItem(
        id: json['id'],
        url: json['url'],
        videoUrl: json['videoUrl'],
        thumbnailPath: json['thumbnailPath'],
        filePath: json['filePath'],
        fileName: json['fileName'],
        progress: json['progress'],
        status: DownloadStatus.values[json['status']],
        createdAt: DateTime.parse(json['createdAt']),
        quality: json['quality'],
      );
}
