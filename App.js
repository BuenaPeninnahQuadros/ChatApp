import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  NativeModules,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { io } from 'socket.io-client';

const QUICK_EMOJIS = ['😊', '😂', '😍', '🔥', '👍', '🎉'];

function getDefaultServerUrl() {
  const scriptUrl = NativeModules?.SourceCode?.scriptURL || '';
  const match = scriptUrl.match(/https?:\/\/([^/:]+)/);

  if (match?.[1]) {
    return `http://${match[1]}:3001`;
  }

  return 'http://localhost:3001';
}

const SERVER_URL = process.env.EXPO_PUBLIC_CHAT_SERVER_URL || getDefaultServerUrl();

function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function App() {
  const socketRef = useRef(null);
  const [nameInput, setNameInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [connectionState, setConnectionState] = useState('offline');
  const [emojiPanelVisible, setEmojiPanelVisible] = useState(false);

  const socketLabel = useMemo(() => {
    if (connectionState === 'connected') {
      return 'Connected';
    }

    if (connectionState === 'connecting') {
      return 'Connecting...';
    }

    return 'Offline';
  }, [connectionState]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    setConnectionState('connecting');

    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
      socket.emit('join', currentUser);
    });

    socket.on('message:history', (history) => {
      setMessages(history);
    });

    socket.on('message:new', (message) => {
      setMessages((previousMessages) => [...previousMessages, message]);
    });

    socket.on('disconnect', () => {
      setConnectionState('offline');
    });

    socket.on('connect_error', () => {
      setConnectionState('offline');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser]);

  async function handleLogin() {
    const trimmedName = nameInput.trim();

    if (!trimmedName) {
      setLoginError('Enter a display name to continue.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch(`${SERVER_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedName }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      setCurrentUser(data.user);
    } catch {
      setLoginError('Could not reach the server. Start the backend and try again.');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleSendMessage() {
    const trimmedMessage = messageInput.trim();

    if (!trimmedMessage || !socketRef.current || !currentUser) {
      return;
    }

    socketRef.current.emit('message:send', {
      text: trimmedMessage,
      user: currentUser,
    });

    setMessageInput('');
  }

  function handleAddEmoji(emoji) {
    setMessageInput((currentMessage) => `${currentMessage}${emoji}`);
  }

  function toggleEmojiPanel() {
    setEmojiPanelVisible((currentVisible) => !currentVisible);
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loginScreen}>
          <View style={styles.loginCard}>
            <Text style={styles.brand}>Welcome to the Chat App!!</Text>
            <Text style={styles.title}>Sign in with a display name</Text>
            

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Your name"
              placeholderTextColor="#8B7A9A"
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleLogin}>
              {loginLoading ? (
                <ActivityIndicator color="#6E4FA3" />
              ) : (
                <Text style={styles.primaryButtonText}>Enter chat</Text>
              )}
            </Pressable>

            
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.chatScreen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Signed in as</Text>
            <Text style={styles.headerUser}>{currentUser.username}</Text>
          </View>
          <Text style={styles.statusText}>{socketLabel}</Text>
        </View>

        <FlatList
          contentContainerStyle={styles.messageList}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMine = item.userId === currentUser.id;

            return (
              <View style={[styles.messageRow, isMine ? styles.mineRow : styles.otherRow]}>
                <View style={[styles.messageBubble, isMine ? styles.mineBubble : styles.otherBubble]}>
                  <Text style={[styles.messageSender, isMine ? styles.messageSenderMine : styles.messageSenderOther]}>
                    {item.username}
                  </Text>
                  <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
                    {item.text}
                  </Text>
                  <Text style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeOther]}>
                    {formatTimestamp(item.timestamp)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          {emojiPanelVisible ? (
            <View style={styles.emojiRow}>
              {QUICK_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${emoji}`}
                  style={styles.emojiButton}
                  onPress={() => handleAddEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.composerControls}>
            <TextInput
              placeholder="Write a message"
              placeholderTextColor="#8B7A9A"
              style={styles.messageInput}
              value={messageInput}
              onChangeText={setMessageInput}
              multiline
            />
            <Pressable style={styles.sendButton} onPress={handleSendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle emoji panel"
              style={[styles.emojiToggleButton, emojiPanelVisible ? styles.emojiToggleButtonActive : null]}
              onPress={toggleEmojiPanel}
            >
              <Text style={styles.emojiToggleText}>😊</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e9e2f7',
  },
  loginScreen: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loginCard: {
    backgroundColor: '#f4effd',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#d4c3f0',
  },
  brand: {
    color: '#7b5bb7',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: '#4f3a78',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#77658f',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fcfaff',
    color: '#4f3a78',
    borderWidth: 1,
    borderColor: '#d7c7ef',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  errorText: {
    color: '#8b4bb4',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#8f6bd1',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonText: {
    color: '#fcfaff',
    fontWeight: '700',
    fontSize: 16,
  },
  serverHint: {
    color: '#8b7a9a',
    marginTop: 14,
    fontSize: 12,
  },
  chatScreen: {
    flex: 1,
    backgroundColor: '#e9e2f7',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#d4c3f0',
    backgroundColor: '#f4effd',
  },
  headerLabel: {
    color: '#8b7a9a',
    fontSize: 12,
  },
  headerUser: {
    color: '#4f3a78',
    fontSize: 18,
    fontWeight: '700',
  },
  statusText: {
    color: '#7f71a6',
    fontSize: 13,
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mineBubble: {
    backgroundColor: '#8f6bd1',
  },
  otherBubble: {
    backgroundColor: '#fbf8ff',
    borderWidth: 1,
    borderColor: '#d8caef',
  },
  messageSender: {
    fontSize: 12,
    marginBottom: 4,
  },
  messageSenderMine: {
    color: 'rgba(252, 250, 255, 0.78)',
  },
  messageSenderOther: {
    color: '#7f71a6',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMine: {
    color: '#fcfaff',
  },
  messageTextOther: {
    color: '#4f3a78',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  messageTimeMine: {
    color: 'rgba(252, 250, 255, 0.7)',
  },
  messageTimeOther: {
    color: '#8b7a9a',
  },
  composer: {
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#d4c3f0',
    backgroundColor: '#f4effd',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbf8ff',
    borderWidth: 1,
    borderColor: '#d8caef',
  },
  emojiText: {
    fontSize: 20,
  },
  emojiToggleButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbf8ff',
    borderWidth: 1,
    borderColor: '#d8caef',
  },
  emojiToggleButtonActive: {
    backgroundColor: '#efe8fb',
    borderColor: '#8f6bd1',
  },
  emojiToggleText: {
    fontSize: 22,
  },
  composerControls: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  messageInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: '#fcfaff',
    color: '#4f3a78',
    borderWidth: 1,
    borderColor: '#d7c7ef',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#8f6bd1',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    minHeight: 48,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fcfaff',
    fontWeight: '700',
  },
});
