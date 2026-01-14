# 실시간 동기화 구현 계획 (Real-time Sync Implementation Plan)

**작성일**: 2026-01-13
**상태**: Backlog
**우선순위**: Medium-High
**예상 작업 기간**: 2-3주

---

## 목차
1. [개요](#개요)
2. [현재 아키텍처 분석](#현재-아키텍처-분석)
3. [목표 아키텍처](#목표-아키텍처)
4. [기술 스택](#기술-스택)
5. [데이터베이스 변경사항](#데이터베이스-변경사항)
6. [백엔드 구현](#백엔드-구현)
7. [프론트엔드 구현](#프론트엔드-구현)
8. [충돌 해결 전략](#충돌-해결-전략)
9. [구현 순서](#구현-순서)
10. [테스트 전략](#테스트-전략)
11. [성능 고려사항](#성능-고려사항)
12. [잠재적 이슈 및 해결방안](#잠재적-이슈-및-해결방안)

---

## 개요

### 목표
Google Sheets처럼 **실시간 자동 저장 및 다중 사용자 동기화**를 구현하여 사용자 경험을 개선합니다.

### 핵심 요구사항
- ✅ **실시간 동기화**: 같은 캠페인을 보는 모든 사용자(역할 무관) 간 실시간 반영
- ✅ **자동 저장**: 셀 수정 후 500ms 디바운스 후 자동 DB 저장
- ✅ **충돌 처리**: 마지막 수정 우선 + 노란색 하이라이트 + 토스트 알림
- ✅ **실시간 피드백**: 다른 사용자의 수정사항 즉시 표시
- ✅ **새로고침 불필요**: 페이지 새로고침 없이 데이터 동기화

### 사용자 시나리오
```
시나리오 1: 진행자 A와 진행자 B가 같은 캠페인을 동시에 열람
1. 진행자 A가 구매자 주문번호를 수정
2. 500ms 후 자동으로 DB에 저장
3. Socket.IO를 통해 진행자 B의 화면에 실시간 반영
4. 진행자 B의 해당 셀이 노란색으로 1초간 깜빡임
5. 토스트 알림: "진행자 A님이 주문번호를 수정했습니다"

시나리오 2: 진행자가 구매자를 추가하고 브랜드사가 즉시 확인
1. 진행자가 새 구매자 5명 추가
2. 자동 저장 → 브랜드사 화면에 실시간 반영
3. 브랜드사는 새로고침 없이 새 구매자 데이터 확인 가능

시나리오 3: 충돌 상황
1. 진행자 A가 셀 X를 "값1"로 수정 (아직 저장 전)
2. 진행자 B가 동시에 셀 X를 "값2"로 수정하고 먼저 저장
3. 진행자 A의 화면에서 셀 X가 노란색으로 변경 + 토스트 알림
4. 진행자 A가 저장 시도 시 경고: "다른 사용자가 수정했습니다. 덮어쓰시겠습니까?"
```

---

## 현재 아키텍처 분석

### 현재 저장 방식
```
사용자 입력 (Handsontable)
    ↓
afterChange 이벤트 → changedSlots/changedItems 추적
    ↓
Ctrl+S 또는 저장 버튼 클릭 (수동)
    ↓
PUT /item-slots/bulk/update (배치 API)
    ↓
로컬 상태 업데이트 (DB 재조회 없음)
    ↓
스크롤 위치 복원
```

### 문제점
- ❌ 수동 저장 필요 (Ctrl+S 또는 버튼)
- ❌ 다른 사용자의 변경사항을 알 수 없음
- ❌ 새로고침해야 최신 데이터 확인 가능
- ❌ 충돌 감지 불가 (나중에 저장한 사용자가 이전 데이터 덮어씀)
- ❌ 데이터 손실 가능 (저장 안하고 페이지 이탈)

---

## 목표 아키텍처

### 실시간 동기화 플로우
```
[사용자 A - 진행자]          [Socket.IO 서버]          [사용자 B - 브랜드사]
       |                              |                              |
   셀 수정 (주문번호)                 |                              |
       |                              |                              |
   500ms 디바운스                     |                              |
       |                              |                              |
   POST /api/sync/update-cell -----→ |                              |
       |                              |                              |
       |                       DB 업데이트                           |
       |                       (updated_at,                          |
       |                        last_edited_by)                      |
       |                              |                              |
       | ←----- 성공 응답 (200)       |                              |
       |                              |                              |
   로컬 상태 업데이트                 |                              |
       |                              |                              |
       |                      emit('cell_updated', {                |
       |                        campaignId: 123,                     |
       |                        slotId: 456,                         |
       |                        field: 'order_number',               |
       |                        value: '새값',                       |
       |                        updatedBy: 'UserA',                  |
       |                        timestamp: ...                       |
       |                      }) --------------------------------→ [Room: campaign_123]
       |                              |                              |
       |                              | -------------------------→ 수신
       |                              |                              |
       |                              |                   셀 노란색 하이라이트
       |                              |                   토스트 알림 표시
       |                              |                   로컬 데이터 업데이트
```

### 주요 컴포넌트

#### 1. Socket.IO 서버 (Backend)
- **역할**: 실시간 이벤트 브로드캐스팅
- **Room 관리**: `campaign_{campaignId}` 단위로 사용자 그룹화
- **이벤트 핸들러**: cell_updated, row_deleted, item_updated

#### 2. 자동 저장 시스템 (Frontend)
- **Debounce**: 500ms 후 자동 저장
- **Batch**: 여러 셀 동시 수정 시 묶어서 전송
- **낙관적 업데이트**: API 응답 전에 로컬 상태 먼저 업데이트

#### 3. 충돌 감지 시스템
- **Version Tracking**: updated_at 타임스탬프 비교
- **UI Feedback**: 노란색 하이라이트 + 토스트 알림
- **덮어쓰기 확인**: 충돌 발생 시 사용자에게 확인 요청

---

## 기술 스택

### Backend
```json
{
  "socket.io": "^4.7.0",
  "cors": "^2.8.5"
}
```

### Frontend
```json
{
  "socket.io-client": "^4.7.0",
  "lodash": "^4.17.21"  // debounce 함수용
}
```

### 기존 스택 (변경 없음)
- Backend: Express.js, Sequelize, PostgreSQL
- Frontend: React 19.2.0, Handsontable 14.7.0

---

## 데이터베이스 변경사항

### 1. Buyer 테이블 수정
```sql
ALTER TABLE buyers
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD COLUMN last_edited_by INTEGER REFERENCES users(id),
ADD COLUMN version INTEGER DEFAULT 1;

CREATE INDEX idx_buyers_updated_at ON buyers(updated_at);
```

### 2. ItemSlot 테이블 수정
```sql
ALTER TABLE item_slots
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD COLUMN last_edited_by INTEGER REFERENCES users(id),
ADD COLUMN version INTEGER DEFAULT 1;

CREATE INDEX idx_item_slots_updated_at ON item_slots(updated_at);
```

### 3. Item 테이블 수정
```sql
ALTER TABLE items
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD COLUMN last_edited_by INTEGER REFERENCES users(id),
ADD COLUMN version INTEGER DEFAULT 1;

CREATE INDEX idx_items_updated_at ON items(updated_at);
```

### 4. 마이그레이션 파일 생성
```bash
npx sequelize-cli migration:generate --name add-realtime-sync-fields
```

**파일 위치**: `backend/migrations/YYYYMMDDHHMMSS-add-realtime-sync-fields.js`

---

## 백엔드 구현

### 디렉토리 구조
```
backend/
├── src/
│   ├── socket/
│   │   ├── socketServer.js          # Socket.IO 서버 초기화
│   │   ├── handlers/
│   │   │   ├── campaignHandler.js   # 캠페인 room 관리
│   │   │   ├── syncHandler.js       # 실시간 동기화 이벤트
│   │   │   └── authHandler.js       # 소켓 인증
│   │   └── middleware/
│   │       └── socketAuth.js        # JWT 기반 소켓 인증
│   ├── controllers/
│   │   └── syncController.js        # 동기화 API 컨트롤러
│   └── routes/
│       └── sync.js                  # 동기화 API 라우트
└── server.js                         # Socket.IO 서버 통합
```

### 1. Socket.IO 서버 설정 (`backend/src/socket/socketServer.js`)

```javascript
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Socket.IO 서버 초기화
 * @param {Object} httpServer - Express HTTP 서버
 */
function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // 소켓 인증 미들웨어
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userName = decoded.username || decoded.name;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // 연결 처리
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] User ${socket.userId} (${socket.userName}) connected`);

    // 캠페인 room 참여
    socket.on('join_campaign', (campaignId) => {
      const roomName = `campaign_${campaignId}`;
      socket.join(roomName);
      console.log(`[Socket.IO] User ${socket.userId} joined ${roomName}`);

      // 참여 알림 (본인 제외)
      socket.to(roomName).emit('user_joined', {
        userId: socket.userId,
        userName: socket.userName,
        userRole: socket.userRole,
        campaignId,
        timestamp: new Date()
      });
    });

    // 캠페인 room 퇴장
    socket.on('leave_campaign', (campaignId) => {
      const roomName = `campaign_${campaignId}`;
      socket.leave(roomName);
      console.log(`[Socket.IO] User ${socket.userId} left ${roomName}`);

      // 퇴장 알림
      socket.to(roomName).emit('user_left', {
        userId: socket.userId,
        userName: socket.userName,
        campaignId,
        timestamp: new Date()
      });
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User ${socket.userId} disconnected`);
    });
  });

  return io;
}

/**
 * Socket.IO 인스턴스 반환
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

module.exports = { initSocketServer, getIO };
```

### 2. 동기화 API 컨트롤러 (`backend/src/controllers/syncController.js`)

```javascript
const { Buyer, ItemSlot, Item, User } = require('../models');
const { getIO } = require('../socket/socketServer');

/**
 * 단일 셀 업데이트 (자동 저장용)
 * POST /api/sync/update-cell
 */
exports.updateCell = async (req, res) => {
  const {
    type,         // 'buyer', 'slot', 'item'
    id,           // 레코드 ID
    field,        // 수정할 필드명
    value,        // 새 값
    campaignId,   // 캠페인 ID (room 식별용)
    version       // 클라이언트가 가진 버전 (충돌 감지용)
  } = req.body;

  const userId = req.user.id;
  const userName = req.user.username || req.user.name;

  try {
    let model, record;

    // 모델 선택
    switch (type) {
      case 'buyer':
        model = Buyer;
        break;
      case 'slot':
        model = ItemSlot;
        break;
      case 'item':
        model = Item;
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    // 레코드 조회
    record = await model.findByPk(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    // 버전 충돌 체크 (optimistic locking)
    if (version && record.version !== version) {
      return res.status(409).json({
        success: false,
        conflict: true,
        message: 'Version conflict detected',
        currentVersion: record.version,
        lastEditedBy: record.last_edited_by,
        updatedAt: record.updated_at
      });
    }

    // 필드 업데이트
    await record.update({
      [field]: value,
      last_edited_by: userId,
      version: record.version + 1
    });

    // Socket.IO로 다른 사용자들에게 브로드캐스트
    const io = getIO();
    const roomName = `campaign_${campaignId}`;

    io.to(roomName).emit('cell_updated', {
      type,
      id,
      field,
      value,
      campaignId,
      updatedBy: userId,
      updatedByName: userName,
      version: record.version,
      timestamp: record.updated_at,
      excludeSocketId: req.socketId // 본인은 제외 (선택사항)
    });

    res.json({
      success: true,
      version: record.version,
      updatedAt: record.updated_at
    });

  } catch (error) {
    console.error('Update cell error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * 배치 셀 업데이트 (여러 셀 동시 수정)
 * POST /api/sync/update-batch
 */
exports.updateBatch = async (req, res) => {
  const { updates, campaignId } = req.body; // updates = [{ type, id, field, value, version }, ...]
  const userId = req.user.id;
  const userName = req.user.username || req.user.name;

  const transaction = await require('../config/database').transaction();

  try {
    const results = [];
    const conflicts = [];

    for (const update of updates) {
      const { type, id, field, value, version } = update;
      let model, record;

      switch (type) {
        case 'buyer':
          model = Buyer;
          break;
        case 'slot':
          model = ItemSlot;
          break;
        case 'item':
          model = Item;
          break;
        default:
          continue;
      }

      record = await model.findByPk(id, { transaction });
      if (!record) continue;

      // 버전 충돌 체크
      if (version && record.version !== version) {
        conflicts.push({
          type, id, field,
          currentVersion: record.version,
          lastEditedBy: record.last_edited_by
        });
        continue;
      }

      // 업데이트
      await record.update({
        [field]: value,
        last_edited_by: userId,
        version: record.version + 1
      }, { transaction });

      results.push({
        type, id, field, value,
        version: record.version,
        updatedAt: record.updated_at
      });
    }

    await transaction.commit();

    // Socket.IO 브로드캐스트
    const io = getIO();
    const roomName = `campaign_${campaignId}`;

    io.to(roomName).emit('batch_updated', {
      updates: results,
      campaignId,
      updatedBy: userId,
      updatedByName: userName,
      timestamp: new Date()
    });

    res.json({
      success: true,
      results,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Update batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * 행 삭제 이벤트
 * DELETE /api/sync/delete-row
 */
exports.deleteRow = async (req, res) => {
  const { type, id, campaignId } = req.body;
  const userId = req.user.id;
  const userName = req.user.username || req.user.name;

  try {
    let model;
    switch (type) {
      case 'buyer':
        model = Buyer;
        break;
      case 'slot':
        model = ItemSlot;
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    const record = await model.findByPk(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    await record.destroy();

    // Socket.IO 브로드캐스트
    const io = getIO();
    const roomName = `campaign_${campaignId}`;

    io.to(roomName).emit('row_deleted', {
      type,
      id,
      campaignId,
      deletedBy: userId,
      deletedByName: userName,
      timestamp: new Date()
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Delete row error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
```

### 3. 동기화 API 라우트 (`backend/src/routes/sync.js`)

```javascript
const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { authenticate } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(authenticate);

// 단일 셀 업데이트
router.post('/update-cell', syncController.updateCell);

// 배치 업데이트
router.post('/update-batch', syncController.updateBatch);

// 행 삭제
router.delete('/delete-row', syncController.deleteRow);

module.exports = router;
```

### 4. 서버 통합 (`backend/server.js`)

```javascript
const express = require('express');
const http = require('http');
const { initSocketServer } = require('./src/socket/socketServer');

const app = express();

// Express 미들웨어 설정
app.use(express.json());
app.use(cors(/* ... */));

// 기존 라우트
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
// ... 기타 라우트

// 동기화 라우트 추가
app.use('/api/sync', require('./src/routes/sync'));

// HTTP 서버 생성
const httpServer = http.createServer(app);

// Socket.IO 초기화
initSocketServer(httpServer);

// 서버 시작
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server ready`);
});
```

---

## 프론트엔드 구현

### 디렉토리 구조
```
frontend/
├── src/
│   ├── services/
│   │   ├── socketService.js         # Socket.IO 클라이언트
│   │   └── syncService.js           # 동기화 API 호출
│   ├── hooks/
│   │   ├── useAutoSave.js           # 자동 저장 훅
│   │   └── useRealtimeSync.js       # 실시간 동기화 훅
│   └── components/
│       ├── operator/
│       │   └── OperatorItemSheet.js # 실시간 기능 통합
│       ├── sales/
│       │   └── SalesItemSheet.js
│       └── brand/
│           └── BrandItemSheet.js
```

### 1. Socket.IO 클라이언트 서비스 (`frontend/src/services/socketService.js`)

```javascript
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentCampaignId = null;
  }

  /**
   * Socket.IO 연결
   * @param {string} token - JWT 토큰
   */
  connect(token) {
    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });
  }

  /**
   * 캠페인 room 참여
   * @param {number} campaignId
   */
  joinCampaign(campaignId) {
    if (!this.socket?.connected) {
      console.error('[Socket] Not connected');
      return;
    }

    if (this.currentCampaignId === campaignId) {
      return;
    }

    // 이전 room 퇴장
    if (this.currentCampaignId) {
      this.socket.emit('leave_campaign', this.currentCampaignId);
    }

    // 새 room 참여
    this.socket.emit('join_campaign', campaignId);
    this.currentCampaignId = campaignId;
    console.log(`[Socket] Joined campaign ${campaignId}`);
  }

  /**
   * 캠페인 room 퇴장
   */
  leaveCampaign() {
    if (this.currentCampaignId && this.socket?.connected) {
      this.socket.emit('leave_campaign', this.currentCampaignId);
      this.currentCampaignId = null;
    }
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트명
   * @param {Function} callback - 콜백 함수
   */
  on(event, callback) {
    if (!this.socket) {
      console.error('[Socket] Socket not initialized');
      return;
    }
    this.socket.on(event, callback);
  }

  /**
   * 이벤트 리스너 제거
   * @param {string} event - 이벤트명
   * @param {Function} callback - 콜백 함수
   */
  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  /**
   * 연결 종료
   */
  disconnect() {
    if (this.socket) {
      this.leaveCampaign();
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected() {
    return this.connected && this.socket?.connected;
  }
}

// 싱글톤 인스턴스
const socketService = new SocketService();

export default socketService;
```

### 2. 동기화 API 서비스 (`frontend/src/services/syncService.js`)

```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * 단일 셀 업데이트
 */
export const updateCell = async (data) => {
  const response = await axios.post(`${API_URL}/sync/update-cell`, data);
  return response.data;
};

/**
 * 배치 셀 업데이트
 */
export const updateBatch = async (updates, campaignId) => {
  const response = await axios.post(`${API_URL}/sync/update-batch`, {
    updates,
    campaignId
  });
  return response.data;
};

/**
 * 행 삭제
 */
export const deleteRow = async (type, id, campaignId) => {
  const response = await axios.delete(`${API_URL}/sync/delete-row`, {
    data: { type, id, campaignId }
  });
  return response.data;
};

export default {
  updateCell,
  updateBatch,
  deleteRow
};
```

### 3. 자동 저장 훅 (`frontend/src/hooks/useAutoSave.js`)

```javascript
import { useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import syncService from '../services/syncService';

/**
 * 자동 저장 훅
 * @param {number} campaignId - 캠페인 ID
 * @param {number} delay - 디바운스 딜레이 (ms)
 */
export const useAutoSave = (campaignId, delay = 500) => {
  const pendingChanges = useRef(new Map()); // key: `${type}_${id}_${field}`, value: { type, id, field, value, version }
  const isSaving = useRef(false);

  /**
   * 변경사항 큐에 추가
   */
  const queueChange = useCallback((type, id, field, value, version) => {
    const key = `${type}_${id}_${field}`;
    pendingChanges.current.set(key, { type, id, field, value, version });
  }, []);

  /**
   * 저장 실행 (디바운스됨)
   */
  const executeSave = useCallback(
    debounce(async () => {
      if (isSaving.current || pendingChanges.current.size === 0) {
        return;
      }

      isSaving.current = true;
      const updates = Array.from(pendingChanges.current.values());
      pendingChanges.current.clear();

      try {
        const response = await syncService.updateBatch(updates, campaignId);

        if (response.conflicts && response.conflicts.length > 0) {
          // 충돌 발생 시 처리
          console.warn('[AutoSave] Conflicts detected:', response.conflicts);
          // TODO: 충돌 UI 표시
        }

        console.log('[AutoSave] Saved successfully:', response.results.length, 'changes');
      } catch (error) {
        console.error('[AutoSave] Failed to save:', error);
        // 실패한 변경사항 다시 큐에 추가 (재시도 로직)
        updates.forEach(update => {
          const key = `${update.type}_${update.id}_${update.field}`;
          pendingChanges.current.set(key, update);
        });
      } finally {
        isSaving.current = false;
      }
    }, delay),
    [campaignId, delay]
  );

  /**
   * 셀 변경 처리
   */
  const handleCellChange = useCallback((type, id, field, value, version) => {
    queueChange(type, id, field, value, version);
    executeSave();
  }, [queueChange, executeSave]);

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      executeSave.cancel(); // 디바운스 취소
      pendingChanges.current.clear();
    };
  }, [executeSave]);

  return { handleCellChange, isSaving: isSaving.current };
};
```

### 4. 실시간 동기화 훅 (`frontend/src/hooks/useRealtimeSync.js`)

```javascript
import { useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';

/**
 * 실시간 동기화 훅
 * @param {number} campaignId - 캠페인 ID
 * @param {Function} onCellUpdated - 셀 업데이트 콜백
 * @param {Function} onRowDeleted - 행 삭제 콜백
 * @param {Function} onBatchUpdated - 배치 업데이트 콜백
 */
export const useRealtimeSync = (
  campaignId,
  onCellUpdated,
  onRowDeleted,
  onBatchUpdated
) => {
  const handlersRegistered = useRef(false);

  /**
   * 셀 업데이트 이벤트 핸들러
   */
  const handleCellUpdated = useCallback((data) => {
    const { type, id, field, value, updatedByName, version, timestamp } = data;

    console.log(`[Realtime] Cell updated by ${updatedByName}:`, { type, id, field, value });

    if (onCellUpdated) {
      onCellUpdated({ type, id, field, value, version, timestamp, updatedByName });
    }
  }, [onCellUpdated]);

  /**
   * 배치 업데이트 이벤트 핸들러
   */
  const handleBatchUpdated = useCallback((data) => {
    const { updates, updatedByName } = data;

    console.log(`[Realtime] Batch updated by ${updatedByName}:`, updates.length, 'changes');

    if (onBatchUpdated) {
      onBatchUpdated({ updates, updatedByName });
    }
  }, [onBatchUpdated]);

  /**
   * 행 삭제 이벤트 핸들러
   */
  const handleRowDeleted = useCallback((data) => {
    const { type, id, deletedByName } = data;

    console.log(`[Realtime] Row deleted by ${deletedByName}:`, { type, id });

    if (onRowDeleted) {
      onRowDeleted({ type, id, deletedByName });
    }
  }, [onRowDeleted]);

  /**
   * 사용자 참여/퇴장 이벤트 핸들러
   */
  const handleUserJoined = useCallback((data) => {
    console.log(`[Realtime] ${data.userName} joined the campaign`);
    // TODO: 사용자 목록 UI 업데이트
  }, []);

  const handleUserLeft = useCallback((data) => {
    console.log(`[Realtime] ${data.userName} left the campaign`);
    // TODO: 사용자 목록 UI 업데이트
  }, []);

  /**
   * Socket.IO 이벤트 리스너 등록
   */
  useEffect(() => {
    if (!campaignId || handlersRegistered.current) {
      return;
    }

    // 캠페인 room 참여
    socketService.joinCampaign(campaignId);

    // 이벤트 리스너 등록
    socketService.on('cell_updated', handleCellUpdated);
    socketService.on('batch_updated', handleBatchUpdated);
    socketService.on('row_deleted', handleRowDeleted);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);

    handlersRegistered.current = true;

    // 정리 함수
    return () => {
      socketService.off('cell_updated', handleCellUpdated);
      socketService.off('batch_updated', handleBatchUpdated);
      socketService.off('row_deleted', handleRowDeleted);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
      socketService.leaveCampaign();
      handlersRegistered.current = false;
    };
  }, [
    campaignId,
    handleCellUpdated,
    handleBatchUpdated,
    handleRowDeleted,
    handleUserJoined,
    handleUserLeft
  ]);

  return {
    isConnected: socketService.isConnected()
  };
};
```

### 5. 컴포넌트 통합 예시 (`frontend/src/components/operator/OperatorItemSheet.js`)

```javascript
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import socketService from '../../services/socketService';
import { Snackbar, Alert } from '@mui/material';

function OperatorItemSheet({ campaignId, /* ... */ }) {
  const hotRef = useRef(null);
  const [slots, setSlots] = useState([]);
  const [highlightedCells, setHighlightedCells] = useState(new Set()); // 노란색 하이라이트할 셀들
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // 자동 저장 훅
  const { handleCellChange, isSaving } = useAutoSave(campaignId, 500);

  // 실시간 동기화 콜백들
  const onCellUpdated = useCallback(({ type, id, field, value, version, updatedByName }) => {
    // 로컬 데이터 업데이트
    setSlots(prevSlots => prevSlots.map(slot => {
      if (type === 'slot' && slot.id === id) {
        return { ...slot, [field]: value, version };
      }
      if (type === 'buyer' && slot.buyer?.id === id) {
        return { ...slot, buyer: { ...slot.buyer, [field]: value, version } };
      }
      return slot;
    }));

    // 노란색 하이라이트 추가
    const cellKey = `${type}_${id}_${field}`;
    setHighlightedCells(prev => new Set(prev).add(cellKey));

    // 1초 후 하이라이트 제거
    setTimeout(() => {
      setHighlightedCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }, 1000);

    // 토스트 알림
    setSnackbar({
      open: true,
      message: `${updatedByName}님이 ${field}를 수정했습니다`,
      severity: 'info'
    });

    // Handsontable 리렌더
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      hot.render();
    }
  }, []);

  const onBatchUpdated = useCallback(({ updates, updatedByName }) => {
    // 배치 업데이트 처리
    setSlots(prevSlots => {
      let updatedSlots = [...prevSlots];
      updates.forEach(({ type, id, field, value, version }) => {
        updatedSlots = updatedSlots.map(slot => {
          if (type === 'slot' && slot.id === id) {
            return { ...slot, [field]: value, version };
          }
          if (type === 'buyer' && slot.buyer?.id === id) {
            return { ...slot, buyer: { ...slot.buyer, [field]: value, version } };
          }
          return slot;
        });
      });
      return updatedSlots;
    });

    setSnackbar({
      open: true,
      message: `${updatedByName}님이 ${updates.length}개 항목을 수정했습니다`,
      severity: 'info'
    });

    const hot = hotRef.current?.hotInstance;
    if (hot) hot.render();
  }, []);

  const onRowDeleted = useCallback(({ type, id, deletedByName }) => {
    // 행 삭제 처리
    setSlots(prevSlots => prevSlots.filter(slot => {
      if (type === 'slot' && slot.id === id) return false;
      if (type === 'buyer' && slot.buyer?.id === id) {
        return { ...slot, buyer: null }; // buyer만 제거
      }
      return true;
    }));

    setSnackbar({
      open: true,
      message: `${deletedByName}님이 항목을 삭제했습니다`,
      severity: 'warning'
    });

    const hot = hotRef.current?.hotInstance;
    if (hot) hot.render();
  }, []);

  // 실시간 동기화 훅
  const { isConnected } = useRealtimeSync(
    campaignId,
    onCellUpdated,
    onRowDeleted,
    onBatchUpdated
  );

  // Socket.IO 연결 (컴포넌트 마운트 시)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      socketService.connect(token);
    }

    return () => {
      // 언마운트 시 연결 유지 (다른 페이지에서도 사용 가능)
      // socketService.disconnect();
    };
  }, []);

  // Handsontable afterChange 핸들러
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData') return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      const hot = hotRef.current?.hotInstance;
      const rowData = hot.getSourceDataAtRow(row);

      // 행 타입 확인
      if (rowData._rowType === 'BUYER_DATA') {
        const slotId = rowData._slotId;
        const buyerId = rowData._buyerId;

        // 필드 매핑
        const fieldMap = {
          col6: 'order_number',
          col7: 'buyer_name',
          col8: 'recipient_name',
          col9: 'user_id',
          col10: 'phone_number',
          col11: 'address',
          col12: 'bank_account',
          col13: 'amount',
          col14: 'tracking_number'
        };

        const field = fieldMap[prop];
        if (!field) return;

        const type = buyerId ? 'buyer' : 'slot';
        const id = buyerId || slotId;
        const version = rowData._version;

        // 자동 저장 트리거 (500ms 디바운스)
        handleCellChange(type, id, field, newValue, version);
      }
    });
  }, [handleCellChange]);

  // 커스텀 셀 렌더러 (노란색 하이라이트 표시)
  const customCellRenderer = useCallback((instance, td, row, col, prop, value, cellProperties) => {
    // 기본 렌더링
    td.innerHTML = value || '';

    // 노란색 하이라이트 체크
    const rowData = instance.getSourceDataAtRow(row);
    if (rowData._rowType === 'BUYER_DATA') {
      const type = rowData._buyerId ? 'buyer' : 'slot';
      const id = rowData._buyerId || rowData._slotId;
      const fieldMap = {
        col6: 'order_number',
        col7: 'buyer_name',
        // ... 나머지 매핑
      };
      const field = fieldMap[prop];
      const cellKey = `${type}_${id}_${field}`;

      if (highlightedCells.has(cellKey)) {
        td.style.backgroundColor = '#fff59d'; // 노란색
        td.style.transition = 'background-color 0.3s ease';
      }
    }

    return td;
  }, [highlightedCells]);

  return (
    <>
      {/* 연결 상태 표시 */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          실시간 동기화 연결이 끊어졌습니다. 재연결 시도 중...
        </Alert>
      )}

      {/* Handsontable */}
      <HotTable
        ref={hotRef}
        data={tableData}
        afterChange={handleAfterChange}
        cells={(row, col) => ({
          renderer: customCellRenderer
        })}
        // ... 기타 설정
      />

      {/* 토스트 알림 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 저장 중 표시 */}
      {isSaving && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
          <Alert severity="info">저장 중...</Alert>
        </Box>
      )}
    </>
  );
}

