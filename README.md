# Ziyin Online

一个以 **three.js** 程序化重建校园的 3D 交互网页。

## 运行

```bash
npm install
npm run dev
# 打开 http://127.0.0.1:5173/
```

生产构建：

```bash
npm run build
npm run preview
```

## 交互

- WASD，Space，Shift，拖拽旋转，滚轮/双指缩放，右键/双指平移。
- 右上角切换 **白昼 / 夜色**。

## 轴线

主体均关于 `x = -28` 中轴对称。

## 技术

- Vite 7 + three.js 0.180，原生 ES Modules。
- Canvas 程序化材质、InstancedMesh 植被与人群。
- 自定义天空 shader、EffectComposer 后处理（Bloom + 移轴/暗角/颗粒/色彩）。