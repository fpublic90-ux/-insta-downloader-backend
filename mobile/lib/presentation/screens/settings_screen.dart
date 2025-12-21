import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../controllers/download_provider.dart';
import 'splash_screen.dart'; // For re-showing disclaimer if needed, or just about

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Settings")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            leading: const Icon(Icons.delete_outline, color: Colors.white),
            title: const Text("Clear History",
                style: TextStyle(color: Colors.white)),
            onTap: () {
              context.read<DownloadProvider>().clearHistory();
              ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("History cleared")));
            },
          ),
          const Divider(color: Colors.white24),
          ListTile(
            leading: const Icon(Icons.info_outline, color: Colors.white),
            title: const Text("About", style: TextStyle(color: Colors.white)),
            subtitle: const Text("InstaSaver Pro v1.0.0",
                style: TextStyle(color: Colors.white54)),
          ),
          ListTile(
            title:
                const Text("Disclaimer", style: TextStyle(color: Colors.white)),
            subtitle: const Text("We are not affiliated with Instagram.",
                style: TextStyle(color: Colors.white54)),
          ),
        ],
      ),
    );
  }
}
