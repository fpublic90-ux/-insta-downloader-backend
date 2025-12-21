import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:gap/gap.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../../core/constants/api_constants.dart';
import '../../data/models/download_item.dart';
import '../../presentation/controllers/download_provider.dart';
import '../widgets/custom_text_field.dart';
import '../widgets/progress_card.dart';
import 'history_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _urlController = TextEditingController();

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _handlePaste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null) {
      _urlController.text = data!.text!;
      _processUrl(data.text!);
    }
  }

  void _processUrl(String url) {
    if (url.isEmpty) return;

    // Simple validation
    if (!url.contains('instagram.com')) {
      Fluttertoast.showToast(msg: "Please paste a valid Instagram link");
      return;
    }

    // Call Provider
    context.read<DownloadProvider>().processUrl(url).catchError((e) {
      Fluttertoast.showToast(msg: e.toString());
    });

    _urlController.clear();
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("InstaSaver"),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const HistoryScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      body: Consumer<DownloadProvider>(
        builder: (context, provider, child) {
          return Column(
            children: [
              // Input Data
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF121212),
                  borderRadius:
                      const BorderRadius.vertical(bottom: Radius.circular(24)),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withOpacity(0.5),
                        blurRadius: 20,
                        offset: const Offset(0, 10)),
                  ],
                ),
                child: Column(
                  children: [
                    CustomTextField(
                      controller: _urlController,
                      hintText: "Paste Instagram Link Here...",
                      onPaste: _handlePaste,
                      onSubmitted: _processUrl,
                    ),
                    const Gap(16),
                    if (provider.isLoading)
                      const LinearProgressIndicator(color: Color(0xFFE1306C)),
                  ],
                ),
              ),

              // Recent Downloads / Queue
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: provider.downloads.length,
                  itemBuilder: (context, index) {
                    final item = provider.downloads[index];
                    return ProgressCard(
                      item: item,
                      onRetry: () => provider.retryDownload(item),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
