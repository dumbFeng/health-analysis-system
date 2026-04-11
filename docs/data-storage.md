# 数据存储配置

项目将报告文件和报告元数据分开存储：

- 源 PDF 文件和分析结果 JSON：由同一个 `REPORT_STORAGE_MODE` 控制，当前支持 `local` 和 `oss`
- 关系型数据库：由 `DATABASE_DRIVER` 控制，当前支持 `sqlite`
- 报告元数据：作为关系型数据库里的 `reports` 表保存
- 数据库只保存元数据、状态、摘要字段，以及源文件/分析结果文件的位置和链接

## SQLite

本地和单机服务器部署推荐先使用 SQLite：

```env
DATABASE_DRIVER=sqlite
SQLITE_DATABASE_PATH=storage/data/app.sqlite
```

上传报告成功后，系统会生成一条数据库元数据记录，包含：

- 报告唯一标识 `id`
- 当前状态 `status`
- 文件存储类型 `storage_mode`
- 源 PDF 路径 `source_file_path`
- 分析 JSON 路径 `analysis_file_path`
- 文件名、MIME、文件大小、创建时间、更新时间
- 分析摘要、患者信息、错误信息

完整分析结果 JSON 不作为数据库主数据保存，而是写入 `REPORT_STORAGE_MODE` 指定的同一套文件存储。

## 文件存储

本地存储：

```env
REPORT_STORAGE_MODE=local
```

OSS 存储：

```env
REPORT_STORAGE_MODE=oss
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket
OSS_BASE_PREFIX=health-reports
```

不需要为源 PDF 和分析 JSON 分别配置存储。它们始终使用同一个 `REPORT_STORAGE_MODE`，避免出现 PDF 在 OSS、JSON 在本地这类不一致状态。

`source_file_path` 和 `analysis_file_path` 的含义由 `storage_mode` 决定：

- `local`: 工作目录下的相对路径，例如 `storage/local/uploads/pdf/...`
- `oss`: OSS object key，例如 `health-reports/uploads/pdf/...`

## 后续扩展

数据库驱动是应用级配置，不和报告业务绑定。报告业务只依赖 `ReportRepository` 接口；后续用户、任务、审计日志等业务也可以复用同一个数据库基础设施。

后续切换 MySQL 或 Postgres 时，只需要新增对应 repository 适配器，并在 `DATABASE_DRIVER` 中切换驱动，不需要改上传、列表、详情、重试等业务流程。
