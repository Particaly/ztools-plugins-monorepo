/**
 * 首次启动的示例数据：5 条备忘 + 3 个分组，覆盖占位符、敏感遮罩、标签、触发词与代码片的演示场景。
 * 用户可整组删除；`sample: true` 的说明在界面上不额外强调，保持克制。
 */
import { newGroupId, newMemoId } from './id'
import type { Group, Memo } from './types'

export interface SeedData {
  groups: Group[]
  memos: Memo[]
}

/** 生成示例数据（now 注入便于测试）。 */
export function buildSeedData(now: number = Date.now()): SeedData {
  const gWork = newGroupId(now)
  const gAccount = newGroupId(now + 1)
  const gDaily = newGroupId(now + 2)
  const groups: Group[] = [
    { id: gWork, name: '工作', color: '#4f6ef7', order: 1 },
    { id: gAccount, name: '账号', color: '#e0603c', order: 2 },
    { id: gDaily, name: '日常', color: '#2f9e68', order: 3 }
  ]
  const mk = (
    offset: number,
    partial: Omit<Memo, 'id' | 'groupId' | 'order' | 'useCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'> & {
      groupId: string
    }
  ): Memo => ({
    id: newMemoId(now + offset),
    order: offset,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now + offset,
    updatedAt: now + offset,
    ...partial
  })
  const memos: Memo[] = [
    mk(10, {
      title: '今日工作总结模板',
      content: '{date} {weekday} 工作总结：\n1. \n2. \n3. \n明日计划（{date+1}）：\n- ',
      groupId: gWork,
      tags: ['模板'],
      keyword: 'zj',
      pinned: true,
      sensitive: false
    }),
    mk(11, {
      title: '会议延期回复',
      content: '您好，今天的会议需要改期到 {date:MM月DD日} {time:HH点mm分}，给您带来不便敬请谅解。',
      groupId: gWork,
      tags: ['话术'],
      pinned: false,
      sensitive: false
    }),
    mk(12, {
      title: '示例·测试账号',
      content: '用户名：demo@example.com\n密码：demo-password-123\n（这是敏感示例，列表中默认遮罩，点击眼睛图标查看）',
      groupId: gAccount,
      tags: ['示例'],
      pinned: false,
      sensitive: true
    }),
    mk(13, {
      title: '收货地址',
      content: '张三，13800000000，浙江省杭州市西湖区示例路 1 号',
      groupId: gDaily,
      tags: ['地址'],
      pinned: false,
      sensitive: false
    }),
    mk(14, {
      title: '常用命令（点击代码片即复制）',
      content: '查看状态 `git status`，提交 `git commit -m "msg"`，推送 `git push`',
      groupId: gWork,
      tags: ['命令'],
      pinned: false,
      sensitive: false
    })
  ]
  return { groups, memos }
}
