import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../data/models/download_item.dart';
import '../controllers/download_provider.dart';

class ProgressCard extends StatelessWidget {
  final DownloadItem item;
  final VoidCallback? onRetry;

  const ProgressCard({
    super.key,
    required this.item,
    this.onRetry,
  });

  String _formatBytes(int? bytes) {
    if (bytes == null) return '';
    const suffixes = ["B", "KB", "MB", "GB", "TB"];
    var i = 0;
    double size = bytes.toDouble();
    while (size > 1024 && i < suffixes.length - 1) {
      size /= 1024;
      i++;
    }
    return '${size.toStringAsFixed(1)} ${suffixes[i]}';
  }

  @override
  Widget build(BuildContext context) {
    final fileSizeText = _formatBytes(item.fileSize);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: item.status == DownloadStatus.completed
              ? () {
                  context.read<DownloadProvider>().openVideo(item);
                }
              : null,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Icon / Thumbnail placeholder
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(8),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF833AB4), Color(0xFFE1306C)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Icon(
                    item.status == DownloadStatus.completed
                        ? Icons.play_arrow_rounded
                        : Icons.video_collection_rounded,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.fileName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.status == DownloadStatus.completed
                            ? 'Saved • ${item.quality} ${fileSizeText.isNotEmpty ? "• $fileSizeText" : ""}'
                            : item.status == DownloadStatus.failed
                                ? 'Failed'
                                : 'Downloading... ${(item.progress * 100).toInt()}%',
                        style: TextStyle(
                          color: item.status == DownloadStatus.failed
                              ? Colors.red
                              : Colors.grey,
                          fontSize: 12,
                        ),
                      ),
                      if (item.status == DownloadStatus.downloading)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: LinearProgressIndicator(
                            value: item.progress,
                            backgroundColor: Colors.white10,
                            color: const Color(0xFFE1306C),
                            minHeight: 4,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                    ],
                  ),
                ),
                if (item.status == DownloadStatus.failed && onRetry != null)
                  IconButton(
                    icon: const Icon(Icons.refresh, color: Colors.white54),
                    onPressed: onRetry,
                  ),
                if (item.status == DownloadStatus.completed)
                  const Icon(Icons.check_circle, color: Color(0xFFE1306C)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
