import axios from 'axios';

const urlParams = new URLSearchParams(window.location.search);
let token = urlParams.get('token');
if (token) {
  sessionStorage.setItem('orca_token', token);
} else {
  token = sessionStorage.getItem('orca_token') || '';
}

const isDev = window.location.port === '5173';
const API_BASE_URL = isDev ? 'http://127.0.0.1:18080' : window.location.origin;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { 'x-local-token': token } : {})
  }
});

// Helper for SSE streams
export async function fetchEventSource(url: string, body: any, onMessage: (data: string) => void, onDone: () => void, onError: (err: any) => void, signal?: AbortSignal) {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-local-token': token } : {})
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No reader");

    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          const dataStr = trimmed.substring(6);
          try {
            onMessage(dataStr);
          } catch (e) {
            console.error("Parse error", e);
          }
        }
      }
    }
    
    // Process residual buffer if any
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        const dataStr = trimmed.substring(6);
        try {
          onMessage(dataStr);
        } catch (e) {
          console.error("Parse error", e);
        }
      }
    }
    
    onDone();
  } catch (e) {
    onError(e);
  }
}