export default OperatorItemSheet;
```

---

## 충돌 해결 전략

### 1. 낙관적 잠금 (Optimistic Locking)

**원리**: 각 레코드에 `version` 필드를 두고, 업데이트 시 버전을 증가시킵니다. 클라이언트가 저장할 때 자신이 가진 버전과 DB의 버전이 다르면 충돌로 판단합니다.

**플로우**:
```
1. 사용자 A가 레코드 조회 (version: 5)
2. 사용자 B가 같은 레코드 조회 (version: 5)
3. 사용자 B가 먼저 수정 → version 6으로 업데이트
4. 사용자 A가 수정 시도 → version 5로 요청
5. 서버: version 불일치 감지 (현재 DB는 version 6)
6. 409 Conflict 응답 반환
7. 사용자 A 화면에 충돌 알림 표시
```

### 2. 충돌 UI

**노란색 하이라이트**:
- 다른 사용자가 수정한 셀은 1초간 노란색으로 깜빡임
- CSS transition으로 부드러운 애니메이션

**토스트 알림**:
```javascript
"진행자 홍길동님이 주문번호를 수정했습니다"
"영업사 김철수님이 5개 항목을 수정했습니다"
```

**충돌 다이얼로그** (버전 불일치 시):
```
┌─────────────────────────────────────────┐
│  충돌 감지                               │
├─────────────────────────────────────────┤
│  다른 사용자(진행자 홍길동)가 이 셀을    │
│  먼저 수정했습니다.                      │
│                                         │
│  현재 값: "8100156654664"               │
│  내 값:   "8100156654665"               │
│                                         │
│  [ 현재 값 유지 ]  [ 내 값으로 덮어쓰기 ] │
└─────────────────────────────────────────┘
```

### 3. 마지막 수정 우선 (Last-Write-Wins)

기본적으로 마지막에 저장한 사용자의 값이 적용됩니다. 단, 충돌 발생 시 사용자에게 알림을 주어 인지하도록 합니다.

---

## 구현 순서

### Phase 1: 기반 구조 (1주차)

**1.1 데이터베이스 마이그레이션**
- [ ] `updated_at`, `last_edited_by`, `version` 컬럼 추가
- [ ] 마이그레이션 파일 작성 및 실행
- [ ] 기존 데이터에 기본값 설정

**1.2 Socket.IO 서버 설정**
- [ ] `socket.io` 패키지 설치
- [ ] `backend/src/socket/socketServer.js` 작성
- [ ] JWT 기반 소켓 인증 미들웨어 구현
- [ ] Room 관리 로직 구현
- [ ] `server.js`에 Socket.IO 통합

**1.3 동기화 API 구현**
- [ ] `backend/src/controllers/syncController.js` 작성
- [ ] `POST /api/sync/update-cell` 엔드포인트
- [ ] `POST /api/sync/update-batch` 엔드포인트
- [ ] `DELETE /api/sync/delete-row` 엔드포인트
- [ ] 버전 충돌 감지 로직 구현

**1.4 테스트**
- [ ] Postman으로 API 테스트
- [ ] Socket.IO 연결 테스트
- [ ] Room join/leave 테스트
- [ ] 버전 충돌 시나리오 테스트

---

### Phase 2: 프론트엔드 기본 통합 (1주차)

**2.1 Socket.IO 클라이언트**
- [ ] `socket.io-client` 패키지 설치
- [ ] `frontend/src/services/socketService.js` 작성
- [ ] AuthContext에 소켓 연결 통합 (로그인 시 자동 연결)

**2.2 동기화 서비스**
- [ ] `frontend/src/services/syncService.js` 작성
- [ ] Axios interceptor에 에러 처리 추가

**2.3 커스텀 훅**
- [ ] `frontend/src/hooks/useAutoSave.js` 작성
- [ ] `frontend/src/hooks/useRealtimeSync.js` 작성

**2.4 테스트**
- [ ] 브라우저 콘솔에서 소켓 연결 확인
- [ ] 자동 저장 디바운스 동작 확인
- [ ] 실시간 이벤트 수신 확인

---

### Phase 3: OperatorItemSheet 통합 (3-4일)

**3.1 자동 저장 통합**
- [ ] `useAutoSave` 훅 적용
- [ ] `afterChange` 핸들러에서 자동 저장 트리거
- [ ] 수동 저장 버튼 비활성화 (선택사항)

**3.2 실시간 동기화 통합**
- [ ] `useRealtimeSync` 훅 적용
- [ ] `onCellUpdated` 콜백 구현 (로컬 상태 업데이트)
- [ ] `onBatchUpdated` 콜백 구현
- [ ] `onRowDeleted` 콜백 구현

**3.3 UI 피드백**
- [ ] 노란색 하이라이트 렌더러 구현
- [ ] 토스트 알림 추가
- [ ] 연결 상태 표시 추가
- [ ] 저장 중 인디케이터 추가

**3.4 테스트**
- [ ] 2명의 진행자가 동시에 같은 캠페인 편집
- [ ] 자동 저장 확인
- [ ] 실시간 동기화 확인
- [ ] 충돌 시나리오 테스트

---

### Phase 4: SalesItemSheet 및 BrandItemSheet 통합 (2-3일)

**4.1 SalesItemSheet**
- [ ] 자동 저장 통합
- [ ] 실시간 동기화 통합
- [ ] UI 피드백 추가
- [ ] 테스트

**4.2 BrandItemSheet (읽기 전용)**
- [ ] 실시간 동기화만 적용 (자동 저장 없음)
- [ ] UI 피드백 추가
- [ ] 테스트

---

### Phase 5: 충돌 처리 고도화 (2-3일)

**5.1 충돌 다이얼로그**
- [ ] ConflictDialog 컴포넌트 작성
- [ ] 충돌 발생 시 다이얼로그 표시
- [ ] "현재 값 유지" / "덮어쓰기" 옵션 제공

**5.2 충돌 이력**
- [ ] 최근 충돌 이력 저장 (선택사항)
- [ ] 충돌 알림 센터 (선택사항)

**5.3 테스트**
- [ ] 동시 편집 충돌 시나리오
- [ ] 버전 불일치 처리 확인

---

### Phase 6: 성능 최적화 및 QA (3-4일)

**6.1 성능 최적화**
- [ ] 배치 업데이트 병합 로직 개선
- [ ] Socket.IO 이벤트 throttling
- [ ] 불필요한 리렌더 방지 (React.memo, useMemo)

**6.2 통합 테스트**
- [ ] 10명 동시 접속 테스트
- [ ] 네트워크 단절 시 재연결 테스트
- [ ] 대용량 데이터 (1000+ 행) 성능 테스트

**6.3 버그 수정 및 안정화**
- [ ] QA 피드백 반영
- [ ] 엣지 케이스 처리

---

## 테스트 전략

### 단위 테스트

**Backend (Jest + Supertest)**
```javascript
// syncController.test.js
describe('Sync Controller', () => {
  test('단일 셀 업데이트', async () => {
    const response = await request(app)
      .post('/api/sync/update-cell')
      .send({
        type: 'buyer',
        id: 1,
        field: 'order_number',
        value: '8100156654664',
        campaignId: 10,
        version: 1
      })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.version).toBe(2);
  });

  test('버전 충돌 감지', async () => {
    // 사용자 A가 먼저 업데이트 (version 1 → 2)
    await request(app)
      .post('/api/sync/update-cell')
      .send({ /* ... version: 1 */ });

    // 사용자 B가 구버전으로 업데이트 시도 (version 1)
    const response = await request(app)
      .post('/api/sync/update-cell')
      .send({ /* ... version: 1 */ });

    expect(response.status).toBe(409);
    expect(response.body.conflict).toBe(true);
  });
});
```

**Frontend (Jest + React Testing Library)**
```javascript
// useAutoSave.test.js
describe('useAutoSave Hook', () => {
  test('디바운스 후 자동 저장', async () => {
    const { result } = renderHook(() => useAutoSave(123, 500));

    // 여러 번 호출
    act(() => {
      result.current.handleCellChange('buyer', 1, 'order_number', 'value1', 1);
      result.current.handleCellChange('buyer', 1, 'buyer_name', 'value2', 1);
    });

    // 500ms 대기
    await waitFor(() => {
      expect(syncService.updateBatch).toHaveBeenCalledTimes(1);
    }, { timeout: 600 });
  });
});
```

### 통합 테스트

**시나리오 1: 2명의 사용자 동시 편집**
```
1. 브라우저 A (진행자 A)와 브라우저 B (진행자 B) 동시 접속
2. 같은 캠페인 열기
3. 진행자 A가 셀 X 수정 → 자동 저장
4. 진행자 B의 화면에서 셀 X가 노란색으로 변경되는지 확인
5. 진행자 B가 셀 Y 수정 → 자동 저장
6. 진행자 A의 화면에서 셀 Y가 노란색으로 변경되는지 확인
```

**시나리오 2: 충돌 발생**
```
1. 진행자 A와 진행자 B가 같은 셀을 동시에 수정 (네트워크 지연 시뮬레이션)
2. 진행자 B가 먼저 저장 완료
3. 진행자 A가 저장 시도 시 충돌 다이얼로그 표시되는지 확인
4. "덮어쓰기" 선택 시 진행자 A의 값으로 업데이트되는지 확인
```

**시나리오 3: 네트워크 단절 및 재연결**
```
1. 정상 연결 상태에서 편집
2. 네트워크 차단 (브라우저 devtools → Offline)
3. 편집 시도 → 연결 끊김 알림 표시 확인
4. 네트워크 복구
5. 자동 재연결 확인
6. 재연결 후 편집 가능 여부 확인
```

### 성능 테스트

**부하 테스트 (Artillery 또는 K6)**
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:5000'
  phases:
    - duration: 60
      arrivalRate: 10  # 초당 10명 접속
scenarios:
  - name: 'Real-time editing'
    engine: socketio
    flow:
      - emit:
          channel: 'join_campaign'
          data: { campaignId: 123 }
      - think: 2
      - emit:
          channel: 'cell_updated'
          data: { /* ... */ }
      - think: 5
```

