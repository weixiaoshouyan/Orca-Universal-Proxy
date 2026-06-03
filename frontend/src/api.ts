import axios from 'axios';

const urlParams = new URLSearchParams(window.location.search);
let token = urlParams.get('token');
if (token) {
  sessionStorage.setItem('orca_token', token);
} else {
  token = sessionStorage.getItem('orca_token') || '';
}

export const api = axios.create({
  baseURL: 'http://127.0.0.1:18080',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
});

// Helper for SSE streams
export async function fetchEventSource(url: string, body: any, onMessage: (data: string) => void, onDone: () => void, onError: (err: any) => void) {
  try {
    const response = await fetch(`http://127.0.0.1:18080${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No reader");

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const dataStr = line.substring(6);
          try {
            onMessage(dataStr);
          } catch (e) {
            console.error("Parse error", e);
          }
        }
      }
    }
    onDone();
  } catch (e) {
    onError(e);
  }
}
