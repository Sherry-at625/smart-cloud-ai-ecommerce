# 智能云 AI 电商在线销售系统

一个由 AI 驱动的电商在线销售系统（动态全栈应用）。基于 Node.js 内置模块实现后端服务，前端为原生 SPA，无需任何第三方依赖，开箱即跑、可一键外网发布。

> 外网演示：**https://smart-cloud-ai-shop.app.workbuddy.host/**

## ✨ 功能特性

- **真实账号体系**：注册 / 登录 / 登出，密码使用 `scrypt` 哈希 + HMAC 签名令牌，服务端校验。
- **商品中心**：6 大品类共 20 个种子商品，支持分类筛选、价格 / 销量 / 评分排序。
- **购物车 & 下单**：加入购物车、修改数量、结算生成订单、扣库存并累计销量。
- **🤖 AI 智能推荐**：基于用户的浏览与购买品类偏好做个性化推荐（游客展示热门）。
- **💬 AI 导购助手**：右下角悬浮机器人，识别「数码推荐 / 送礼 / 便宜 / 售后 / 配送」等意图并返回商品卡片。
- **🔍 智能搜索**：按名称 / 标签 / 品类 / 描述语义匹配。
- **⚙️ 管理员后台**：上架新品、查看订单与总销售额（非管理员调用管理接口返回 403）。

## 🧱 技术栈

| 层 | 实现 |
|----|------|
| 后端 | Node.js 原生 `http` / `crypto` / `fs`，JSON 文件存储（零第三方依赖） |
| 前端 | 原生 HTML / CSS / JS 单页应用 |
| 安全 | `scrypt` 密码哈希、`crypto` 随机盐、HMAC-SHA256 会话令牌 |
| 部署 | 单端口 HTTP 服务（`PORT` 环境变量），适合容器 / PaaS 发布 |

## 📁 目录结构

```
ecommerce-ai-system/
├── server.js            # 后端服务（路由 / 认证 / 商品 / 购物车 / 订单 / AI）
├── package.json         # 启动脚本
├── public/
│   ├── index.html       # 前端 SPA 入口
│   ├── styles.css       # 样式
│   └── app.js           # 前端逻辑 + AI 助手组件
└── data/                # 运行时自动生成（用户 / 订单 / 商品增量），已 gitignore
```

## 🚀 本地运行

```bash
# 需要 Node.js 16+（已用 22.x 验证）
node server.js
# 或
npm start
```

启动后访问 http://localhost:3000 。首次启动会自动写入种子数据（`data/` 目录）。

## 🔑 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `admin123` |
| 普通用户 | `test` | `user123` |

可在登录页点击「注册」自行创建新账号（密码 ≥ 6 位）。

> 管理员可在「管理后台」上架商品、查看订单与总销售额。

## 🔌 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 注册 |
| POST | `/api/login` | 登录（返回 token） |
| POST | `/api/logout` | 登出 |
| GET | `/api/products` | 商品列表（支持 `?search=&category=&sort=`） |
| GET | `/api/products/:id` | 商品详情 |
| GET | `/api/recommend` | AI 个性化推荐 |
| POST | `/api/chat` | AI 导购助手对话 |
| GET/POST/DELETE | `/api/cart` | 购物车 |
| POST | `/api/orders` | 下单 |
| GET | `/api/orders` | 我的订单 / 全部订单（管理员） |
| POST | `/api/products` | 管理员上架商品 |

## 📄 许可

MIT —— 仅供学习与演示使用。
