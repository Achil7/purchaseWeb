/**
 * embeddedConfig.example.js
 *
 * 사용법: 이 파일을 `embeddedConfig.js` 로 복사 후 실제 값으로 채우세요.
 * embeddedConfig.js 는 .gitignore 처리되어 절대 push되지 않습니다.
 */

const COMMON = {
  dbHost: 'YOUR_RDS_ENDPOINT.rds.amazonaws.com',
  dbPort: 5432,
  dbUser: 'YOUR_DB_USER',
  dbPassword: 'YOUR_DB_PASSWORD',
  rdsHost: 'YOUR_RDS_ENDPOINT.rds.amazonaws.com',
  rdsPort: 5432,
  sshHost: 'YOUR_EC2_PUBLIC_IP',
  sshUser: 'ubuntu',
  sshKeyContent: `-----BEGIN RSA PRIVATE KEY-----
... your .pem file content here ...
-----END RSA PRIVATE KEY-----
`
};

function getConfigForEnv(env) {
  if (env === 'main') {
    return { ...COMMON, env: 'main', dbName: 'YOUR_MAIN_DB_NAME' };
  }
  return { ...COMMON, env: 'test', dbName: 'YOUR_TEST_DB_NAME' };
}

module.exports = { getConfigForEnv };