**결과 목표**:
- 50명 동시 접속: 응답 시간 < 200ms
- 100명 동시 접속: 응답 시간 < 500ms
- Socket.IO 이벤트 전파: < 100ms

---

## 성능 고려사항

### 1. 배치 업데이트 최적화

**문제**: 여러 셀을 빠르게 수정하면 API 요청이 과도하게 발생
**해결**:
- Debounce 500ms 적용
- 같은 디바운스 윈도우 내 변경사항을 묶어서 배치 전송
- 최대 배치 크기 제한 (예: 50개 항목)

### 2. Socket.IO 이벤트 Throttling

**문제**: 대량의 실시간 이벤트가 동시에 발생하면 프론트엔드 렌더링 병목
**해결**:
- 이벤트를 100ms 단위로 버퍼링
- 같은 셀의 여러 업데이트는 마지막 것만 적용
- requestAnimationFrame으로 렌더링 최적화

### 3. Handsontable 리렌더 최소화

**문제**: 실시간 업데이트마다 전체 테이블 리렌더 시 성능 저하
**해결**:
- `hot.setDataAtCell(row, col, value)` 사용 (특정 셀만 업데이트)
- `hot.render()` 대신 `hot.validateCells()` 사용 (일부 경우)
- React.memo로 컴포넌트 불필요한 리렌더 방지

