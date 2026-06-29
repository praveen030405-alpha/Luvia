import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:glassmorphism/glassmorphism.dart';

void main() {
  runApp(const LuviaApp());
}

class LuviaApp extends StatelessWidget {
  const LuviaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Luvia',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.black,
        fontFamily: 'Inter', // Assuming standard font
      ),
      home: const ChatScreen(),
    );
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with TickerProviderStateMixin {
  final TextEditingController _controller = TextEditingController();
  final List<Map<String, String>> _messages = [];
  bool _isLoading = false;
  late String _jwtToken;
  final String _apiUrl = 'https://luvia-omega.vercel.app/api';

  // Animation Controllers for Aurora
  late AnimationController _anim1;
  late AnimationController _anim2;

  @override
  void initState() {
    super.initState();
    _anim1 = AnimationController(vsync: this, duration: const Duration(seconds: 10))..repeat(reverse: true);
    _anim2 = AnimationController(vsync: this, duration: const Duration(seconds: 15))..repeat(reverse: true);
    _loginGuest();
  }

  @override
  void dispose() {
    _anim1.dispose();
    _anim2.dispose();
    super.dispose();
  }

  Future<void> _loginGuest() async {
    try {
      final res = await http.post(
        Uri.parse('$_apiUrl/auth/guest'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': 'flutter@test.com', 'name': 'Flutter Mobile'}),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _jwtToken = data['token'];
        });
        _addMessage('system', 'Connected to Luvia Core.');
      }
    } catch (e) {
      _addMessage('system', 'Connection failed.');
    }
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;
    
    _addMessage('user', text);
    _controller.clear();
    setState(() => _isLoading = true);

    try {
      final res = await http.post(
        Uri.parse('$_apiUrl/chat/message'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_jwtToken'
        },
        body: jsonEncode({
          'message': text,
          'mode': 'fusion'
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        _addMessage('assistant', data['message']['content']);
      } else {
        _addMessage('system', 'Failed to get response.');
      }
    } catch (e) {
      _addMessage('system', 'Network error.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _addMessage(String role, String content) {
    setState(() {
      _messages.add({'role': role, 'content': content});
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Luvia', style: TextStyle(fontWeight: FontWeight.w300, letterSpacing: 2)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        flexibleSpace: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(color: Colors.black.withOpacity(0.1)),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Aurora Background
          AnimatedBuilder(
            animation: _anim1,
            builder: (context, child) {
              return Positioned(
                top: -100 + (math.sin(_anim1.value * math.pi) * 100),
                left: -100 + (math.cos(_anim2.value * math.pi) * 100),
                child: Container(
                  width: 400,
                  height: 400,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Colors.deepPurpleAccent.withOpacity(0.5),
                        Colors.transparent
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          AnimatedBuilder(
            animation: _anim2,
            builder: (context, child) {
              return Positioned(
                bottom: -50 + (math.cos(_anim1.value * math.pi) * 100),
                right: -50 + (math.sin(_anim2.value * math.pi) * 100),
                child: Container(
                  width: 350,
                  height: 350,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Colors.blueAccent.withOpacity(0.4),
                        Colors.transparent
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          // Blur Layer over Aurora
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 60, sigmaY: 60),
            child: Container(color: Colors.black.withOpacity(0.6)),
          ),
          
          // Chat Interface
          SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      final isUser = msg['role'] == 'user';
                      return AnimatedChatBubble(
                        message: msg['content']!,
                        isUser: isUser,
                        isSystem: msg['role'] == 'system',
                      );
                    },
                  ),
                ),
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.all(8.0),
                    child: CircularProgressIndicator(color: Colors.cyanAccent),
                  ),
                _buildInputBar(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: GlassmorphicContainer(
        width: double.infinity,
        height: 60,
        borderRadius: 30,
        blur: 20,
        alignment: Alignment.center,
        border: 1.5,
        linearGradient: LinearGradient(
          colors: [
            Colors.white.withOpacity(0.1),
            Colors.white.withOpacity(0.05),
          ],
        ),
        borderGradient: LinearGradient(
          colors: [
            Colors.cyanAccent.withOpacity(0.5),
            Colors.purpleAccent.withOpacity(0.5),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Type a message...',
                  hintStyle: TextStyle(color: Colors.white54),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 24),
                ),
                onSubmitted: _sendMessage,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.send_rounded, color: Colors.cyanAccent),
              onPressed: () => _sendMessage(_controller.text),
            ),
            const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }
}

class AnimatedChatBubble extends StatelessWidget {
  final String message;
  final bool isUser;
  final bool isSystem;

  const AnimatedChatBubble({
    super.key,
    required this.message,
    required this.isUser,
    required this.isSystem,
  });

  @override
  Widget build(BuildContext context) {
    if (isSystem) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8.0),
          child: Text(
            message,
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: GlassmorphicContainer(
          width: math.min(MediaQuery.of(context).size.width * 0.75, message.length * 10.0 + 50), // Auto sizing hack for glassmorphism package
          height: _calculateHeight(message, context),
          borderRadius: 20,
          blur: 15,
          alignment: Alignment.center,
          border: 1,
          linearGradient: LinearGradient(
            colors: [
              isUser ? Colors.deepPurpleAccent.withOpacity(0.2) : Colors.white.withOpacity(0.1),
              isUser ? Colors.blueAccent.withOpacity(0.1) : Colors.white.withOpacity(0.05),
            ],
          ),
          borderGradient: LinearGradient(
            colors: [
              isUser ? Colors.purpleAccent.withOpacity(0.5) : Colors.white.withOpacity(0.2),
              isUser ? Colors.blueAccent.withOpacity(0.2) : Colors.white.withOpacity(0.1),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text(
              message,
              style: const TextStyle(color: Colors.white, fontSize: 15),
            ),
          ),
        ),
      ),
    );
  }

  double _calculateHeight(String text, BuildContext context) {
    // Rough estimate for height since GlassmorphicContainer requires explicit height/width
    final span = TextSpan(style: const TextStyle(fontSize: 15), text: text);
    final tp = TextPainter(text: span, textDirection: TextDirection.ltr);
    tp.layout(maxWidth: MediaQuery.of(context).size.width * 0.75 - 32);
    return tp.height + 32;
  }
}
