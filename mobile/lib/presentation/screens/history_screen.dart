import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../controllers/download_provider.dart';
import '../widgets/progress_card.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Download History")),
      body: Consumer<DownloadProvider>(
        builder: (context, provider, _) {
          final history = provider
              .downloads; // In real app, might separate 'completed' from 'active'

          if (history.isEmpty) {
            return const Center(
                child: Text("No history yet",
                    style: TextStyle(color: Colors.white54)));
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: history.length,
            itemBuilder: (context, index) {
              return ProgressCard(item: history[index]);
            },
          );
        },
      ),
    );
  }
}
