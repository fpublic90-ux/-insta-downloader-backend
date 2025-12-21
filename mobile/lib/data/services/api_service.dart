import 'package:dio/dio.dart';
import '../../core/constants/api_constants.dart';

class ApiService {
  final Dio _dio = Dio();

  Future<Map<String, dynamic>> extractVideo(String url) async {
    try {
      final response = await _dio.post(
        ApiConstants.extractEndpoint,
        data: {'url': url},
        options: Options(
          sendTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
        ),
      );

      if (response.statusCode == 200) {
        return response.data;
      } else {
        throw Exception('Failed to extract: ${response.statusMessage}');
      }
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(e.response?.data['message'] ?? 'Extraction failed');
      }
      throw Exception('Network error: ${e.message}');
    } catch (e) {
      throw Exception('Unknown error: $e');
    }
  }
}
