import { useEffect, useState } from 'react';
export function useSocketConnection(socket) {
  const [connected, setConnected] = useState(() => !!socket?.connected);
  const [isConnecting, setIsConnecting] = useState(() => !!socket && !socket.connected);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setConnected(true);
      setIsConnecting(false);
      setError(null);
      console.log('[Socket] Connected');
    };

    const handleDisconnect = () => {
      setConnected(false);
      setIsConnecting(false);
      console.log('[Socket] Disconnected');
    };

    const handleConnectError = (error) => {
      setError(error?.message || 'Connection error');
      setIsConnecting(false);
      console.error('[Socket] Connection error:', error);
    };

    const handleError = (error) => {
      setError(error?.message || 'Socket error');
      console.error('[Socket] Error:', error);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('error', handleError);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('error', handleError);
    };
  }, [socket]);

  return { connected, isConnecting, error };
}