### 4. 메모리 관리

**문제**: 장시간 사용 시 이벤트 리스너 누적, 메모리 누수
**해결**:
- useEffect cleanup 함수에서 이벤트 리스너 제거
- 컴포넌트 언마운트 시 소켓 room 퇴장
- WeakMap 사용하여 순환 참조 방지

---

## 잠재적 이슈 및 해결방안

### 1. 무한 루프 방지

**문제**:
```
A가 셀 업데이트 → 서버에 저장 → Socket.IO 브로드캐스트 → A가 수신 → 다시 로컬 업데이트 → 서버에 저장 → 무한 루프
```

**해결방안**:
```javascript
// 방법 1: 자신의 업데이트는 브로드캐스트에서 제외
io.to(roomName).except(socket.id).emit('cell_updated', data);

// 방법 2: 클라이언트에서 자신의 업데이트는 무시
if (data.updatedBy === currentUserId) {
  return; // 자신의 업데이트는 처리하지 않음
}

// 방법 3: 플래그 사용
const isLocalUpdate = useRef(false);

const handleCellChange = (change) => {
  isLocalUpdate.current = true;
  // 저장 로직
  setTimeout(() => { isLocalUpdate.current = false; }, 100);
};

const onCellUpdated = (data) => {
  if (isLocalUpdate.current) return;
  // 원격 업데이트 처리
};
```

