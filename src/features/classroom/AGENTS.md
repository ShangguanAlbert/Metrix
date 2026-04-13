# classroom feature 协作说明

本文件适用于 `src/features/classroom/` 目录及其子目录。

## 职责范围

- 课堂模式选择与课堂任务入口

## 修改原则

- 保持页面和路由简单清晰
- 课堂入口常与跳转逻辑绑定；修改路径时同步检查 `navigationTargets`
- 若新增课堂任务页，优先沿用 `/classroom/*` 命名和当前页面组织方式
