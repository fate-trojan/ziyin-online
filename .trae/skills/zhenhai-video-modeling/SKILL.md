---
name: zhenhai-video-modeling
description: 按参考视频对镇海校园 3D 模型做逐秒截帧、30 秒分批审查、同机位复拍与守则校验。当用户要求继续视频对模、逐批看片、核对建筑体量/位置/层数/屋顶形制、或复拍验收截图时使用。不用于普通建模、性能优化或无关视频分析。
---

# 镇海校园视频对模

以 B 站实景视频为画面基准：航拍主基准为 `BV1NT42117VK`（《飞越镇海中学一镜到底》，407s），其余已用视频（BV1Ck4y117vU、BV1eB1QB7EYU、BV1HnZTBNESa 等）见 [PROGRESS.md](../../../PROGRESS.md)。逐批修正游戏场景中的**大体量建模冲突**。

## 硬性前提

- 动手前先读项目根目录 [RULES.md](../../../RULES.md)：碰撞、通行、验证、视频流程以它为准，本技能只负责把流程落成可执行步骤。
- **结构性改动必须先发 AskUserQuestion 问题卡**（建筑体量、位置、朝向、层数、屋顶形制、主要构件增删）。
- 信息不足时直接问用户，不猜、不臆造；无可靠依据的部分保留现状并在记录里标“待核实”。
- 每个对象最多迭代 3 轮；连续 2 轮无明显改善就换机位/换参考图，否则标“需人工处理”并说明瓶颈。

## 工具（本技能 `scripts/` 内，命令从项目根执行）

| 用途 | 命令（从项目根执行） |
|---|---|
| 视频逐秒截帧 | `node .trae/skills/zhenhai-video-modeling/scripts/bili.mjs <startSec> <count> <outDir> [BV号/URL]` |
| 帧拼图 | `python3 .trae/skills/zhenhai-video-modeling/scripts/sheet.py <dir> <out.jpg> <起始文件索引> <张数> <列数>` |
| 游戏同机位截图 | `node .trae/skills/zhenhai-video-modeling/scripts/gameview.mjs "x,y,z" "tx,ty,tz" <out.png> [时刻=12] [ui]` |

- 启动 dev server：`npm run dev`。本机常驻端口为 `http://127.0.0.1:5174/`；若实际端口不同，先改 `.trae/skills/zhenhai-video-modeling/scripts/gameview.mjs` 里的 URL 再截图。
- 场景就绪标志 `window.__READY__`；运行时调试钩子 `window.__ZH`。
- 证据目录沿用 `/tmp/zhenhai-video/`：帧批次 `bXX/`、拼图 `sheet_a.jpg`/`sheet_b.jpg`、复拍 `game_*.png`、记录 `notes.md`。需要长期留存时把最终记录汇总进项目 `PROGRESS.md`。

## 主流程

1. **建批**：删除同名的旧批次目录后截帧，避免残留帧混入。
   ```bash
   rm -rf /tmp/zhenhai-video/bXX
   node .trae/skills/zhenhai-video-modeling/scripts/bili.mjs 60 30 /tmp/zhenhai-video/bXX
   ```
   每秒 1 帧、每批 30 帧，直到视频结束（末批可不足 30 帧）。
2. **拼图**：每批拆两张，第三参是**文件索引**，不是秒数。
   ```bash
   python3 .trae/skills/zhenhai-video-modeling/scripts/sheet.py /tmp/zhenhai-video/bXX /tmp/zhenhai-video/bXX/sheet_a.jpg 0 15 5
   python3 .trae/skills/zhenhai-video-modeling/scripts/sheet.py /tmp/zhenhai-video/bXX /tmp/zhenhai-video/bXX/sheet_b.jpg 15 15 5
   ```
3. **审片**：只判 4 类大冲突——体量、位置/朝向、层数与屋顶形制、主要构件缺失/多余。纹理、配色、临时人物、镜头风格不修。
4. **对模**：对疑似冲突先拍游戏同机位图，再对照原帧裁图，确认差异后改代码。
   ```bash
   node .trae/skills/zhenhai-video-modeling/scripts/gameview.mjs "-77,30,10" "-77,14,-76" /tmp/zhenhai-video/game_check.png 12
   ```
5. **改码**：先读要改的文件；按 `RULES.md` 同步更新碰撞体、可走面与标签。只改被确认的冲突，不顺手重构。
6. **复拍验收**：同机位 + 俯视 + 关键近景各一张；按视频运镜方向（本楼从南面到东面环绕）核对体量、角位、层数、内院与碰撞。确认旧问题未复发、锁定对象未损坏。
7. **记录并继续**：在 `notes.md` 追加本批“已修 / 待核实 / 不修”，写清文件行号与复拍文件名，然后进入下一批 30 秒。

## 冲突分级

- **大冲突**：体量、位置/朝向、层数、屋顶形制、主要构件缺失/多余 → 发问题卡确认后修改。
- **细节级**：纹理、脊饰、窗棂样式、配色、临时人物、镜头炫光 → 记录但不修。
- **红线外/无法定位**：校外街区、邻接建筑、画面中无校园锚点的物体 → 记录“待核实”，不新增、不猜位置。
- **用户已确认事实**：与画面推断冲突时以用户为准，并写入 `notes.md` 的“用户确认的事实”。

## 坐标与机位

- 代码坐标系：原点校门，`+x` 东、`+z` 南、`-z` 北，单位米。
- 电教楼中心 `(-77, -76)`；田径场长轴南北；梓荫山在校园北侧。
- 机位必须落在校园红线内，雾墙以外拍摄会整屏发白，无法作为证据。
- 静态取证用 `zh.setViewNow(pos, tgt)`；需要移动小人时先 `zh.follow()`（`setViewNow` 会置 `freeCam` 并冻结角色）。

## 常见坑

- 视频逐秒截帧默认取 B 站 `BV1NT42117VK`（航拍基准）；第 4 参可传其他 BV 号或 URL（如地面漫游 `BV1RgkuBREJd`）。
- `bili.mjs` 输出 `duration=113`、`w=0`、0 帧：视频元素进错流。删除批次目录重跑即可恢复 `duration=407`。
- `sheet.py` 第 3 参是文件索引：每批 30 帧时 `sheet_a` 用 `0 15`，`sheet_b` 用 `15 15`。
- `notes.md` 插入批次时先定位相邻标题，避免覆盖标题或产生孤立重复块。
- 平屋顶上的瓦面纹理在低角度会显得有“条纹/坡感”，先看几何是否有坡度，再判屋顶形制。
- 回字/多翼建筑不能只加整块碰撞体：按翼楼分别登记 `{x,z,hx,hz}`，并保留凸出塔楼的独立碰撞体。
- 大面积改造后检查红廊、连廊等既有构件是否被新体量插入或遮挡。

## 已确认事实

建模口径（实验楼、电教楼、国际部、综合楼食堂等）统一维护在 [PROGRESS.md 第二节「已锁定事实」](../../../PROGRESS.md)，本文件不再重复；改动前先读该节。

- 视频运镜：南面 → 东面环绕电教楼；复拍按同一顺序核对。

## 完成定义

- 407 秒全部批次审完，`notes.md` 有逐批“已修/待核实/不修”清单。
- 每处已修冲突都有修改前同机位图 + 修改后复拍图 + 文件行号。
- 未确证的内容仍标“待核实”，没有仅凭想象补建的构件。
- 最终汇报列出：已修项、待核实项、不修项、复拍文件名。