**권장**: 방법 1 + 방법 2 조합 (이중 안전장치)

---

### 2. 연결 끊김 처리

**문제**: 네트워크 단절 시 데이터 손실 가능

**해결방안**:
```javascript
// 자동 재연결 설정
const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// 재연결 시 room 재참여
socket.on('reconnect', () => {
  if (currentCampaignId) {
    socket.emit('join_campaign', currentCampaignId);
  }
  // 마지막 업데이트 이후 변경사항 재동기화
  syncMissedUpdates();
});

// 연결 끊김 알림
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // 서버에서 강제 종료 → 재로그인 필요
    showAlert('서버 연결이 끊어졌습니다. 페이지를 새로고침하세요.');
  } else {
    // 네트워크 문제 → 자동 재연결 대기
    showAlert('네트워크 연결이 불안정합니다. 재연결 시도 중...');
  }
});
```

---

### 3. 대규모 데이터 동기화

**문제**: 1000+ 행의 시트에서 실시간 동기화 시 성능 저하

**해결방안**:
- **가상 스크롤링**: Handsontable의 가상 스크롤 활용 (기본 지원)
- **증분 업데이트**: 전체 데이터 재로드 대신 변경된 행만 업데이트
- **페이징**: 한 번에 100개 행만 로드 (선택사항)

