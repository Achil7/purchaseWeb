/**
 * 34차: 대시보드 캐시 통합 무효화 헬퍼
 *
 * 31~33차에서 각 컨트롤러에 분산된 in-memory 캐시들을 한 곳에 등록하고,
 * 데이터 변경 핸들러(POST/PUT/DELETE)에서 호출해 캐시를 즉시 비운다.
 *
 * 각 컨트롤러는 모듈 로드 시 registerCache(name, cache)로 자신의 캐시를 등록한다.
 * monthly-brands, campaigns, items, users transfer 등에서 invalidateAll()를 호출.
 *
 * 캐시 자체는 각 컨트롤러 안에 그대로 두고, 여기에는 참조만 보관.
 */

const registeredCaches = new Map();

function registerCache(name, cacheMap) {
  registeredCaches.set(name, cacheMap);
}

function invalidateAll() {
  for (const cache of registeredCaches.values()) {
    cache.clear();
  }
}

function invalidateByName(name) {
  const cache = registeredCaches.get(name);
  if (cache) cache.clear();
}

function getCache(name) {
  return registeredCaches.get(name) || null;
}

module.exports = {
  registerCache,
  invalidateAll,
  invalidateByName,
  getCache
};
