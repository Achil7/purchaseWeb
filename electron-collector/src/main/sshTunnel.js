const net = require('net');
const { Client } = require('ssh2');
const log = require('electron-log');

/**
 * SSH 터널 매니저 (ssh2 라이브러리)
 *
 * 동작: PC의 임의 로컬 포트 → SSH → EC2 → RDS:5432
 * 반환된 localPort를 sequelize 의 host 'localhost', port=localPort 로 사용
 */
class SshTunnel {
  constructor() {
    this.client = null;
    this.server = null;
    this.localPort = null;
    this.connected = false;
  }

  async open(settings) {
    const { sshHost, sshUser = 'ubuntu', sshKeyContent, rdsHost, rdsPort = 5432 } = settings;
    if (!sshKeyContent) throw new Error('SSH 키가 등록되지 않았습니다');
    if (!sshHost) throw new Error('EC2 호스트가 비어있습니다');
    if (!rdsHost) throw new Error('RDS 호스트가 비어있습니다');

    return new Promise((resolve, reject) => {
      this.client = new Client();
      this.client.on('ready', () => {
        log.info('SSH client ready');
        const server = net.createServer((sock) => {
          this.client.forwardOut(
            sock.remoteAddress || '127.0.0.1',
            sock.remotePort || 0,
            rdsHost,
            Number(rdsPort),
            (err, stream) => {
              if (err) {
                log.error('forwardOut error:', err.message);
                sock.destroy();
                return;
              }
              sock.pipe(stream).pipe(sock);
            }
          );
        });

        server.on('error', (err) => {
          log.error('local server error', err.message);
        });

        server.listen(0, '127.0.0.1', () => {
          const { port } = server.address();
          this.localPort = port;
          this.server = server;
          this.connected = true;
          log.info(`SSH tunnel ready on localhost:${port}`);
          resolve({ localPort: port });
        });
      });

      this.client.on('error', (err) => {
        log.error('SSH error', err.message);
        if (!this.connected) reject(err);
      });

      this.client.on('end', () => {
        log.info('SSH client end');
        this.connected = false;
      });

      this.client.connect({
        host: sshHost,
        port: 22,
        username: sshUser,
        privateKey: sshKeyContent,
        readyTimeout: 15000,
        keepaliveInterval: 30000
      });
    });
  }

  close() {
    try { this.server && this.server.close(); } catch (_) { /* ignore */ }
    try { this.client && this.client.end(); } catch (_) { /* ignore */ }
    this.server = null;
    this.client = null;
    this.connected = false;
    this.localPort = null;
  }
}

async function testTunnel(settings) {
  const tunnel = new SshTunnel();
  try {
    const { localPort } = await tunnel.open(settings);
    return { success: true, localPort, close: () => tunnel.close() };
  } catch (err) {
    tunnel.close();
    return { success: false, error: err.message };
  }
}

module.exports = { SshTunnel, testTunnel };