---

### 4. 보안 고려사항

**문제**: Socket.IO를 통한 무단 접근 또는 데이터 변조

**해결방안**:
```javascript
// JWT 기반 소켓 인증
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, JWT_SECRET);
  socket.userId = decoded.id;
  next();
});

// Room 참여 시 권한 체크
socket.on('join_campaign', async (campaignId) => {
  // 사용자가 해당 캠페인에 접근 권한이 있는지 확인
  const hasAccess = await checkCampaignAccess(socket.userId, campaignId);
  if (!hasAccess) {
    socket.emit('error', { message: 'Unauthorized' });
    return;
  }
  socket.join(`campaign_${campaignId}`);
});

// API 레벨에서도 권한 재검증
exports.updateCell = async (req, res) => {
  const { campaignId } = req.body;
  const hasAccess = await checkCampaignAccess(req.user.id, campaignId);
  if (!hasAccess) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  // 업데이트 로직
};
```

---

### 5. 데이터 일관성

**문제**: 네트워크 지연으로 인한 업데이트 순서 뒤바뀜

**해결방안**:
```javascript
// 타임스탬프 기반 정렬
const updates = [
  { field: 'order_number', value: 'A', timestamp: '2026-01-13T10:00:01Z' },
  { field: 'order_number', value: 'B', timestamp: '2026-01-13T10:00:00Z' }
];

// 최신 타임스탬프만 적용
updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
const latestUpdate = updates[0]; // value: 'A'

// DB 레벨에서도 검증
UPDATE buyers
SET order_number = 'B', updated_at = '2026-01-13T10:00:00Z'
WHERE id = 123 AND updated_at < '2026-01-13T10:00:00Z'; -- 더 최신 데이터가 있으면 업데이트 안함
```

