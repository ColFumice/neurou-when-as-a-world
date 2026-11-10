﻿﻿﻿// ============================================================
// S2 地图域 · WorldMap 接口
// 名库 v0.2 冻结名：WorldMap（关联：CommunityMap）
//
// 放置（PROTOCOL 验收轮第二部分第 1 条 / stage-1.md §3）：
// S2 地图职责归 world 目录；原 src/map 已归档至 archive/map，
// 本接口移入 src/world/WorldMap.ts。
// 本文件仅定义接口骨架，不包含任何实现与业务逻辑。
// ============================================================

/**
 * WorldMap 地图接口
 * 字段范围严格依据 HANDOFF-ROUND-02：mapId / isCommunity
 * 社区地图全局共享，进度归存档。
 */
export interface WorldMap {
  /** 地图标识（HANDOFF-ROUND-02 指定字段，基础类型） */
  mapId: string;

  /** 是否为社区地图（社区地图全局共享，进度归存档） */
  isCommunity: boolean;
}
