// src/App.js
import React, { useRef, useEffect } from 'react';
import io from 'socket.io-client';

function App() {
  const videoRef = useRef(null);
  const peerConnections = useRef({});
  const socketRef = useRef();

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      console.log('Стример подключился к серверу сигнализации');
      socketRef.current.emit('broadcaster');
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;

        socketRef.current.on('watcher', (id) => {
          console.log('Стример получил нового зрителя:', id);
          const peerConnection = new RTCPeerConnection(configuration);
          peerConnections.current[id] = peerConnection;

          peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
              console.log('Стример отправляет ICE-кандидата зрителю:', id);
              socketRef.current.emit('candidate', id, event.candidate);
            }
          };

          peerConnection.oniceconnectionstatechange = () => {
            console.log(
              `ICE Connection State для зрителя ${id}:`,
              peerConnection.iceConnectionState
            );
            if (peerConnection.iceConnectionState === 'disconnected') {
              peerConnection.close();
              delete peerConnections.current[id];
            }
          };

          stream
            .getTracks()
            .forEach((track) => peerConnection.addTrack(track, stream));

          peerConnection
            .createOffer()
            .then((sdp) => peerConnection.setLocalDescription(sdp))
            .then(() => {
              console.log('Стример отправляет offer зрителю:', id);
              socketRef.current.emit('offer', id, peerConnection.localDescription);
            })
            .catch((error) => console.error('Ошибка при создании offer:', error));
        });

        socketRef.current.on('answer', (id, description) => {
          console.log('Стример получил answer от зрителя:', id);
          peerConnections.current[id]
            .setRemoteDescription(description)
            .catch((error) => console.error('Ошибка при установке RemoteDescription:', error));
        });

        socketRef.current.on('candidate', (id, candidate) => {
          console.log('Стример получил ICE-кандидата от зрителя:', id);
          peerConnections.current[id]
            .addIceCandidate(new RTCIceCandidate(candidate))
            .catch((e) => console.error('Ошибка при добавлении ICE-кандидата:', e));
        });

        socketRef.current.on('disconnectPeer', (id) => {
          console.log('Стример получил уведомление об отключении зрителя:', id);
          if (peerConnections.current[id]) {
            peerConnections.current[id].close();
            delete peerConnections.current[id];
          }
        });
      })
      .catch((error) => console.error('Ошибка доступа к медиа-устройствам.', error));

    return () => {
      Object.values(peerConnections.current).forEach((peerConnection) => {
        peerConnection.close();
      });
      socketRef.current.disconnect();
    };
  }, []);

  return (
    <div>
      <h1>Стример</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        style={{ width: '640px', height: '480px', backgroundColor: 'black' }}
      ></video>
    </div>
  );
}

export default App;