---

## 추가 기능 (선택사항)

### 1. 현재 편집 중인 사용자 표시

**기능**: 같은 캠페인을 보고 있는 사용자 목록 표시

```javascript
// 사용자 참여 이벤트
socket.on('user_joined', ({ userName, userRole }) => {
  setActiveUsers(prev => [...prev, { userName, userRole }]);
});

socket.on('user_left', ({ userName }) => {
  setActiveUsers(prev => prev.filter(u => u.userName !== userName));
});

// UI 표시
<Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
  {activeUsers.map(user => (
    <Chip key={user.userName} label={user.userName} size="small" color="primary" />
  ))}
</Box>
```

### 2. 셀 단위 잠금 (Cell Locking)

**기능**: 한 사용자가 편집 중인 셀은 다른 사용자가 편집 불가

```javascript
// 편집 시작 시 잠금
socket.emit('lock_cell', { campaignId, type, id, field });

// 편집 종료 시 잠금 해제
socket.emit('unlock_cell', { campaignId, type, id, field });

// 다른 사용자는 잠긴 셀 편집 불가
if (lockedCells.has(cellKey)) {
  td.style.backgroundColor = '#ffcccc'; // 빨간색
  cellProperties.readOnly = true;
}
```

### 3. 변경 이력 (Change History)

**기능**: 각 셀의 변경 이력을 저장하여 롤백 가능

```sql
CREATE TABLE change_history (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);
```

### 4. 오프라인 모드

**기능**: 네트워크 단절 시 로컬에 변경사항 저장 후 재연결 시 동기화

```javascript
// IndexedDB에 변경사항 저장
const saveOfflineChange = async (change) => {
  const db = await openDB('offline-changes', 1);
  await db.add('changes', change);
};

// 재연결 시 동기화
socket.on('reconnect', async () => {
  const db = await openDB('offline-changes', 1);
  const offlineChanges = await db.getAll('changes');

  for (const change of offlineChanges) {
    await syncService.updateCell(change);
    await db.delete('changes', change.id);
  }
});
```

---

## 배포 체크리스트

### Backend
- [ ] Socket.IO CORS 설정 확인 (프로덕션 도메인)
- [ ] 환경 변수 설정 (JWT_SECRET, DB 연결 정보)
- [ ] 데이터베이스 마이그레이션 실행
- [ ] Socket.IO 포트 방화벽 오픈 (EC2 보안 그룹)
- [ ] Nginx 웹소켓 프록시 설정

```nginx
# /etc/nginx/sites-available/default
location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Frontend
- [ ] 환경 변수 설정 (REACT_APP_SOCKET_URL)
- [ ] Socket.IO 연결 URL 프로덕션으로 변경
- [ ] 빌드 및 배포
- [ ] 브라우저 콘솔에서 웹소켓 연결 확인

### 테스트
- [ ] 프로덕션 환경에서 2개 브라우저 동시 편집 테스트
- [ ] 다른 네트워크에서 접속 테스트
- [ ] 모바일 브라우저 테스트

---

## 참고 자료

### Socket.IO 공식 문서
- https://socket.io/docs/v4/

### React + Socket.IO 통합
- https://socket.io/how-to/use-with-react

### Optimistic Locking
- https://en.wikipedia.org/wiki/Optimistic_concurrency_control

### Handsontable 성능 최적화
- https://handsontable.com/docs/performance/

---

## 결론

이 계획서는 Google Sheets 스타일의 실시간 동기화 기능을 CampManager에 추가하기 위한 상세한 로드맵입니다.

**예상 효과**:
- ✅ 사용자 경험 대폭 개선 (수동 저장 불필요)
- ✅ 데이터 손실 방지 (자동 저장)
- ✅ 실시간 협업 가능 (여러 사용자 동시 편집)
- ✅ 충돌 최소화 (낙관적 잠금)

**리스크**:
- ⚠️ 개발 기간: 2-3주 소요
- ⚠️ 서버 부하 증가: Socket.IO 연결 유지 필요
- ⚠️ 복잡도 증가: 디버깅 어려움

**권장 사항**:
1. Phase 1-2부터 시작하여 점진적으로 구현
2. OperatorItemSheet에서 먼저 테스트 후 다른 컴포넌트로 확장
3. 프로덕션 배포 전 충분한 QA 진행

---

**작성자**: Claude AI
**검토자**: (TBD)
**승인자**: (TBD)
