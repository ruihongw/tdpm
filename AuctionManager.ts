/**
 * ============================================================
 *  《天道拍卖行》 - 拍卖行状态机管理器 (AuctionManager)
 *  仙侠竞拍策略游戏 · 核心系统
 * ============================================================
 *
 *  设计理念：
 *    将《竞拍之王》的动态竞拍博弈与修仙因果体系深度融合。
 *    以"有限状态机(FSM)"驱动拍卖全流程，以"因果资源"替代金钱，
 *    以"走火入魔"机制替代破产惩罚，实现"修仙即竞拍，竞拍即修行"。
 *
 *  核心货币体系：
 *    灵石  —— 主竞拍货币，日常修炼所得
 *    寿元  —— 生命本源，可透支但触发走火入魔
 *    功德  —— 正向因果，可抵消业障、降低惩罚
 *    业障  —— 截胡资源，用于因果截胡改变规则
 *    神识  —— 探查资源，用于盲拍探查盲盒
 *
 *  作者：H5游戏前端架构师
 *  版本：1.0.0
 * ============================================================
 */

// ============================================================
// 第一部分：类型与枚举定义
// ============================================================

/**
 * 拍卖状态枚举 —— 有限状态机的核心状态
 * 状态流转：物品展示 → 竞价阶段 → 结算阶段 → (下一件 | 拍卖结束)
 */
enum AuctionState {
  /** 物品展示阶段：展示法宝信息，允许消耗神识探查盲盒 */
  ITEM_DISPLAY = 'ITEM_DISPLAY',
  /** 竞价阶段：明拍/暗拍进行中，接受出价 */
  BIDDING = 'BIDDING',
  /** 结算阶段：计算最终归属，处理透支寿元惩罚 */
  SETTLEMENT = 'SETTLEMENT',
  /** 拍卖结束：本场所有物品拍完 */
  CLOSED = 'CLOSED',
}

/**
 * 竞拍模式
 * - 明拍：所有出价公开可见，倒计时制
 * - 暗拍：盲拍，出价保密，一次性提交
 */
type AuctionMode = '明拍' | '暗拍'

/** 拍卖物品类型 */
type ItemType = '法宝残片' | '绝世功法' | '极品灵兽蛋'

/** 资源类型联合，用于统一的资源校验 */
type ResourceType = '灵石' | '寿元' | '功德' | '业障' | '神识'

// ============================================================
// 第二部分：接口定义 (Interface)
// ============================================================

/**
 * 竞拍者接口 IBidder
 * ----------------------------------
 * 玩家与各门派AI NPC均实现此接口，
 * 保证 AuctionManager 对两者的调用完全一致（多态）。
 * 这是"玩家与AI公平博弈"的架构基石。
 */
interface IBidder {
  /** 唯一标识 */
  readonly id: string
  /** 道号 */
  readonly name: string
  /** 所属门派（如：蜀山、蓬莱、鬼谷、昆仑） */
  readonly sect: string
  /** 是否为玩家控制 */
  readonly isPlayer: boolean

  // —— 资源属性 ——
  /** 灵石持有量（主竞拍货币） */
  lingshi: number
  /** 寿元（透支将触发走火入魔） */
  shouyuan: number
  /** 功德（正向因果，可抵消业障惩罚） */
  gongde: number
  /** 业障（截胡资源，用于因果截胡） */
  yezhang: number
  /** 神识（探查资源，用于盲拍探查） */
  shenshi: number
  /** 走火入魔层数（负面Buff，影响后续竞拍） */
  zhouhuo: number

  // —— 行为方法 ——
  /**
   * 出价决策 —— AI NPC 实现此方法进行策略计算
   * @param context 当前竞拍上下文（当前最高价、剩余时间等）
   * @returns 出价决策（出价金额、是否透支寿元等）
   */
  decideBid(context: BidContext): BidDecision

  /**
   * 探查盲盒 —— 消耗神识获取物品隐藏信息
   * @param item 待探查的拍卖物品
   * @returns 探查结果（成功/失败、获取到的信息片段）
   */
  probe(item: IAuctionItem): ProbeResult

  /**
   * 资源变更通知 —— 当资源被扣减/增加时回调
   * 用于驱动前端UI更新
   */
  onResourceChange?(type: ResourceType, delta: number, current: number): void
}

/**
 * 拍卖物品接口（单件，保留兼容）
 */
interface IAuctionItem {
  /** 物品唯一ID */
  readonly id: string
  /** 物品名称（如"上古诛仙剑残片·叁"） */
  readonly name: string
  /** 物品描述（古风文案） */
  readonly description: string
  /** 物品类型 */
  readonly type: ItemType
  /** 底价（灵石） */
  readonly basePrice: number
  /** 真实价值（隐藏，仅神识探查可部分揭示） */
  readonly trueValue: number
  /** 神识探查难度（1-10，越高越难探查） */
  readonly probeDifficulty: number
}

// ============================================================
// 仓库集竞拍模型（致敬《竞拍之王》核心设计）
// ============================================================

/** 仓库藏品品质等级（6级品质体系） */
enum WarehouseItemQuality {
  /** 凡品 —— 白色，最低品质 */
  WHITE = 'white',
  /** 良品 —— 绿色 */
  GREEN = 'green',
  /** 精良 —— 蓝色 */
  BLUE = 'blue',
  /** 稀有 —— 紫色 */
  PURPLE = 'purple',
  /** 史诗 —— 金色 */
  GOLD = 'gold',
  /** 传说 —— 红色，最高品质 */
  RED = 'red',
}

/** 品质配置：名称、颜色类、价值倍率、权重 */
interface IQualityConfig {
  key: WarehouseItemQuality
  name: string
  colorClass: string
  valueMult: number
  weight: number
}

/** 品质配置表（加权随机用） */
const QUALITY_CONFIGS: IQualityConfig[] = [
  { key: WarehouseItemQuality.WHITE, name: '凡品', colorClass: 'q-white', valueMult: 0.3, weight: 30 },
  { key: WarehouseItemQuality.GREEN, name: '良品', colorClass: 'q-green', valueMult: 0.6, weight: 25 },
  { key: WarehouseItemQuality.BLUE, name: '精良', colorClass: 'q-blue', valueMult: 1.0, weight: 20 },
  { key: WarehouseItemQuality.PURPLE, name: '稀有', colorClass: 'q-purple', valueMult: 2.0, weight: 15 },
  { key: WarehouseItemQuality.GOLD, name: '史诗', colorClass: 'q-gold', valueMult: 4.0, weight: 7 },
  { key: WarehouseItemQuality.RED, name: '传说', colorClass: 'q-red', valueMult: 8.0, weight: 3 },
]

/** 仓库内单件藏品 */
interface IWarehouseItem {
  /** 藏品唯一ID */
  readonly id: string
  /** 藏品名称 */
  readonly name: string
  /** 藏品类型（法宝/功法/灵物/灵兽/材料） */
  readonly type: string
  /** 图标 */
  readonly icon: string
  /** 品质等级 */
  readonly quality: WarehouseItemQuality
  /** 品质名称（如"精良"） */
  readonly qualityName: string
  /** 颜色类名（如"q-blue"） */
  readonly colorClass: string
  /** 真实价值（灵石） */
  readonly value: number
  /** 年代（上古/中古/近古） */
  readonly era: string
  /** 是否已完全揭示（名称+价值可见） */
  revealed: boolean
  /** 是否已揭示品质（品质可见但名称未知） */
  qualityRevealed: boolean
}

/** 仓库集 —— 竞拍的基本单位，含多件藏品 */
interface IWarehouse {
  /** 仓库唯一ID */
  readonly id: string
  /** 仓库名称（如"洞府仓库·壹"） */
  readonly name: string
  /** 仓库内所有藏品 */
  readonly items: IWarehouseItem[]
  /** 仓库总价值（所有藏品价值之和） */
  readonly totalValue: number
  /** 仓库底价（总价值的25%~35%） */
  readonly basePrice: number
  /** 藏品数量 */
  readonly itemCount: number
}

/** 仓库线索类型 —— 丰富多样的天机线索 */
type WarehouseClueType =
  | 'count_quality'    // 藏品总数+品质分布
  | 'types'            // 藏品种类分布
  | 'notable_names'    // 珍品名称（蓝品以上）
  | 'value_range'      // 价值区间估算
  | 'max_item'         // 最贵藏品
  | 'min_item'         // 最廉藏品
  | 'avg_value'        // 藏品平均价值
  | 'era_dist'         // 年代分布
  | 'reveal_one'       // 随机揭示1件藏品完整信息
  | 'reveal_quality'   // 随机揭示2件藏品品质
  | 'legendary_check'  // 是否存在传说级
  | 'epic_check'       // 史诗级数量
  | 'rare_count'       // 稀有以上数量
  | 'median_value'     // 价值中位数
  | 'quality_count'    // 随机某品质数量
  | 'type_count'       // 随机某类型数量
  | 'value_level'      // 总价值量级
  | 'item_quality_hint'// 随机藏品品质提示

/** 仓库线索 —— 每轮释放的仓库信息 */
interface IWarehouseClue {
  /** 第几轮释放 */
  round: number
  /** 线索类型 */
  type: WarehouseClueType
  /** 线索内容（展示文案） */
  content: string
  /** 线索数据（用于AI决策与UI渲染） */
  data: {
    count?: number
    qualityCount?: Record<string, number>
    typeCount?: Record<string, number>
    eraCount?: Record<string, number>
    notableItemIds?: string[]
    min?: number
    max?: number
    maxVal?: number
    maxItemId?: string
    minVal?: number
    minItemId?: string
    avgVal?: number
    medianVal?: number
    revealIds?: string[]
    revealQualityIds?: string[]
    hasLegendary?: boolean
    legendaryCount?: number
    epicCount?: number
    rareCount?: number
    quality?: string
    type?: string
    level?: string
    itemId?: string
  }
}

/**
 * 竞拍上下文 —— 传递给AI决策的只读快照
 */
interface BidContext {
  /** 当前拍卖物品 */
  item: IAuctionItem
  /** 当前最高出价（明拍可见，暗拍为0） */
  currentHighestBid: number
  /** 当前最高出价者ID（暗拍为null） */
  highestBidderId: string | null
  /** 竞拍模式 */
  mode: AuctionMode
  /** 剩余时间（秒，明拍用） */
  remainingTime: number
  /** 参与竞拍的总人数 */
  participantCount: number
  /** 自己当前的资源快照 */
  selfResources: {
    lingshi: number
    shouyuan: number
    gongde: number
    yezhang: number
    shenshi: number
    zhouhuo: number
  }
}

/**
 * 出价决策
 */
interface BidDecision {
  /** 是否参与竞拍 */
  willBid: boolean
  /** 出价金额（灵石） */
  amount: number
  /** 是否透支寿元（true时amount可超过lingshi，差额从寿元折算） */
  overdraftShouyuan: boolean
  /** 透支的寿元点数（overdraftShouyuan为true时有效） */
  shouyuanToSpend: number
  /** 决策理由（用于AI日志/文字气泡） */
  reason: string
}

/**
 * 神识探查结果
 */
interface ProbeResult {
  /** 是否探查成功 */
  success: boolean
  /** 消耗的神识 */
  cost: number
  /** 获取到的信息（成功时返回部分真实价值描述） */
  revealedInfo: string
  /** 信息准确度（0-1，越高越准确） */
  accuracy: number
}

/**
 * 竞拍记录 —— 用于结算与审计
 */
interface IBidRecord {
  /** 竞拍者ID */
  bidderId: string
  /** 出价金额 */
  amount: number
  /** 是否透支寿元 */
  overdraft: boolean
  /** 透支的寿元 */
  shouyuanSpent: number
  /** 出价时间戳 */
  timestamp: number
}

/**
 * 结算结果
 */
interface ISettlementResult {
  /** 中标者ID（null表示流拍） */
  winnerId: string | null
  /** 成交价 */
  finalPrice: number
  /** 所有竞拍记录 */
  records: IBidRecord[]
  /** 触发的走火入魔列表 */
  zhouhuoTriggers: Array<{
    bidderId: string
    reason: string
    zhouhuoAdded: number
  }>
  /** 天道使者播报文案 */
  announcement: string
}

/**
 * 因果截胡请求
 */
interface IInterceptRequest {
  /** 发起者ID */
  bidderId: string
  /** 截胡类型 */
  type: '延长竞拍' | '改明为暗' | '改暗为明' | '强制流拍'
  /** 消耗的业障 */
  yezhangCost: number
}

// ============================================================
// 第三部分：事件类型定义
// ============================================================

/**
 * 拍卖事件类型 —— 用于事件驱动的前端UI更新
 */
type AuctionEvent =
  | { type: 'STATE_CHANGE'; from: AuctionState; to: AuctionState }
  | { type: 'BID_PLACED'; record: IBidRecord; bidderName: string }
  | { type: 'INTERCEPT'; request: IInterceptRequest; bidderName: string }
  | { type: 'PROBE'; bidderId: string; result: ProbeResult }
  | { type: 'ZHOUHUO'; bidderId: string; zhouhuo: number; reason: string }
  | { type: 'SETTLEMENT'; result: ISettlementResult }
  | { type: 'COUNTDOWN'; remaining: number }
  | { type: 'ANNOUNCEMENT'; text: string }

/** 事件监听器类型 */
type AuctionEventListener = (event: AuctionEvent) => void

// ============================================================
// 第四部分：AuctionManager 核心实现
// ============================================================

/**
 * AuctionManager —— 拍卖行状态机管理器
 * ============================================================
 * 职责：
 *  1. 管理拍卖全流程状态机流转
 *  2. 接收并校验竞拍者出价（含防连点/防作弊）
 *  3. 处理"透支寿元"竞拍的结算与走火入魔惩罚
 *  4. 处理"因果截胡"规则变更
 *  5. 通过事件驱动通知前端UI更新
 */
class AuctionManager {
  // —— 状态机核心 ——
  /** 当前拍卖状态 */
  private _state: AuctionState = AuctionState.CLOSED
  /** 当前竞拍模式 */
  private _mode: AuctionMode = '明拍'
  /** 当前拍卖物品 */
  private _currentItem: IAuctionItem | null = null

  // —— 竞拍数据 ——
  /** 所有竞拍记录（明拍按时间序，暗拍收集后统一开标） */
  private _bidRecords: IBidRecord[] = []
  /** 当前最高出价（明拍） */
  private _highestBid: number = 0
  /** 当前最高出价者ID（明拍） */
  private _highestBidderId: string | null = null
  /** 明拍倒计时（秒） */
  private _countdown: number = 0
  /** 倒计时定时器 */
  private _countdownTimer: ReturnType<typeof setInterval> | null = null

  // —— 参与者 ——
  /** 所有参与本场拍卖的竞拍者 */
  private _bidders: Map<string, IBidder> = new Map()

  // —— 防作弊 ——
  /** 每个竞拍者上次出价时间戳（防连点） */
  private _lastBidTime: Map<string, number> = new Map()
  /** 防连点间隔（毫秒） */
  private readonly BID_COOLDOWN_MS: number = 800
  /** 暗拍每人最多出价次数 */
  private readonly SEALED_MAX_BIDS: number = 1
  /** 暗拍出价次数记录 */
  private _sealedBidCount: Map<string, number> = new Map()

  // —— 事件系统 ——
  private _listeners: Set<AuctionEventListener> = new Set()

  // —— 配置 ——
  /** 明拍初始倒计时（秒） */
  private readonly INITIAL_COUNTDOWN: number = 30
  /** 截胡可触发的最后倒计时秒数 */
  private readonly INTERCEPT_WINDOW: number = 3
  /** 透支寿元兑换灵石的汇率（1寿元 = N灵石） */
  private readonly SHOUYUAN_EXCHANGE_RATE: number = 100
  /** 走火入魔基础层数（每次透支触发） */
  private readonly ZHOUHUO_PER_OVERDRAFT: number = 1

  // ============================================================
  // 公开属性
  // ============================================================

  /** 获取当前状态（只读） */
  get state(): AuctionState {
    return this._state
  }

  /** 获取当前竞拍模式 */
  get mode(): AuctionMode {
    return this._mode
  }

  /** 获取当前拍卖物品 */
  get currentItem(): IAuctionItem | null {
    return this._currentItem
  }

  /** 获取当前最高出价 */
  get highestBid(): number {
    return this._highestBid
  }

  /** 获取剩余倒计时 */
  get remainingTime(): number {
    return this._countdown
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   * 前端UI通过此方法订阅拍卖事件，实现数据驱动渲染
   */
  on(listener: AuctionEventListener): void {
    this._listeners.add(listener)
  }

  /** 移除事件监听器 */
  off(listener: AuctionEventListener): void {
    this._listeners.delete(listener)
  }

  /**
   * 派发事件 —— 内部方法，通知所有监听器
   */
  private emit(event: AuctionEvent): void {
    this._listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (e) {
        console.error('[AuctionManager] 事件监听器异常:', e)
      }
    })
  }

  /**
   * 天道使者播报 —— 发送古风文字气泡
   */
  private announce(text: string): void {
    this.emit({ type: 'ANNOUNCEMENT', text })
  }

  // ============================================================
  // 状态机流转
  // ============================================================

  /**
   * 状态流转 —— 核心FSM转移方法
   * 所有状态变更必须经过此方法，确保合法性校验与事件通知
   */
  private transitionTo(newState: AuctionState): void {
    // 状态转移合法性校验
    if (!this.isValidTransition(this._state, newState)) {
      console.warn(
        `[AuctionManager] 非法状态转移: ${this._state} → ${newState}，已拒绝`
      )
      return
    }

    const oldState = this._state
    this._state = newState
    console.log(`[AuctionManager] 状态转移: ${oldState} → ${newState}`)
    this.emit({ type: 'STATE_CHANGE', from: oldState, to: newState })
  }

  /**
   * 状态转移合法性校验
   * 定义FSM的合法转移图：
   *   CLOSED → ITEM_DISPLAY
   *   ITEM_DISPLAY → BIDDING
   *   BIDDING → SETTLEMENT
   *   SETTLEMENT → ITEM_DISPLAY（下一件）| CLOSED（拍完）
   *   CLOSED → CLOSED（重置）
   */
  private isValidTransition(from: AuctionState, to: AuctionState): boolean {
    const validTransitions: Record<AuctionState, AuctionState[]> = {
      [AuctionState.CLOSED]: [AuctionState.ITEM_DISPLAY],
      [AuctionState.ITEM_DISPLAY]: [AuctionState.BIDDING, AuctionState.CLOSED],
      [AuctionState.BIDDING]: [AuctionState.SETTLEMENT],
      [AuctionState.SETTLEMENT]: [AuctionState.ITEM_DISPLAY, AuctionState.CLOSED],
      [AuctionState.CLOSED]: [AuctionState.ITEM_DISPLAY],
    }
    return validTransitions[from]?.includes(to) ?? false
  }

  // ============================================================
  // 拍卖流程控制
  // ============================================================

  /**
   * 注册竞拍者 —— 玩家与AI NPC均需注册后方可参与
   */
  registerBidder(bidder: IBidder): void {
    if (this._bidders.has(bidder.id)) {
      console.warn(`[AuctionManager] 竞拍者已存在: ${bidder.id}`)
      return
    }
    this._bidders.set(bidder.id, bidder)
    console.log(`[AuctionManager] 注册竞拍者: ${bidder.name}（${bidder.sect}）`)
  }

  /**
   * 开始展示下一件拍卖物品
   * @param item 拍卖物品
   * @param mode 竞拍模式（明拍/暗拍）
   */
  displayItem(item: IAuctionItem, mode: AuctionMode = '明拍'): void {
    // 重置上一件物品的竞拍数据
    this._bidRecords = []
    this._highestBid = 0
    this._highestBidderId = null
    this._sealedBidCount.clear()
    this._currentItem = item
    this._mode = mode

    this.transitionTo(AuctionState.ITEM_DISPLAY)
    this.announce(
      `天道使者：「此物乃${item.name}，${item.description}底价${item.basePrice}灵石，` +
        `${mode === '暗拍' ? '天机盲拍，各凭机缘' : '明拍竞价，价高者得'}。」`
    )
  }

  /**
   * 开始竞价阶段
   * 明拍启动倒计时，暗拍等待所有参与者提交
   */
  startBidding(): void {
    if (this._state !== AuctionState.ITEM_DISPLAY || !this._currentItem) {
      console.warn('[AuctionManager] 非物品展示阶段，无法开始竞价')
      return
    }

    this.transitionTo(AuctionState.BIDDING)

    if (this._mode === '明拍') {
      this._countdown = this.INITIAL_COUNTDOWN
      this.startCountdown()
      this.announce(`天道使者：「竞价开始，限时${this.INITIAL_COUNTDOWN}息。」`)
    } else {
      this.announce('天道使者：「盲拍已启，诸位道友各书灵石数目于玉简之上。」')
    }
  }

  /**
   * 启动明拍倒计时
   */
  private startCountdown(): void {
    this.clearCountdown()
    this._countdownTimer = setInterval(() => {
      this._countdown--
      this.emit({ type: 'COUNTDOWN', remaining: this._countdown })

      // 倒计时结束，进入结算
      if (this._countdown <= 0) {
        this.clearCountdown()
        this.settle()
      }
    }, 1000)
  }

  /**
   * 清除倒计时定时器
   */
  private clearCountdown(): void {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  }

  // ============================================================
  // 出价处理（含防连点/防作弊校验）
  // ============================================================

  /**
   * 提交出价 —— 核心竞拍接口
   * 玩家与AI均通过此方法出价，统一校验
   *
   * @param bidderId 竞拍者ID
   * @param amount 出价金额（灵石）
   * @param overdraftShouyuan 是否透支寿元
   * @param shouyuanToSpend 透支的寿元点数
   * @returns 校验结果（成功/失败 + 原因）
   */
  submitBid(
    bidderId: string,
    amount: number,
    overdraftShouyuan: boolean = false,
    shouyuanToSpend: number = 0
  ): { success: boolean; reason: string } {
    // —— 前置校验链 ——

    // 1. 状态校验：必须在竞价阶段
    if (this._state !== AuctionState.BIDDING) {
      return { success: false, reason: '非竞价阶段，无法出价' }
    }

    // 2. 竞拍者存在性校验
    const bidder = this._bidders.get(bidderId)
    if (!bidder) {
      return { success: false, reason: '未注册的竞拍者' }
    }

    // 3. 走火入魔校验：层数过高时禁止出价
    if (bidder.zhouhuo >= 3) {
      return { success: false, reason: '走火入魔已深，神识不稳，无法竞拍' }
    }

    // 4. 防连点校验：同一竞拍者冷却时间内不可重复出价
    const now = Date.now()
    const lastTime = this._lastBidTime.get(bidderId) ?? 0
    if (now - lastTime < this.BID_COOLDOWN_MS) {
      return {
        success: false,
        reason: `出价过快，请稍候（冷却${this.BID_COOLDOWN_MS}ms）`,
      }
    }

    // 5. 出价金额合法性校验
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, reason: '出价金额非法' }
    }
    // 防止浮点数精度攻击
    if (amount !== Math.floor(amount)) {
      return { success: false, reason: '灵石须为整数' }
    }

    // 6. 底价校验
    if (this._currentItem && amount < this._currentItem.basePrice) {
      return { success: false, reason: `出价低于底价${this._currentItem.basePrice}灵石` }
    }

    // 7. 暗拍次数限制
    if (this._mode === '暗拍') {
      const count = this._sealedBidCount.get(bidderId) ?? 0
      if (count >= this.SEALED_MAX_BIDS) {
        return { success: false, reason: '盲拍每人仅可出价一次' }
      }
    }

    // 8. 明拍须高于当前最高价
    if (this._mode === '明拍' && amount <= this._highestBid) {
      return {
        success: false,
        reason: `出价须高于当前最高价${this._highestBid}灵石`,
      }
    }

    // 9. 资源充足性校验（含透支逻辑）
    const resourceCheck = this.validateResources(
      bidder,
      amount,
      overdraftShouyuan,
      shouyuanToSpend
    )
    if (!resourceCheck.success) {
      return resourceCheck
    }

    // —— 校验通过，执行出价 ——

    // 扣减资源
    this.deductResources(bidder, amount, overdraftShouyuan, shouyuanToSpend)

    // 记录出价
    const record: IBidRecord = {
      bidderId,
      amount,
      overdraft: overdraftShouyuan,
      shouyuanSpent: overdraftShouyuan ? shouyuanToSpend : 0,
      timestamp: now,
    }
    this._bidRecords.push(record)
    this._lastBidTime.set(bidderId, now)

    // 暗拍次数+1
    if (this._mode === '暗拍') {
      this._sealedBidCount.set(
        bidderId,
        (this._sealedBidCount.get(bidderId) ?? 0) + 1
      )
    }

    // 明拍更新最高价
    if (this._mode === '明拍') {
      this._highestBid = amount
      this._highestBidderId = bidderId

      // 明拍最后3秒出价，自动延长倒计时（防秒杀机制）
      if (this._countdown <= this.INTERCEPT_WINDOW && this._countdown > 0) {
        this._countdown = Math.max(this._countdown + 5, 8)
        this.announce(
          `天道使者：「${bidder.name}出价${amount}灵石！天机生变，竞价延长！」`
        )
      } else {
        this.announce(
          `天道使者：「${bidder.name}出价${amount}灵石。` +
            `${overdraftShouyuan ? '此人竟透支寿元竞拍，好大的决心！' : ''}」`
        )
      }
    } else {
      // 暗拍不公开出价信息
      this.announce(`天道使者：「${bidder.name}已将玉简投入天机匣。」`)
    }

    // 派发出价事件
    this.emit({
      type: 'BID_PLACED',
      record,
      bidderName: bidder.name,
    })

    // 透支寿元 → 触发走火入魔判定
    if (overdraftShouyuan && shouyuanToSpend > 0) {
      this.triggerZhouhuo(bidder, shouyuanToSpend)
    }

    return { success: true, reason: '出价成功' }
  }

  /**
   * 资源校验 —— 检查竞拍者资源是否足够
   */
  private validateResources(
    bidder: IBidder,
    amount: number,
    overdraft: boolean,
    shouyuanToSpend: number
  ): { success: boolean; reason: string } {
    const lingshiNeeded = overdraft
      ? amount - shouyuanToSpend * this.SHOUYUAN_EXCHANGE_RATE
      : amount

    // 灵石部分校验
    if (lingshiNeeded > bidder.lingshi) {
      return {
        success: false,
        reason: `灵石不足，需${lingshiNeeded}灵石，仅有${bidder.lingshi}`,
      }
    }

    // 透支寿元校验
    if (overdraft) {
      if (shouyuanToSpend <= 0) {
        return { success: false, reason: '透支寿元须大于0' }
      }
      if (shouyuanToSpend > bidder.shouyuan) {
        return {
          success: false,
          reason: `寿元不足，欲透支${shouyuanToSpend}年，仅有${bidder.shouyuan}年`,
        }
      }
      // 寿元过低时警告（但不阻止，这正是走火入魔的张力所在）
      if (bidder.shouyuan - shouyuanToSpend < 10) {
        console.warn(
          `[AuctionManager] ${bidder.name}寿元将降至极低，走火入魔风险极大`
        )
      }
    }

    return { success: true, reason: '资源充足' }
  }

  /**
   * 扣减资源 —— 实际扣除灵石与寿元
   */
  private deductResources(
    bidder: IBidder,
    amount: number,
    overdraft: boolean,
    shouyuanToSpend: number
  ): void {
    const lingshiToDeduct = overdraft
      ? amount - shouyuanToSpend * this.SHOUYUAN_EXCHANGE_RATE
      : amount

    bidder.lingshi -= lingshiToDeduct
    bidder.onResourceChange?.('灵石', -lingshiToDeduct, bidder.lingshi)

    if (overdraft && shouyuanToSpend > 0) {
      bidder.shouyuan -= shouyuanToSpend
      bidder.onResourceChange?.('寿元', -shouyuanToSpend, bidder.shouyuan)
    }
  }

  // ============================================================
  // 走火入魔（透支寿元惩罚机制）
  // ============================================================

  /**
   * 触发走火入魔 —— 透支寿元后的负面Buff判定
   *
   * 机制说明：
   *  - 每透支寿元，增加走火入魔层数
   *  - 功德可抵消部分走火入魔（1功德抵消1层）
   *  - 走火入魔≥3层时禁止竞拍
   *  - 走火入魔会降低后续神识探查准确度
   */
  private triggerZhouhuo(bidder: IBidder, shouyuanSpent: number): void {
    // 基础走火入魔层数 = 透支寿元 / 50（每50年寿元1层）
    const baseLayers = Math.max(
      this.ZHOUHUO_PER_OVERDRAFT,
      Math.floor(shouyuanSpent / 50)
    )

    // 功德抵消
    let actualLayers = baseLayers
    if (bidder.gongde > 0) {
      const offset = Math.min(bidder.gongde, baseLayers)
      bidder.gongde -= offset
      actualLayers -= offset
      bidder.onResourceChange?.('功德', -offset, bidder.gongde)
    }

    if (actualLayers > 0) {
      bidder.zhouhuo += actualLayers
      bidder.onResourceChange?.('寿元', 0, bidder.shouyuan) // 触发UI刷新

      const reason = `透支${shouyuanSpent}年寿元，走火入魔+${actualLayers}层`
      this.emit({
        type: 'ZHOUHUO',
        bidderId: bidder.id,
        zhouhuo: actualLayers,
        reason,
      })

      this.announce(
        `天道使者：「${bidder.name}逆天而行，透支寿元，走火入魔${actualLayers}层！` +
          `${bidder.zhouhuo >= 3 ? '神识已乱，无法再战！' : '因果循环，报应不爽。」'}`
      )
    }
  }

  // ============================================================
  // 因果截胡（截拍机制）
  // ============================================================

  /**
   * 因果截胡 —— 在明拍最后3秒消耗业障改变规则
   *
   * 截胡类型：
   *  - 延长竞拍：额外增加10秒
   *  - 改明为暗：将当前明拍转为暗拍（隐藏所有出价）
   *  - 改暗为明：将暗拍转为明拍（公开所有出价）
   *  - 强制流拍：消耗大量业障直接终止当前物品拍卖
   *
   * @param request 截胡请求
   * @returns 结果
   */
  intercept(
    request: IInterceptRequest
  ): { success: boolean; reason: string } {
    // 1. 状态校验
    if (this._state !== AuctionState.BIDDING) {
      return { success: false, reason: '非竞价阶段，无法截胡' }
    }

    // 2. 仅明拍最后3秒可截胡（强制流拍除外，暗拍也可）
    if (this._mode === '明拍' && this._countdown > this.INTERCEPT_WINDOW) {
      return {
        success: false,
        reason: `截胡须在最后${this.INTERCEPT_WINDOW}息内发动`,
      }
    }

    // 3. 竞拍者校验
    const bidder = this._bidders.get(request.bidderId)
    if (!bidder) {
      return { success: false, reason: '未注册的竞拍者' }
    }

    // 4. 业障校验
    if (bidder.yezhang < request.yezhangCost) {
      return {
        success: false,
        reason: `业障不足，需${request.yezhangCost}点，仅有${bidder.yezhang}点`,
      }
    }

    // 5. 扣减业障
    bidder.yezhang -= request.yezhangCost
    bidder.onResourceChange?.('业障', -request.yezhangCost, bidder.yezhang)

    // 6. 执行截胡效果
    switch (request.type) {
      case '延长竞拍':
        this._countdown += 10
        this.announce(
          `天道使者：「${bidder.name}以${request.yezhangCost}业障逆改天机，` +
            `竞价延长10息！因果纠缠，业力深重！」`
        )
        break

      case '改明为暗':
        this._mode = '暗拍'
        this._highestBid = 0
        this._highestBidderId = null
        this.clearCountdown()
        this.announce(
          `天道使者：「${bidder.name}施展障眼法，明拍转暗拍！` +
            `天机混沌，诸出价皆不可见！」`
        )
        break

      case '改暗为明':
        this._mode = '明拍'
        // 找出当前最高出价并公开
        const topRecord = this._bidRecords.reduce(
          (max, r) => (r.amount > max.amount ? r : max),
          this._bidRecords[0]
        )
        if (topRecord) {
          this._highestBid = topRecord.amount
          this._highestBidderId = topRecord.bidderId
        }
        this._countdown = this.INTERCEPT_WINDOW + 5
        this.startCountdown()
        this.announce(
          `天道使者：「${bidder.name}破除迷障，暗拍转明拍！` +
            `天机重现，最高出价${this._highestBid}灵石！」`
        )
        break

      case '强制流拍':
        this.announce(
          `天道使者：「${bidder.name}以${request.yezhangCost}业障强行断绝因果，` +
            `此物流拍！天道震怒！」`
        )
        this.settle(true) // 强制流拍结算
        return { success: true, reason: '强制流拍成功' }
    }

    this.emit({ type: 'INTERCEPT', request, bidderName: bidder.name })
    return { success: true, reason: `截胡成功：${request.type}` }
  }

  // ============================================================
  // 结算阶段
  // ============================================================

  /**
   * 结算 —— 确定中标者，处理透支惩罚
   * @param forced 是否强制流拍
   */
  settle(forced: boolean = false): void {
    if (this._state !== AuctionState.BIDDING) return

    this.clearCountdown()
    this.transitionTo(AuctionState.SETTLEMENT)

    let winnerId: string | null = null
    let finalPrice: number = 0
    const zhouhuoTriggers: ISettlementResult['zhouhuoTriggers'] = []

    if (forced || this._bidRecords.length === 0) {
      // 流拍
      this.announce(
        forced
          ? '天道使者：「此物因果已断，流拍归库。」'
          : '天道使者：「无人问津，此物流拍。」'
      )
    } else {
      // 找出最高出价
      const winner = this._bidRecords.reduce((max, r) =>
        r.amount > max.amount ? r : max
      )
      winnerId = winner.bidderId
      finalPrice = winner.amount

      const winnerBidder = this._bidders.get(winnerId)
      if (winnerBidder) {
        this.announce(
          `天道使者：「天机已定！${winnerBidder.name}以${finalPrice}灵石` +
            `${winner.overdraft ? '（含透支寿元）' : ''}夺得${this._currentItem?.name}！` +
            `${winner.overdraft ? '逆天改命，因果自负。」' : '机缘深厚，恭喜道友。」'}`
        )
      }

      // 退还非中标者的出价（明拍中已扣的资源需退还）
      this.refundLosers(winnerId)
    }

    const result: ISettlementResult = {
      winnerId,
      finalPrice,
      records: [...this._bidRecords],
      zhouhuoTriggers,
      announcement: '结算完成',
    }

    this.emit({ type: 'SETTLEMENT', result })

    // 自动进入下一件或关闭
    // 实际项目中由外部调用 nextItem() 或 closeAuction()
  }

  /**
   * 退还非中标者的出价
   * 明拍模式下，出价时即扣减资源，未中标者需退还
   * 暗拍模式下，出价时仅锁定资源，未中标者解锁
   */
  private refundLosers(winnerId: string): void {
    for (const record of this._bidRecords) {
      if (record.bidderId === winnerId) continue

      const loser = this._bidders.get(record.bidderId)
      if (!loser) continue

      // 退还灵石
      const lingshiRefund = record.overdraft
        ? record.amount - record.shouyuanSpent * this.SHOUYUAN_EXCHANGE_RATE
        : record.amount

      loser.lingshi += lingshiRefund
      loser.onResourceChange?.('灵石', lingshiRefund, loser.lingshi)

      // 退还透支的寿元（透支的寿元退还，但走火入魔不消退）
      if (record.overdraft && record.shouyuanSpent > 0) {
        loser.shouyuan += record.shouyuanSpent
        loser.onResourceChange?.('寿元', record.shouyuanSpent, loser.shouyuan)
      }
    }
  }

  /**
   * 进入下一件物品（从结算阶段回到展示阶段）
   */
  nextItem(): void {
    if (this._state !== AuctionState.SETTLEMENT) {
      console.warn('[AuctionManager] 非结算阶段，无法进入下一件')
      return
    }
    this.transitionTo(AuctionState.ITEM_DISPLAY)
  }

  /**
   * 关闭拍卖行
   */
  closeAuction(): void {
    this.clearCountdown()
    this.transitionTo(AuctionState.CLOSED)
    this.announce('天道使者：「今日拍卖已毕，诸位道友后会有期。」')
  }

  // ============================================================
  // AI 驱动接口
  // ============================================================

  /**
   * 驱动所有AI NPC进行出价决策
   * 在明拍倒计时中定期调用，模拟NPC的"思考"与"出价"
   */
  driveAIBids(): void {
    if (this._state !== AuctionState.BIDDING || !this._currentItem) return

    for (const [id, bidder] of this._bidders) {
      // 跳过玩家
      if (bidder.isPlayer) continue
      // 跳过走火入魔者
      if (bidder.zhouhuo >= 3) continue

      // 构建决策上下文
      const context: BidContext = {
        item: this._currentItem,
        currentHighestBid: this._highestBid,
        highestBidderId: this._highestBidderId,
        mode: this._mode,
        remainingTime: this._countdown,
        participantCount: this._bidders.size,
        selfResources: {
          lingshi: bidder.lingshi,
          shouyuan: bidder.shouyuan,
          gongde: bidder.gongde,
          yezhang: bidder.yezhang,
          shenshi: bidder.shenshi,
          zhouhuo: bidder.zhouhuo,
        },
      }

      // AI决策
      const decision = bidder.decideBid(context)
      if (decision.willBid) {
        this.submitBid(
          id,
          decision.amount,
          decision.overdraftShouyuan,
          decision.shouyuanToSpend
        )
      }
    }
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 获取当前竞拍快照（用于UI渲染）
   */
  getSnapshot() {
    return {
      state: this._state,
      mode: this._mode,
      currentItem: this._currentItem,
      highestBid: this._highestBid,
      highestBidderId: this._highestBidderId,
      remainingTime: this._countdown,
      bidCount: this._bidRecords.length,
      participants: Array.from(this._bidders.values()).map((b) => ({
        id: b.id,
        name: b.name,
        sect: b.sect,
        isPlayer: b.isPlayer,
        lingshi: b.lingshi,
        shouyuan: b.shouyuan,
        zhouhuo: b.zhouhuo,
      })),
    }
  }
}

// ============================================================
// 第五部分：AI NPC 竞拍者实现示例
// ============================================================

/**
 * AINPCBidder —— 各门派AI竞拍者基类
 * ================================================
 * 不同门派有不同的竞拍性格：
 *  - 蜀山派：刚正不阿，按真实价值出价，不透支
 *  - 蓬莱派：精于算计，喜欢最后时刻截胡
 *  - 鬼谷派：阴险狡诈，善于暗拍博弈与透支
 *  - 昆仑派：财大气粗，高价压制
 */
class AINPCBidder implements IBidder {
  readonly id: string
  readonly name: string
  readonly sect: string
  readonly isPlayer: boolean = false

  lingshi: number
  shouyuan: number
  gongde: number
  yezhang: number
  shenshi: number
  zhouhuo: number = 0

  /** AI性格：aggression(激进度 0-1), prudence(谨慎度 0-1), greed(贪婪度 0-1) */
  protected personality: {
    aggression: number
    prudence: number
    greed: number
  }

  constructor(config: {
    id: string
    name: string
    sect: string
    lingshi: number
    shouyuan: number
    gongde: number
    yezhang: number
    shenshi: number
    personality: { aggression: number; prudence: number; greed: number }
  }) {
    this.id = config.id
    this.name = config.name
    this.sect = config.sect
    this.lingshi = config.lingshi
    this.shouyuan = config.shouyuan
    this.gongde = config.gongde
    this.yezhang = config.yezhang
    this.shenshi = config.shenshi
    this.personality = config.personality
  }

  /**
   * AI出价决策 —— 子类可重写以实现不同门派策略
   */
  decideBid(context: BidContext): BidDecision {
    const { item, currentHighestBid, selfResources, remainingTime } = context

    // 基础策略：根据性格计算心理价位
    // 心理价位 = 真实价值估计 × (1 + 贪婪度波动)
    // AI不知道真实价值，用底价 × 随机倍数估算
    const estimatedValue = item.basePrice * (2 + this.personality.greed * 3)
    const noise = (Math.random() - 0.5) * 0.3 // ±15%噪声
    const mentalPrice = estimatedValue * (1 + noise)

    // 明拍策略
    if (context.mode === '明拍') {
      // 谨慎型AI在最后几秒才出价
      if (this.personality.prudence > 0.7 && remainingTime > 5) {
        return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '静观其变' }
      }

      // 计算出价：略高于当前最高价
      const minBid = currentHighestBid + Math.max(10, Math.floor(currentHighestBid * 0.05))
      if (minBid > mentalPrice) {
        return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '超出心理价位' }
      }

      // 激进型AI加价更多
      const bidAmount = Math.min(
        mentalPrice,
        minBid + Math.floor(minBid * this.personality.aggression * 0.2)
      )

      // 资源不足时考虑透支（仅激进+贪婪型AI会透支）
      const needOverdraft = bidAmount > selfResources.lingshi
      if (needOverdraft) {
        if (this.personality.aggression > 0.7 && selfResources.shouyuan > 20) {
          const shouyuanNeeded = Math.ceil(
            (bidAmount - selfResources.lingshi) / 100
          )
          return {
            willBid: true,
            amount: bidAmount,
            overdraftShouyuan: true,
            shouyuanToSpend: shouyuanNeeded,
            reason: `不惜透支${shouyuanNeeded}年寿元也要拿下！`,
          }
        }
        return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '灵石不足，不愿透支' }
      }

      return {
        willBid: true,
        amount: bidAmount,
        overdraftShouyuan: false,
        shouyuanToSpend: 0,
        reason: `出价${bidAmount}灵石`,
      }
    }

    // 暗拍策略：一次性提交心理价位
    const sealedBid = Math.floor(mentalPrice * (0.8 + Math.random() * 0.4))
    if (sealedBid > selfResources.lingshi && this.personality.aggression > 0.6) {
      const shouyuanNeeded = Math.ceil(
        (sealedBid - selfResources.lingshi) / 100
      )
      return {
        willBid: true,
        amount: sealedBid,
        overdraftShouyuan: true,
        shouyuanToSpend: shouyuanNeeded,
        reason: '盲拍孤注一掷',
      }
    }
    return {
      willBid: sealedBid <= selfResources.lingshi,
      amount: Math.min(sealedBid, selfResources.lingshi),
      overdraftShouyuan: false,
      shouyuanToSpend: 0,
      reason: '盲拍出价',
    }
  }

  /**
   * 神识探查 —— AI根据性格决定是否探查
   */
  probe(item: IAuctionItem): ProbeResult {
    const cost = item.probeDifficulty * 10
    if (this.shenshi < cost) {
      return { success: false, cost: 0, revealedInfo: '神识不足', accuracy: 0 }
    }

    this.shenshi -= cost
    // 走火入魔降低探查准确度
    const accuracy = Math.max(0.3, 0.9 - this.zhouhuo * 0.15)
    const variance = (1 - accuracy) * item.trueValue
    const revealed = Math.floor(item.trueValue + (Math.random() - 0.5) * 2 * variance)

    return {
      success: true,
      cost,
      revealedInfo: `此物价值约${revealed}灵石上下`,
      accuracy,
    }
  }

  onResourceChange?(_type: ResourceType, _delta: number, _current: number): void
}

// ============================================================
// 第六部分：门派AI子类示例
// ============================================================

/**
 * 蜀山派NPC —— 刚正不阿，按价值出价，从不透支
 */
class ShushanBidder extends AINPCBidder {
  constructor(id: string, name: string, lingshi: number) {
    super({
      id,
      name,
      sect: '蜀山派',
      lingshi,
      shouyuan: 200,
      gongde: 30,
      yezhang: 5,
      shenshi: 100,
      personality: { aggression: 0.4, prudence: 0.6, greed: 0.3 },
    })
  }

  decideBid(context: BidContext): BidDecision {
    const decision = super.decideBid(context)
    // 蜀山派永不透支寿元
    decision.overdraftShouyuan = false
    decision.shouyuanToSpend = 0
    if (decision.amount > this.lingshi) {
      decision.willBid = false
      decision.reason = '蜀山弟子不逆天而行'
    }
    return decision
  }
}

/**
 * 鬼谷派NPC —— 阴险狡诈，善于暗拍博弈，敢于透支
 */
class GuiguBidder extends AINPCBidder {
  constructor(id: string, name: string, lingshi: number) {
    super({
      id,
      name,
      sect: '鬼谷派',
      lingshi,
      shouyuan: 150,
      gongde: 5,
      yezhang: 40,
      shenshi: 120,
      personality: { aggression: 0.85, prudence: 0.3, greed: 0.8 },
    })
  }
}

/**
 * 蓬莱派NPC —— 精于算计，擅长最后时刻截胡
 */
class PenglaiBidder extends AINPCBidder {
  constructor(id: string, name: string, lingshi: number) {
    super({
      id,
      name,
      sect: '蓬莱派',
      lingshi,
      shouyuan: 180,
      gongde: 20,
      yezhang: 35,
      shenshi: 110,
      personality: { aggression: 0.6, prudence: 0.8, greed: 0.5 },
    })
  }
}

// ============================================================
// 第六部分（扩展）：多轮竞拍 / 秒杀价 / 拍卖场等级 / 东山再起
// ============================================================
//
//  以下代码致敬《竞拍之王》核心机制，并进行仙侠化重构：
//
//  1. 多轮信息揭露：每件拍品分5轮竞拍，每轮逐步释放线索
//     - 第1轮：品质颜色（紫/金/红）
//     - 第2轮：年代特征（上古/中古/近古）
//     - 第3轮：稀有度提示
//     - 第4轮：价值区间
//     - 第5轮：最终出价，无额外信息
//
//  2. 秒杀价倍率递减：前4轮可"秒杀"（出价远超第二名时直接成交）
//     - 第1轮：高出第二名 100% → 秒杀
//     - 第2轮：高出第二名 60%  → 秒杀
//     - 第3轮：高出第二名 40%  → 秒杀
//     - 第4轮：高出第二名 20%  → 秒杀
//     - 第5轮：无秒杀，最高价得
//
//  3. 拍卖场分等级：不同等级入场费不同，物品价值不同
//     - 凡尘阁（入门）：入场费 500灵石，物品价值 500-2000
//     - 灵宝殿（进阶）：入场费 2000灵石，物品价值 2000-8000
//     - 天机阁（高级）：入场费 5000灵石，物品价值 8000-30000
//
//  4. 东山再起：破产后的恢复手段
//     - 典当藏品：将已拍得的藏品折价变现（70%价值）
//     - 天道试炼：消耗寿元完成试炼，获取灵石（1寿元=50灵石，有风险）
//     - 门派借贷：向门派借灵石（限次，需还本付息）
//     - 因果转世：重置资源（最后手段，保留50%藏品）

// ------------------------------------------------------------
// 6.1 拍卖场等级定义
// ------------------------------------------------------------

/** 拍卖场等级 */
enum AuctionTier {
  /** 凡尘阁 —— 入门级，低价值物品，入场费低 */
  FANCHEN = '凡尘阁',
  /** 灵宝殿 —— 进阶级，中价值物品，入场费中 */
  LINGBAO = '灵宝殿',
  /** 天机阁 —— 高级，高价值物品，入场费高 */
  TIANJI = '天机阁',
}

/** 拍卖场等级配置 */
interface ITierConfig {
  /** 等级名称 */
  tier: AuctionTier
  /** 入场费（灵石） */
  entryFee: number
  /** 物品价值下限 */
  valueMin: number
  /** 物品价值上限 */
  valueMax: number
  /** AI竞拍者数量 */
  aiCount: number
  /** AI初始灵石范围 */
  aiLingshiRange: [number, number]
  /** 仓库内藏品数量范围 */
  itemCountRange: [number, number]
  /** 描述 */
  description: string
}

/** 各等级配置表 */
const TIER_CONFIGS: Record<AuctionTier, ITierConfig> = {
  [AuctionTier.FANCHEN]: {
    tier: AuctionTier.FANCHEN,
    entryFee: 500,
    valueMin: 500,
    valueMax: 3000,
    aiCount: 3,
    aiLingshiRange: [2000, 5000],
    itemCountRange: [4, 7],
    description: '凡尘阁乃散修聚集之地，仓库内多为凡品，偶有惊喜。',
  },
  [AuctionTier.LINGBAO]: {
    tier: AuctionTier.LINGBAO,
    entryFee: 2000,
    valueMin: 2000,
    valueMax: 12000,
    aiCount: 4,
    aiLingshiRange: [5000, 12000],
    itemCountRange: [5, 9],
    description: '灵宝殿为各门派弟子常驻之所，仓库常有珍品现世。',
  },
  [AuctionTier.TIANJI]: {
    tier: AuctionTier.TIANJI,
    entryFee: 5000,
    valueMin: 8000,
    valueMax: 50000,
    aiCount: 4,
    aiLingshiRange: [10000, 30000],
    itemCountRange: [6, 10],
    description: '天机阁乃天道使者亲掌之秘境，仓库内或有传说级重宝。',
  },
}

// ------------------------------------------------------------
// 6.2 多轮信息揭露系统
// ------------------------------------------------------------

/** 藏品品质等级（对应颜色） */
enum ItemQuality {
  PURPLE = '紫', // 稀有
  GOLD = '金',   // 史诗
  RED = '红',    // 传说
}

/** 年代特征 */
enum ItemEra {
  ANCIENT = '上古', // 远古时期
  MEDIEVAL = '中古', // 千年前
  RECENT = '近古',   // 数百年前
}

/** 稀有度 */
enum ItemRarity {
  COMMON = '常见',
  UNCOMMON = '少见',
  RARE = '稀有',
  LEGENDARY = '传说',
}

/** 信息线索 —— 每轮释放的线索 */
interface IInfoClue {
  /** 第几轮释放 */
  round: number
  /** 线索类型 */
  type: 'quality' | 'era' | 'rarity' | 'valueRange'
  /** 线索内容 */
  content: string
  /** 线索数据（用于AI决策） */
  data: unknown
}

/** 价值区间线索 */
interface IValueRangeClue {
  min: number
  max: number
}

// ------------------------------------------------------------
// 6.3 秒杀价机制
// ------------------------------------------------------------

/**
 * 秒杀价倍率表 —— 每轮"秒杀"所需的超出第二名百分比
 *
 * 致敬《竞拍之王》核心机制：
 *   第1轮：100%（翻倍即可秒杀，鼓励大胆出价）
 *   第2轮：60%
 *   第3轮：40%
 *   第4轮：20%（信息已充分，小幅领先即可终结）
 *   第5轮：无（最终轮，纯比出价高低）
 */
const KILL_PRICE_THRESHOLDS: number[] = [
  1.0,  // 第1轮
  0.6,  // 第2轮
  0.4,  // 第3轮
  0.2,  // 第4轮
  -1,   // 第5轮（-1表示无秒杀）
]

/** 总轮次 */
const TOTAL_ROUNDS = 5

/**
 * 判断是否触发秒杀
 * @param round 当前轮次（1-5）
 * @param highestBid 当前最高出价
 * @param secondHighestBid 第二高出价
 * @returns 是否秒杀
 */
function checkKillPrice(
  round: number,
  highestBid: number,
  secondHighestBid: number
): boolean {
  const threshold = KILL_PRICE_THRESHOLDS[round - 1]
  if (threshold < 0) return false // 第5轮无秒杀
  if (secondHighestBid <= 0) return false // 仅一人出价不触发秒杀
  return highestBid >= secondHighestBid * (1 + threshold)
}

// ------------------------------------------------------------
// 6.4 东山再起机制
// ------------------------------------------------------------

/** 东山再起方式 */
enum ComebackMethod {
  /** 典当藏品 —— 将已拍得的藏品折价变现 */
  PAWN_ITEM = '典当藏品',
  /** 天道试炼 —— 消耗寿元完成试炼获取灵石 */
  HEAVEN_TRIAL = '天道试炼',
  /** 门派借贷 —— 向门派借灵石，需还本付息 */
  SECT_LOAN = '门派借贷',
  /** 因果转世 —— 重置资源，最后手段 */
  REINCARNATION = '因果转世',
}

/** 东山再起请求 */
interface IComebackRequest {
  method: ComebackMethod
  /** 典当：藏品ID；试炼：消耗寿元数；借贷：借款额 */
  param: string | number
}

/** 东山再起结果 */
interface IComebackResult {
  success: boolean
  reason: string
  /** 获得的灵石 */
  lingshiGained: number
  /** 消耗的寿元 */
  shouyuanCost: number
  /** 新增的债务 */
  debtAdded: number
  /** 天道使者播报 */
  announcement: string
}

/** 玩家已拍得的藏品记录 */
interface IOwnedItem {
  itemId: string
  itemName: string
  /** 购入价格 */
  purchasePrice: number
  /** 真实价值 */
  trueValue: number
  /** 拍得时的轮次 */
  roundWon: number
}

/** 玩家债务记录 */
interface IDebt {
  /** 借款金额 */
  principal: number
  /** 利率 */
  interestRate: number
  /** 剩余应还（含利息） */
  remaining: number
  /** 借款轮次 */
  borrowedAtRound: number
}

// ------------------------------------------------------------
// 6.5 增强版竞拍上下文（含多轮信息）
// ------------------------------------------------------------

/**
 * 多轮竞拍上下文 —— 传递给AI决策的增强版快照
 * 包含当前轮次、已释放线索、秒杀价阈值等信息
 */
interface IMultiRoundBidContext extends BidContext {
  /** 当前轮次（1-5） */
  currentRound: number
  /** 总轮次 */
  totalRounds: number
  /** 本轮秒杀价倍率（-1表示无秒杀） */
  killPriceThreshold: number
  /** 已释放的所有线索 */
  revealedClues: IInfoClue[]
  /** 本轮新释放的线索 */
  newCluesThisRound: IInfoClue[]
  /** 上一轮自己的出价（0表示未出价） */
  lastRoundBid: number
  /** 上一轮全场出价分布提示（模糊反馈） */
  bidDistributionHint: string
  /** 玩家已拥有的藏品（用于典当决策） */
  ownedItems: IOwnedItem[]
  /** 玩家当前债务 */
  debts: IDebt[]
}

// ------------------------------------------------------------
// 6.6 增强版拍卖管理器 —— AuctionManagerEnhanced
// ------------------------------------------------------------

/**
 * AuctionManagerEnhanced —— 增强版拍卖行管理器
 * ============================================================
 *
 * 在原 AuctionManager 基础上增加：
 *  1. 多轮竞拍（5轮制，每轮释放线索）
 *  2. 秒杀价机制（倍率递减）
 *  3. 拍卖场等级系统（入场费+物品分级）
 *  4. 东山再起机制（典当/试炼/借贷/转世）
 *
 * 状态流转：
 *   TIER_SELECT → ENTRY → ITEM_DISPLAY →
 *   ROUND_1 → ROUND_2 → ROUND_3 → ROUND_4 → ROUND_5 →
 *   SETTLEMENT → (下一件 | TIER_SELECT)
 */
class AuctionManagerEnhanced extends AuctionManager {
  // —— 拍卖场等级 ——
  private _tier: AuctionTier = AuctionTier.FANCHEN
  private _tierConfig: ITierConfig = TIER_CONFIGS[AuctionTier.FANCHEN]

  // —— 仓库集竞拍状态 ——
  /** 当前竞拍的仓库集 */
  private _currentWarehouse: IWarehouse | null = null
  /** 仓库线索池（全部线索，按轮次释放） */
  private _warehouseClues: IWarehouseClue[] = []

  // —— 多轮竞拍状态 ——
  private _currentRound: number = 0
  private _roundBids: Map<number, IBidRecord[]> = new Map() // 每轮的出价记录
  private _allClues: IInfoClue[] = [] // 已释放的所有线索（兼容旧接口）
  private _allWarehouseClues: IWarehouseClue[] = [] // 已释放的仓库线索
  private _itemClues: IInfoClue[] = [] // 当前物品的全部线索池（兼容旧接口）

  // —— 秒杀价 ——
  private _killPriceTriggered: boolean = false

  // —— 玩家藏品与债务 ——
  private _ownedItems: IOwnedItem[] = []
  private _debts: IDebt[] = []
  private _loanCount: number = 0 // 借贷次数
  private _maxLoans: number = 2 // 最多借贷次数

  // —— 东山再起配置 ——
  private readonly PAWN_RATIO: number = 0.7 // 典当折价率
  private readonly TRIAL_RATE: number = 50 // 1寿元=50灵石
  private readonly TRIAL_RISK: number = 0.3 // 试炼失败概率
  private readonly LOAN_INTEREST: number = 0.2 // 借款利率

  // ============================================================
  // 公开属性
  // ============================================================

  get tier(): AuctionTier { return this._tier }
  get currentRound(): number { return this._currentRound }
  get totalRounds(): number { return TOTAL_ROUNDS }
  get killPriceThreshold(): number {
    return KILL_PRICE_THRESHOLDS[Math.min(this._currentRound - 1, TOTAL_ROUNDS - 1)]
  }
  get revealedClues(): IInfoClue[] { return [...this._allClues] }
  get revealedWarehouseClues(): IWarehouseClue[] { return [...this._allWarehouseClues] }
  get currentWarehouse(): IWarehouse | null { return this._currentWarehouse }
  get ownedItems(): IOwnedItem[] { return [...this._ownedItems] }
  get debts(): IDebt[] { return [...this._debts] }
  get killPriceTriggered(): boolean { return this._killPriceTriggered }

  // ============================================================
  // 拍卖场等级系统
  // ============================================================

  /**
   * 选择拍卖场等级
   * @param tier 等级
   * @param bidder 玩家竞拍者
   * @returns 入场结果
   */
  selectTier(
    tier: AuctionTier,
    bidder: IBidder
  ): { success: boolean; reason: string } {
    const config = TIER_CONFIGS[tier]
    if (!config) return { success: false, reason: '无效的拍卖场等级' }

    // 校验入场费
    if (bidder.lingshi < config.entryFee) {
      return {
        success: false,
        reason: `入场费${config.entryFee}灵石不足，仅有${bidder.lingshi}灵石`,
      }
    }

    // 扣除入场费
    bidder.lingshi -= config.entryFee
    bidder.onResourceChange?.('灵石', -config.entryFee, bidder.lingshi)

    this._tier = tier
    this._tierConfig = config

    this.announce(
      `天道使者：「道友已缴纳${config.entryFee}灵石入场费，踏入${config.tier}。` +
      `${config.description}」`
    )

    return { success: true, reason: `进入${config.tier}` }
  }

  /**
   * 根据当前等级生成拍卖物品
   */
  generateItemForTier(): IAuctionItem {
    const config = this._tierConfig
    const trueValue = Math.floor(
      config.valueMin + Math.random() * (config.valueMax - config.valueMin)
    )
    const basePrice = Math.floor(trueValue * (0.3 + Math.random() * 0.2))

    // 随机物品类型与名称
    const types: ItemType[] = ['法宝残片', '绝世功法', '极品灵兽蛋']
    const type = types[Math.floor(Math.random() * types.length)]
    const names: Record<ItemType, string[]> = {
      '法宝残片': ['上古诛仙剑残片', '乾坤造化鼎碎片', '太虚神镜残片', '九天玄铁剑胚'],
      '绝世功法': ['太上忘情录', '鬼谷天书', '混元道典', '紫微斗数秘本'],
      '极品灵兽蛋': ['九尾天狐灵蛋', '玄武神龟蛋', '朱雀火羽蛋', '白虎庚金蛋'],
    }
    const namePool = names[type]
    const name = namePool[Math.floor(Math.random() * namePool.length)]

    return {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      description: `此物来历神秘，需逐步探查方能知晓其真面目。`,
      type,
      basePrice,
      trueValue,
      probeDifficulty: Math.ceil(config.valueMax / 1000),
    }
  }

  // ============================================================
  // 仓库集生成（核心：多件藏品组成一个仓库集）
  // ============================================================

  /** 藏品名称库 */
  private static readonly ITEM_TEMPLATES: Array<{
    type: string
    icon: string
    names: string[]
  }> = [
    { type: '法宝', icon: '⚔️', names: ['诛仙剑残片', '乾坤鼎碎片', '太虚镜', '玄铁剑胚', '落魂钟', '定海珠'] },
    { type: '功法', icon: '📜', names: ['太上忘情录', '鬼谷天书', '混元道典', '紫微斗数', '剑意残卷', '炼魂诀'] },
    { type: '灵物', icon: '🧪', names: ['九转金丹', '万年灵芝', '凤凰血', '龙髓液', '灵脉石', '天元丹'] },
    { type: '灵兽', icon: '🥚', names: ['天狐灵蛋', '玄武蛋', '朱雀羽', '白虎牙', '麒麟血', '蛟龙鳞'] },
    { type: '材料', icon: '💎', names: ['九天玄铁', '太乙精金', '混沌原石', '星辰砂', '雷劫木', '幽冥冰'] },
  ]

  /** 中文数字（仓库名用） */
  private static readonly CN_NUMS = '壹贰叁肆伍陆柒捌玖拾'

  /** 仓库编号计数器 */
  private _warehouseNum: number = 0

  /**
   * 生成仓库集 —— 根据当前拍卖场等级生成含多件藏品的仓库
   *
   * 致敬《竞拍之王》核心设计：
   *   每个仓库含4-10件藏品（视等级而定），
   *   藏品品质按加权随机分布（凡品30%/良品25%/精良20%/稀有15%/史诗7%/传说3%），
   *   仓库底价 = 总价值的25%~35%
   */
  generateWarehouse(): IWarehouse {
    const config = this._tierConfig
    this._warehouseNum++

    // 随机藏品数量
    const itemCount =
      config.itemCountRange[0] +
      Math.floor(
        Math.random() * (config.itemCountRange[1] - config.itemCountRange[0] + 1)
      )

    const items: IWarehouseItem[] = []
    let totalValue = 0

    // 加权随机选择品质
    const totalWeight = QUALITY_CONFIGS.reduce((s, q) => s + q.weight, 0)

    for (let i = 0; i < itemCount; i++) {
      let rand = Math.random() * totalWeight
      let quality: IQualityConfig = QUALITY_CONFIGS[0]
      for (const q of QUALITY_CONFIGS) {
        rand -= q.weight
        if (rand <= 0) {
          quality = q
          break
        }
      }

      // 随机选择物品模板
      const template =
        AuctionManagerEnhanced.ITEM_TEMPLATES[
          Math.floor(Math.random() * AuctionManagerEnhanced.ITEM_TEMPLATES.length)
        ]
      const name = template.names[Math.floor(Math.random() * template.names.length)]

      // 计算单品价值（基于等级范围和品质倍率）
      const baseUnitValue = (config.valueMin / itemCount) * (0.5 + Math.random())
      const itemValue = Math.floor(
        baseUnitValue * quality.valueMult * (0.8 + Math.random() * 0.4)
      )

      items.push({
        id: `w${this._warehouseNum}_i${i}`,
        name,
        type: template.type,
        icon: template.icon,
        quality: quality.key,
        qualityName: quality.name,
        colorClass: quality.colorClass,
        value: itemValue,
        era:
          template.type === '法宝'
            ? '上古'
            : template.type === '功法'
              ? '中古'
              : '近古',
        revealed: false,
        qualityRevealed: false,
      })
      totalValue += itemValue
    }

    // 仓库底价 = 总价值的25%~35%
    const basePrice = Math.floor(totalValue * (0.25 + Math.random() * 0.1))

    return {
      id: `warehouse_${this._warehouseNum}`,
      name: `洞府仓库·${AuctionManagerEnhanced.CN_NUMS[this._warehouseNum - 1] || this._warehouseNum}`,
      items,
      totalValue,
      basePrice,
      itemCount: items.length,
    }
  }

  /**
   * 生成仓库线索池 —— 从16+种线索中随机抽取，每轮1-2条
   *
   * 致敬《竞拍之王》信息逐轮揭露机制：
   *   线索池包含品质分布、种类、珍品名、价值区间、最贵最廉、
   *   平均价值、年代分布、随机揭示、传说感应、史诗数量、
   *   稀有数量、中位数、品质/类型计数、价值量级等。
   *   每轮随机释放1-2条，每局体验不同。
   *   第5轮全部透明。
   */
  generateWarehouseClues(warehouse: IWarehouse): IWarehouseClue[] {
    const items = warehouse.items

    // 统计数据
    const qualityCount: Record<string, number> = {}
    items.forEach((i) => { qualityCount[i.quality] = (qualityCount[i.quality] || 0) + 1 })
    const typeCount: Record<string, number> = {}
    items.forEach((i) => { typeCount[i.type] = (typeCount[i.type] || 0) + 1 })
    const eraCount: Record<string, number> = {}
    items.forEach((i) => { eraCount[i.era] = (eraCount[i.era] || 0) + 1 })

    const values = items.map((i) => i.value).sort((a, b) => a - b)
    const maxVal = values[values.length - 1]
    const minVal = values[0]
    const avgVal = Math.floor(values.reduce((s, v) => s + v, 0) / values.length)
    const medianVal = values[Math.floor(values.length / 2)]

    const notableItems = items.filter((i) => ['blue', 'purple', 'gold', 'red'].includes(i.quality))
    const legendaryItems = items.filter((i) => i.quality === 'red')
    const epicItems = items.filter((i) => i.quality === 'gold')
    const rarePlusItems = items.filter((i) => ['purple', 'gold', 'red'].includes(i.quality))
    const maxItem = items.find((i) => i.value === maxVal)!
    const minItem = items.find((i) => i.value === minVal)!

    // 线索池
    const cluePool: Array<() => IWarehouseClue | null> = [
      // 1. 藏品总数 + 品质分布
      () => {
        const qParts = QUALITY_CONFIGS.filter((q) => qualityCount[q.key] > 0)
          .map((q) => `${qualityCount[q.key]}件${q.name}`).join('、')
        return { round: 0, type: 'count_quality', content: `仓库共${warehouse.itemCount}件藏品，品质分布：${qParts}`, data: { count: warehouse.itemCount, qualityCount } }
      },
      // 2. 藏品种类分布
      () => {
        const tParts = Object.entries(typeCount).map(([t, c]) => `${c}件${t}`).join('、')
        return { round: 0, type: 'types', content: `藏品种类：${tParts}`, data: { typeCount } }
      },
      // 3. 珍品名称
      () => {
        if (notableItems.length === 0) return { round: 0, type: 'notable_names', content: `仓库内多为凡品良品，未见珍品`, data: { notableItemIds: [] } }
        return { round: 0, type: 'notable_names', content: `探得珍品：${notableItems.map((i) => i.name).join('、')}`, data: { notableItemIds: notableItems.map((i) => i.id) } }
      },
      // 4. 价值区间
      () => {
        const vrMin = Math.floor(warehouse.totalValue * 0.7)
        const vrMax = Math.floor(warehouse.totalValue * 1.3)
        return { round: 0, type: 'value_range', content: `仓库总价值估算：约${vrMin}～${vrMax}灵石`, data: { min: vrMin, max: vrMax } }
      },
      // 5. 最贵藏品
      () => ({ round: 0, type: 'max_item', content: `最贵藏品价值约${maxVal}灵石（${maxItem.qualityName}）`, data: { maxVal, maxItemId: maxItem.id } }),
      // 6. 最廉藏品
      () => ({ round: 0, type: 'min_item', content: `最廉藏品价值约${minVal}灵石（${minItem.qualityName}）`, data: { minVal, minItemId: minItem.id } }),
      // 7. 平均价值
      () => ({ round: 0, type: 'avg_value', content: `藏品平均价值约${avgVal}灵石`, data: { avgVal } }),
      // 8. 年代分布
      () => {
        const eParts = Object.entries(eraCount).map(([e, c]) => `${c}件${e}`).join('、')
        return { round: 0, type: 'era_dist', content: `藏品年代：${eParts}`, data: { eraCount } }
      },
      // 9. 随机揭示1件
      () => {
        const idx = Math.floor(Math.random() * items.length)
        const item = items[idx]
        return { round: 0, type: 'reveal_one', content: `天机窥探：第${idx + 1}件为${item.qualityName}·${item.name}（约${item.value}灵石）`, data: { revealIds: [item.id] } }
      },
      // 10. 随机揭示2件品质
      () => {
        const shuffled = [...items].sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, Math.min(2, shuffled.length))
        const parts = picked.map((item) => { const idx = items.indexOf(item); return `第${idx + 1}件为${item.qualityName}` }).join('，')
        return { round: 0, type: 'reveal_quality', content: `天机探查：${parts}`, data: { revealQualityIds: picked.map((i) => i.id) } }
      },
      // 11. 传说级检查
      () => {
        if (legendaryItems.length === 0) return { round: 0, type: 'legendary_check', content: `天机感应：仓库内未见传说级藏品`, data: { hasLegendary: false } }
        return { round: 0, type: 'legendary_check', content: `天机感应：仓库内存在${legendaryItems.length}件传说级藏品！`, data: { hasLegendary: true, legendaryCount: legendaryItems.length } }
      },
      // 12. 史诗级数量
      () => {
        if (epicItems.length === 0) return null
        return { round: 0, type: 'epic_check', content: `探得${epicItems.length}件史诗级藏品`, data: { epicCount: epicItems.length } }
      },
      // 13. 稀有以上数量
      () => {
        if (rarePlusItems.length === 0) return { round: 0, type: 'rare_count', content: `仓库内无稀有以上藏品`, data: { rareCount: 0 } }
        return { round: 0, type: 'rare_count', content: `稀有以上藏品共${rarePlusItems.length}件`, data: { rareCount: rarePlusItems.length } }
      },
      // 14. 中位数
      () => ({ round: 0, type: 'median_value', content: `藏品价值中位数约${medianVal}灵石`, data: { medianVal } }),
      // 15. 随机品质数量
      () => {
        const available = QUALITY_CONFIGS.filter((q) => qualityCount[q.key] > 0)
        const q = available[Math.floor(Math.random() * available.length)]
        return { round: 0, type: 'quality_count', content: `${q.name}藏品有${qualityCount[q.key]}件`, data: { quality: q.key } }
      },
      // 16. 随机类型数量
      () => {
        const types = Object.keys(typeCount)
        const t = types[Math.floor(Math.random() * types.length)]
        return { round: 0, type: 'type_count', content: `${t}类藏品有${typeCount[t]}件`, data: { type: t } }
      },
      // 17. 价值量级
      () => {
        let level: string
        if (warehouse.totalValue < 1000) level = '数百灵石级别'
        else if (warehouse.totalValue < 5000) level = '数千灵石级别'
        else if (warehouse.totalValue < 20000) level = '万余灵石级别'
        else if (warehouse.totalValue < 50000) level = '数万灵石级别'
        else level = '十万灵石以上'
        return { round: 0, type: 'value_level', content: `仓库总价值量级：${level}`, data: { level } }
      },
      // 18. 随机藏品品质提示
      () => {
        const idx = Math.floor(Math.random() * items.length)
        const item = items[idx]
        return { round: 0, type: 'item_quality_hint', content: `第${idx + 1}件藏品散发着${item.qualityName}的光芒`, data: { itemId: item.id, quality: item.quality } }
      },
    ]

    // 生成所有可用线索
    const allClues = cluePool.map((gen) => gen()).filter((c): c is IWarehouseClue => c !== null)

    // 随机打乱
    for (let i = allClues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allClues[i], allClues[j]] = [allClues[j], allClues[i]]
    }

    // 分配到4轮
    const clues: IWarehouseClue[] = []
    let idx = 0
    for (let round = 1; round <= 4; round++) {
      const count = (Math.random() < 0.4 && idx + 1 < allClues.length) ? 2 : 1
      for (let j = 0; j < count && idx < allClues.length; j++) {
        const clue = allClues[idx++]
        clue.round = round
        clues.push(clue)
      }
    }

    return clues
  }

  /**
   * 根据线索揭示仓库内容 —— 支持所有线索类型的渐进式揭示
   */
  private applyWarehouseClueReveals(clues: IWarehouseClue[]): void {
    if (!this._currentWarehouse) return

    for (const clue of clues) {
      switch (clue.type) {
        case 'count_quality':
          // 揭示所有品质（但不揭示具体物品名称）
          this._currentWarehouse.items.forEach((item) => { item.qualityRevealed = true })
          break
        case 'notable_names':
          // 揭示珍品名称
          if (clue.data.notableItemIds) {
            this._currentWarehouse.items.forEach((item) => {
              if (clue.data.notableItemIds!.includes(item.id)) { item.revealed = true }
            })
          }
          break
        case 'reveal_one':
          // 随机揭示1件藏品的完整信息
          if (clue.data.revealIds) {
            this._currentWarehouse.items.forEach((item) => {
              if (clue.data.revealIds!.includes(item.id)) { item.revealed = true }
            })
          }
          break
        case 'reveal_quality':
          // 随机揭示2件藏品的品质
          if (clue.data.revealQualityIds) {
            this._currentWarehouse.items.forEach((item) => {
              if (clue.data.revealQualityIds!.includes(item.id)) { item.qualityRevealed = true }
            })
          }
          break
        case 'item_quality_hint':
          // 揭示某件藏品的品质
          if (clue.data.itemId) {
            const item = this._currentWarehouse.items.find((i) => i.id === clue.data.itemId)
            if (item) item.qualityRevealed = true
          }
          break
        case 'max_item':
          // 揭示最贵藏品的品质
          if (clue.data.maxItemId) {
            const item = this._currentWarehouse.items.find((i) => i.id === clue.data.maxItemId)
            if (item) item.qualityRevealed = true
          }
          break
        case 'min_item':
          // 揭示最廉藏品的品质
          if (clue.data.minItemId) {
            const item = this._currentWarehouse.items.find((i) => i.id === clue.data.minItemId)
            if (item) item.qualityRevealed = true
          }
          break
        // 其他线索类型（value_range, avg_value, era_dist, legendary_check等）
        // 仅提供文字信息，不改变仓库网格的揭示状态
      }
    }
  }

  // ============================================================
  // 多轮竞拍流程
  // ============================================================

  /**
   * 开始多轮竞拍 —— 重写父类的单轮逻辑
   *
   * 流程：
   *   1. 生成物品线索池
   *   2. 进入第1轮，释放第1轮线索
   *   3. 收集所有出价
   *   4. 检查秒杀价 → 触发则直接结算
   *   5. 未秒杀 → 进入下一轮，释放新线索
   *   6. 第5轮结束后结算
   */
  startMultiRoundBidding(item: IAuctionItem): void {
    // 生成线索池
    this._itemClues = this.generateCluePool(item)
    this._allClues = []
    this._roundBids.clear()
    this._killPriceTriggered = false
    this._currentRound = 0

    this.announce(
      `天道使者：「此物已呈于台前，共${TOTAL_ROUNDS}轮竞拍。` +
      `前四轮可秒杀终结（倍率递减），第五轮价高者得。诸道友各凭机缘。」`
    )

    // 进入第1轮
    this.advanceToNextRound()
  }

  /**
   * 开始仓库集多轮竞拍 —— 仓库集版入口
   *
   * 致敬《竞拍之王》核心设计：
   *   竞拍对象为"仓库集"（含多件藏品），而非单件拍品。
   *   每轮释放仓库线索（品质分布→种类→珍品名→价值区间→全透明），
   *   出价针对整个仓库，价高者得全部藏品。
   */
  startWarehouseBidding(warehouse: IWarehouse): void {
    this._currentWarehouse = warehouse
    this._warehouseClues = this.generateWarehouseClues(warehouse)
    this._allWarehouseClues = []
    this._allClues = [] // 兼容旧接口
    this._roundBids.clear()
    this._killPriceTriggered = false
    this._currentRound = 0

    this.announce(
      `天道使者：「${warehouse.name}已呈于台前，内含${warehouse.itemCount}件藏品，` +
      `底价${warehouse.basePrice}灵石。共${TOTAL_ROUNDS}轮暗拍，线索逐轮揭露，` +
      `出价针对整个仓库，价高者得全部藏品。」`
    )

    // 进入第1轮
    this.advanceToNextRound()
  }

  /**
   * 生成物品线索池 —— 5轮线索按顺序释放
   */
  private generateCluePool(item: IAuctionItem): IInfoClue[] {
    // 根据真实价值确定品质
    const quality = item.trueValue > 15000 ? ItemQuality.RED
      : item.trueValue > 5000 ? ItemQuality.GOLD
      : ItemQuality.PURPLE

    // 根据物品类型确定年代
    const era = item.type === '法宝残片' ? ItemEra.ANCIENT
      : item.type === '绝世功法' ? ItemEra.MEDIEVAL
      : ItemEra.RECENT

    // 稀有度
    const rarity = quality === ItemQuality.RED ? ItemRarity.LEGENDARY
      : quality === ItemQuality.GOLD ? ItemRarity.RARE
      : ItemRarity.UNCOMMON

    // 价值区间（第4轮释放，范围逐步缩小）
    const valueRange: IValueRangeClue = {
      min: Math.floor(item.trueValue * 0.5),
      max: Math.floor(item.trueValue * 1.5),
    }

    return [
      { round: 1, type: 'quality', content: `品质鉴定：${quality}色光芒`, data: quality },
      { round: 2, type: 'era', content: `年代追溯：${era}时期遗物`, data: era },
      { round: 3, type: 'rarity', content: `稀有度评估：${rarity}`, data: rarity },
      { round: 4, type: 'valueRange', content: `价值估算：约${valueRange.min}～${valueRange.max}灵石`, data: valueRange },
      // 第5轮无新线索
    ]
  }

  /**
   * 推进到下一轮
   */
  private advanceToNextRound(): void {
    this._currentRound++

    if (this._currentRound > TOTAL_ROUNDS) {
      // 所有轮次结束，进入结算
      this.settleMultiRound()
      return
    }

    // 仓库集模式：释放仓库线索
    if (this._currentWarehouse) {
      const newClues = this._warehouseClues.filter(c => c.round === this._currentRound)
      this._allWarehouseClues.push(...newClues)
      this.applyWarehouseClueReveals(newClues)

      if (newClues.length > 0) {
        const clueText = newClues.map(c => c.content).join('；')
        this.announce(
          `天道使者：「第${this._currentRound}轮竞拍开始。天机显现——${clueText}。」`
        )
      } else {
        // 第5轮：全部揭示
        this._currentWarehouse.items.forEach(i => { i.revealed = true })
        this.announce(
          `天道使者：「第${this._currentRound}轮（最终轮）竞拍开始，仓库内容全部透明！价高者得！」`
        )
      }
    } else {
      // 单件模式（兼容旧接口）
      const newClues = this._itemClues.filter(c => c.round === this._currentRound)
      this._allClues.push(...newClues)

      if (newClues.length > 0) {
        const clueText = newClues.map(c => c.content).join('；')
        this.announce(
          `天道使者：「第${this._currentRound}轮竞拍开始。天机显现——${clueText}。」`
        )
      } else {
        this.announce(
          `天道使者：「第${this._currentRound}轮（最终轮）竞拍开始，此轮无新线索，价高者得！」`
        )
      }
    }

    // 派发轮次开始事件（前端可据此更新UI）
    this.emit({
      type: 'ANNOUNCEMENT',
      text: `__ROUND_START__${this._currentRound}`,
    })
  }

  /**
   * 提交多轮出价 —— 增强版出价接口
   *
   * 每轮每人出价一次，收集后统一判定
   */
  submitMultiRoundBid(
    bidderId: string,
    amount: number,
    overdraftShouyuan: boolean = false,
    shouyuanToSpend: number = 0
  ): { success: boolean; reason: string } {
    // 复用父类的校验逻辑（状态、资源、防连点等）
    // 但此处每轮允许出价一次，不受明拍/暗拍模式限制

    const bidder = this['_bidders'].get(bidderId)
    if (!bidder) return { success: false, reason: '未注册的竞拍者' }
    if (bidder.zhouhuo >= 3) return { success: false, reason: '走火入魔已深，无法竞拍' }

    // 每轮每人仅出价一次
    const roundBids = this._roundBids.get(this._currentRound) || []
    if (roundBids.some(r => r.bidderId === bidderId)) {
      return { success: false, reason: `第${this._currentRound}轮已出价` }
    }

    // 金额校验
    if (amount <= 0 || amount !== Math.floor(amount)) {
      return { success: false, reason: '灵石须为正整数' }
    }
    // 底价校验：仓库集模式用仓库底价，单件模式用物品底价
    const basePrice = this._currentWarehouse
      ? this._currentWarehouse.basePrice
      : this['_currentItem']?.basePrice || 0
    if (amount < basePrice) {
      return { success: false, reason: `出价低于底价${basePrice}` }
    }

    // 资源校验（复用父类逻辑）
    const resourceCheck = this.validateResources(bidder, amount, overdraftShouyuan, shouyuanToSpend)
    if (!resourceCheck.success) return resourceCheck

    // 执行出价（不立即扣费，中标后才扣费 —— 暗标机制）
    const record: IBidRecord = {
      bidderId,
      amount,
      overdraft: overdraftShouyuan,
      shouyuanSpent: overdraftShouyuan ? shouyuanToSpend : 0,
      timestamp: Date.now(),
    }
    roundBids.push(record)
    this._roundBids.set(this._currentRound, roundBids)

    this.announce(`天道使者：「${bidder.name}已将第${this._currentRound}轮出价投入天机匣。」`)

    return { success: true, reason: '出价成功' }
  }

  /**
   * 结束当前轮次 —— 收集完所有出价后调用
   *
   * 判定逻辑：
   *   1. 找出本轮最高出价与第二高出价
   *   2. 检查秒杀价 → 触发则直接结算
   *   3. 未秒杀 → 进入下一轮
   *   4. 第5轮结束 → 最终结算
   */
  endRound(): void {
    const roundBids = this._roundBids.get(this._currentRound) || []
    if (roundBids.length === 0) {
      this.announce(`天道使者：「第${this._currentRound}轮无人出价，流拍。」`)
      this.settleMultiRound(true)
      return
    }

    // 排序找出最高与第二高
    const sorted = [...roundBids].sort((a, b) => b.amount - a.amount)
    const highest = sorted[0]
    const secondHighest = sorted[1] || { amount: 0 }

    const highestBidder = this['_bidders'].get(highest.bidderId)

    // 检查秒杀价（前4轮）
    if (this._currentRound < TOTAL_ROUNDS) {
      const killed = checkKillPrice(this._currentRound, highest.amount, secondHighest.amount)
      if (killed) {
        this._killPriceTriggered = true
        const threshold = KILL_PRICE_THRESHOLDS[this._currentRound - 1]
        this.announce(
          `天道使者：「秒杀！${highestBidder?.name}以${highest.amount}灵石` +
          `远超第二名${Math.round(threshold * 100)}%，天机一锤定音！` +
          `第${this._currentRound}轮即终结，此物归其所有！」`
        )
        this.settleMultiRound(false, highest)
        return
      }
    }

    // 未秒杀，播报本轮结果（模糊反馈，不公开具体金额）
    const hint = this.generateBidHint(roundBids)
    this.announce(
      `天道使者：「第${this._currentRound}轮竞拍结束。${hint}」`
    )

    // 进入下一轮
    this.advanceToNextRound()
  }

  /**
   * 生成出价分布提示 —— 模糊反馈（致敬《竞拍之王》）
   * 不公开具体金额，只给出相对位置提示
   */
  private generateBidHint(bids: IBidRecord[]): string {
    if (bids.length === 0) return '本轮无人出价'
    if (bids.length === 1) return '仅一人出价，局势不明'

    const sorted = [...bids].sort((a, b) => b.amount - a.amount)
    const top = sorted[0].amount
    const bottom = sorted[sorted.length - 1].amount
    const spread = top - bottom

    if (spread < top * 0.1) {
      return '众人出价接近，竞争激烈，胜负难分'
    } else if (spread < top * 0.3) {
      return '出价差距不大，最高价略领先'
    } else if (spread < top * 0.6) {
      return '出价分化明显，有人志在必得'
    } else {
      return '出价差距悬殊，有人孤注一掷'
    }
  }

  /**
   * 多轮竞拍结算
   */
  private settleMultiRound(forced: boolean = false, killWinner?: IBidRecord): void {
    let winnerId: string | null = null
    let finalPrice: number = 0

    if (forced) {
      // 流拍
      this.announce('天道使者：「此物无人问津，流拍归库。」')
    } else if (killWinner) {
      // 秒杀结算
      winnerId = killWinner.bidderId
      finalPrice = killWinner.amount
    } else {
      // 第5轮最终结算 —— 只取第5轮（当前轮）的最高出价
      // 前几轮的出价已作废，不参与结算
      const finalRoundBids = this._roundBids.get(this._currentRound) || []
      if (finalRoundBids.length > 0) {
        const sorted = [...finalRoundBids].sort((a, b) => b.amount - a.amount)
        winnerId = sorted[0].bidderId
        finalPrice = sorted[0].amount
      }
    }

    // 执行扣费与退还
    if (winnerId) {
      const winner = this['_bidders'].get(winnerId)
      if (winner) {
        // 找到中标记录
        let winRecord: IBidRecord | null = null
        for (let r = 1; r <= TOTAL_ROUNDS; r++) {
          const bids = this._roundBids.get(r) || []
          const found = bids.find(b => b.bidderId === winnerId && b.amount === finalPrice)
          if (found) { winRecord = found; break }
        }

        if (winRecord) {
          // 扣费
          const lingshiCost = winRecord.overdraft
            ? finalPrice - winRecord.shouyuanSpent * this['SHOUYUAN_EXCHANGE_RATE']
            : finalPrice
          winner.lingshi -= lingshiCost
          winner.onResourceChange?.('灵石', -lingshiCost, winner.lingshi)

          if (winRecord.overdraft && winRecord.shouyuanSpent > 0) {
            winner.shouyuan -= winRecord.shouyuanSpent
            winner.onResourceChange?.('寿元', -winRecord.shouyuanSpent, winner.shouyuan)
            this.triggerZhouhuo(winner, winRecord.shouyuanSpent)
          }

          // 记录藏品：仓库集模式记录全部藏品，单件模式记录单件
          if (this._currentWarehouse) {
            // 仓库集：中标者获得仓库内所有藏品
            const perItemPrice = Math.floor(finalPrice / this._currentWarehouse.itemCount)
            this._currentWarehouse.items.forEach(item => {
              this._ownedItems.push({
                itemId: item.id,
                itemName: item.name,
                purchasePrice: perItemPrice,
                trueValue: item.value,
                roundWon: this._currentRound,
              })
            })
          } else {
            // 单件模式（兼容旧接口）
            this._ownedItems.push({
              itemId: this['_currentItem']?.id || '',
              itemName: this['_currentItem']?.name || '',
              purchasePrice: finalPrice,
              trueValue: this['_currentItem']?.trueValue || 0,
              roundWon: this._currentRound,
            })
          }
        }

        // 播报：仓库集模式提及仓库全部藏品
        if (this._currentWarehouse) {
          this.announce(
            `天道使者：「天机已定！${winner.name}以${finalPrice}灵石` +
            `${winRecord?.overdraft ? '（含透支寿元）' : ''}夺得${this._currentWarehouse.name}` +
            `全部${this._currentWarehouse.itemCount}件藏品！` +
            `${this._killPriceTriggered ? '秒杀终结，霸气绝伦！' : '机缘深厚，恭喜道友。」'}`
          )
        } else {
          this.announce(
            `天道使者：「天机已定！${winner.name}以${finalPrice}灵石` +
            `${winRecord?.overdraft ? '（含透支寿元）' : ''}夺得${this['_currentItem']?.name}！` +
            `${this._killPriceTriggered ? '秒杀终结，霸气绝伦！' : '机缘深厚，恭喜道友。」'}`
          )
        }
      }
    }

    // 派发结算事件
    this.emit({
      type: 'SETTLEMENT',
      result: {
        winnerId,
        finalPrice,
        records: Array.from(this._roundBids.values()).flat(),
        zhouhuoTriggers: [],
        announcement: '多轮竞拍结算完成',
      },
    })
  }

  // ============================================================
  // 东山再起机制
  // ============================================================

  /**
   * 执行东山再起 —— 破产后的恢复手段
   *
   * @param bidderId 玩家ID
   * @param request 东山再起请求
   * @returns 结果
   */
  executeComeback(
    bidderId: string,
    request: IComebackRequest
  ): IComebackResult {
    const bidder = this['_bidders'].get(bidderId)
    if (!bidder) {
      return { success: false, reason: '未注册的竞拍者', lingshiGained: 0, shouyuanCost: 0, debtAdded: 0, announcement: '' }
    }

    switch (request.method) {
      // —— 典当藏品 ——
      case ComebackMethod.PAWN_ITEM: {
        const itemId = request.param as string
        const itemIndex = this._ownedItems.findIndex(i => i.itemId === itemId)
        if (itemIndex < 0) {
          return { success: false, reason: '未拥有此藏品', lingshiGained: 0, shouyuanCost: 0, debtAdded: 0, announcement: '' }
        }
        const item = this._ownedItems[itemIndex]
        const pawnValue = Math.floor(item.trueValue * this.PAWN_RATIO)
        bidder.lingshi += pawnValue
        bidder.onResourceChange?.('灵石', pawnValue, bidder.lingshi)
        this._ownedItems.splice(itemIndex, 1)

        return {
          success: true,
          reason: `典当${item.itemName}，获得${pawnValue}灵石`,
          lingshiGained: pawnValue,
          shouyuanCost: 0,
          debtAdded: 0,
          announcement: `天道使者：「${bidder.name}典当${item.itemName}，折价${pawnValue}灵石。忍痛割爱，望日后重夺。」`,
        }
      }

      // —— 天道试炼 ——
      case ComebackMethod.HEAVEN_TRIAL: {
        const shouyuanCost = request.param as number
        if (shouyuanCost <= 0 || shouyuanCost > bidder.shouyuan) {
          return { success: false, reason: '寿元不足', lingshiGained: 0, shouyuanCost: 0, debtAdded: 0, announcement: '' }
        }
        // 试炼有失败风险
        const success = Math.random() > this.TRIAL_RISK
        if (!success) {
          bidder.shouyuan -= shouyuanCost
          bidder.onResourceChange?.('寿元', -shouyuanCost, bidder.shouyuan)
          this.triggerZhouhuo(bidder, shouyuanCost)
          return {
            success: false,
            reason: `天道试炼失败！消耗${shouyuanCost}年寿元，走火入魔！`,
            lingshiGained: 0,
            shouyuanCost,
            debtAdded: 0,
            announcement: `天道使者：「${bidder.name}天道试炼失败！寿元折损${shouyuanCost}年，走火入魔！天道无情，因果自负。」`,
          }
        }
        const lingshiGained = shouyuanCost * this.TRIAL_RATE
        bidder.shouyuan -= shouyuanCost
        bidder.lingshi += lingshiGained
        bidder.onResourceChange?.('寿元', -shouyuanCost, bidder.shouyuan)
        bidder.onResourceChange?.('灵石', lingshiGained, bidder.lingshi)

        return {
          success: true,
          reason: `天道试炼成功！消耗${shouyuanCost}年寿元，获得${lingshiGained}灵石`,
          lingshiGained,
          shouyuanCost,
          debtAdded: 0,
          announcement: `天道使者：「${bidder.name}历劫成功！以${shouyuanCost}年寿元换得${lingshiGained}灵石。天道酬勤，劫后余生。」`,
        }
      }

      // —— 门派借贷 ——
      case ComebackMethod.SECT_LOAN: {
        if (this._loanCount >= this._maxLoans) {
          return { success: false, reason: `借贷次数已用尽（最多${this._maxLoans}次）`, lingshiGained: 0, shouyuanCost: 0, debtAdded: 0, announcement: '' }
        }
        const loanAmount = request.param as number
        if (loanAmount <= 0) {
          return { success: false, reason: '借贷金额须大于0', lingshiGained: 0, shouyuanCost: 0, debtAdded: 0, announcement: '' }
        }
        const interest = Math.floor(loanAmount * this.LOAN_INTEREST)
        const totalDebt = loanAmount + interest

        bidder.lingshi += loanAmount
        bidder.onResourceChange?.('灵石', loanAmount, bidder.lingshi)

        this._debts.push({
          principal: loanAmount,
          interestRate: this.LOAN_INTEREST,
          remaining: totalDebt,
          borrowedAtRound: this._currentRound,
        })
        this._loanCount++

        return {
          success: true,
          reason: `向${bidder.sect}借贷${loanAmount}灵石，需偿还${totalDebt}灵石（含利息${interest}）`,
          lingshiGained: loanAmount,
          shouyuanCost: 0,
          debtAdded: totalDebt,
          announcement: `天道使者：「${bidder.name}向${bidder.sect}借贷${loanAmount}灵石，利息${interest}灵石。因果相欠，日后必还。」`,
        }
      }

      // —— 因果转世 ——
      case ComebackMethod.REINCARNATION: {
        const oldLingshi = bidder.lingshi
        const oldShouyuan = bidder.shouyuan
        // 重置资源，保留50%藏品
        const keepCount = Math.floor(this._ownedItems.length * 0.5)
        const removedItems = this._ownedItems.splice(0, this._ownedItems.length - keepCount)
        const refundFromItems = removedItems.reduce(
          (sum, i) => sum + Math.floor(i.trueValue * this.PAWN_RATIO), 0
        )

        bidder.lingshi = Math.max(1000, Math.floor(refundFromItems * 0.5))
        bidder.shouyuan = Math.max(50, Math.floor(bidder.shouyuan * 0.5))
        bidder.zhouhuo = 0
        bidder.gongde = Math.max(0, bidder.gongde)
        this._debts = [] // 转世清除债务
        this._loanCount = 0

        bidder.onResourceChange?.('灵石', bidder.lingshi - oldLingshi, bidder.lingshi)
        bidder.onResourceChange?.('寿元', bidder.shouyuan - oldShouyuan, bidder.shouyuan)

        return {
          success: true,
          reason: `因果转世！资源重置，保留${keepCount}件藏品，清除所有债务`,
          lingshiGained: bidder.lingshi - oldLingshi,
          shouyuanCost: oldShouyuan - bidder.shouyuan,
          debtAdded: 0,
          announcement: `天道使者：「${bidder.name}因果转世，浴火重生！寿元折半，藏品半失，债务清零。此乃天道最后之慈悲，望道友珍惜。」`,
        }
      }

      default:
        return { success: false, reason: '未知的东山再起方式', lingshiGained: 0, shouyuanCost: 0, debtAdded: 0, announcement: '' }
    }
  }

  /**
   * 检查玩家是否需要东山再起（灵石不足以支付底价）
   */
  needsComeback(bidderId: string): boolean {
    const bidder = this['_bidders'].get(bidderId)
    if (!bidder || !bidder.isPlayer) return false
    // 仓库集模式用仓库底价，单件模式用物品底价
    const minPrice = this._currentWarehouse
      ? this._currentWarehouse.basePrice
      : this['_currentItem']?.basePrice || 0
    return bidder.lingshi < minPrice && this._ownedItems.length > 0
  }

  /**
   * 偿还债务 —— 每场拍卖结束后自动检查
   */
  repayDebts(bidderId: string): { repaid: number; remaining: number } {
    const bidder = this['_bidders'].get(bidderId)
    if (!bidder) return { repaid: 0, remaining: 0 }

    let totalRepaid = 0
    const remainingDebts: IDebt[] = []

    for (const debt of this._debts) {
      if (bidder.lingshi >= debt.remaining) {
        bidder.lingshi -= debt.remaining
        totalRepaid += debt.remaining
      } else {
        // 部分偿还
        const partial = bidder.lingshi
        bidder.lingshi = 0
        debt.remaining -= partial
        totalRepaid += partial
        remainingDebts.push(debt)
      }
    }

    this._debts = remainingDebts
    if (totalRepaid > 0) {
      bidder.onResourceChange?.('灵石', -totalRepaid, bidder.lingshi)
    }

    return { repaid: totalRepaid, remaining: this._debts.reduce((s, d) => s + d.remaining, 0) }
  }

  // ============================================================
  // 增强版AI驱动（含多轮策略）
  // ============================================================

  /**
   * 驱动AI进行多轮出价 —— 根据轮次和线索调整策略
   */
  driveMultiRoundAIBids(): void {
    if (this._currentRound < 1 || this._currentRound > TOTAL_ROUNDS) return

    for (const [id, bidder] of this['_bidders']) {
      if (bidder.isPlayer) continue
      if (bidder.zhouhuo >= 3) continue

      // 检查本轮是否已出价
      const roundBids = this._roundBids.get(this._currentRound) || []
      if (roundBids.some(r => r.bidderId === id)) continue

      // 构建增强版上下文
      // 仓库集模式下_currentItem可能为null，用仓库信息构造兼容item
      const fallbackItem: IAuctionItem = this._currentWarehouse
        ? {
            id: this._currentWarehouse.id,
            name: this._currentWarehouse.name,
            description: `含${this._currentWarehouse.itemCount}件藏品的仓库集`,
            type: '法宝残片',
            basePrice: this._currentWarehouse.basePrice,
            trueValue: this._currentWarehouse.totalValue,
            probeDifficulty: 5,
          }
        : this['_currentItem']!

      const context: IMultiRoundBidContext = {
        item: fallbackItem,
        currentHighestBid: 0, // 暗标，不知道他人出价
        highestBidderId: null,
        mode: '暗拍',
        remainingTime: 0,
        participantCount: this['_bidders'].size,
        currentRound: this._currentRound,
        totalRounds: TOTAL_ROUNDS,
        killPriceThreshold: this.killPriceThreshold,
        revealedClues: [...this._allClues],
        newCluesThisRound: this._itemClues.filter(c => c.round === this._currentRound),
        lastRoundBid: this.getLastRoundBid(id),
        bidDistributionHint: this.getLastRoundHint(),
        ownedItems: [],
        debts: [],
        selfResources: {
          lingshi: bidder.lingshi,
          shouyuan: bidder.shouyuan,
          gongde: bidder.gongde,
          yezhang: bidder.yezhang,
          shenshi: bidder.shenshi,
          zhouhuo: bidder.zhouhuo,
        },
      }

      // AI决策（使用增强版决策）
      const decision = this.aiMultiRoundDecide(bidder, context)
      if (decision.willBid) {
        this.submitMultiRoundBid(id, decision.amount, decision.overdraftShouyuan, decision.shouyuanToSpend)
      }
    }
  }

  /** 获取上一轮自己的出价 */
  private getLastRoundBid(bidderId: string): number {
    const lastRoundBids = this._roundBids.get(this._currentRound - 1) || []
    const myBid = lastRoundBids.find(b => b.bidderId === bidderId)
    return myBid?.amount || 0
  }

  /** 获取上一轮出价分布提示 */
  private getLastRoundHint(): string {
    const lastRoundBids = this._roundBids.get(this._currentRound - 1) || []
    return this.generateBidHint(lastRoundBids)
  }

  /**
   * AI多轮竞拍决策 —— 根据轮次和线索动态调整
   *
   * 策略模型：
   *   第1-2轮：低额试探，收集线索，不暴露实力
   *   第3-4轮：根据线索校准估值，考虑秒杀
   *   第5轮：全力出击，给出最终价位
   */
  private aiMultiRoundDecide(bidder: IBidder, ctx: IMultiRoundBidContext): BidDecision {
    const item = ctx.item
    const p = (bidder as AINPCBidder)['personality'] || { aggression: 0.5, prudence: 0.5, greed: 0.5 }

    // 仓库集模式：基于仓库总价值估值
    if (this._currentWarehouse) {
      const wh = this._currentWarehouse
      let estimatedValue = wh.basePrice * 3 // 初始估算

      // 根据已释放的仓库线索校准估值（支持所有线索类型）
      for (const clue of this._allWarehouseClues) {
        switch (clue.type) {
          case 'count_quality': {
            const qc = clue.data.qualityCount || {}
            if (qc.red) estimatedValue *= 1.5 + qc.red * 0.3
            if (qc.gold) estimatedValue *= 1.2 + qc.gold * 0.15
            if (qc.purple) estimatedValue *= 1.1
            break
          }
          case 'value_range': {
            const min = clue.data.min || 0
            const max = clue.data.max || 0
            estimatedValue = (min + max) / 2
            break
          }
          case 'value_level':
            if (clue.data.level) {
              if (clue.data.level.includes('十万')) estimatedValue = Math.max(estimatedValue, 100000)
              else if (clue.data.level.includes('数万')) estimatedValue = Math.max(estimatedValue, 30000)
              else if (clue.data.level.includes('万余')) estimatedValue = Math.max(estimatedValue, 10000)
            }
            break
          case 'legendary_check':
            if (clue.data.hasLegendary) estimatedValue *= 1.8
            break
          case 'epic_check':
            if (clue.data.epicCount && clue.data.epicCount > 0) estimatedValue *= 1.3
            break
          case 'rare_count':
            if (clue.data.rareCount && clue.data.rareCount > 0) estimatedValue *= 1 + clue.data.rareCount * 0.1
            break
          case 'max_item':
            if (clue.data.maxVal) estimatedValue = Math.max(estimatedValue, clue.data.maxVal * wh.itemCount * 0.5)
            break
          case 'avg_value':
            if (clue.data.avgVal) estimatedValue = clue.data.avgVal * wh.itemCount
            break
          case 'median_value':
            if (clue.data.medianVal) estimatedValue = clue.data.medianVal * wh.itemCount * 0.9
            break
        }
      }

      // 加入噪声（AI不知道精确价值）
      const noise = (Math.random() - 0.5) * 0.3
      const mentalPrice = estimatedValue * (1 + noise)

      switch (ctx.currentRound) {
        case 1:
        case 2: {
          // 前两轮：低额试探
          const probeBid = Math.floor(wh.basePrice * (0.8 + Math.random() * 0.4))
          if (probeBid > bidder.lingshi) {
            return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '灵石不足，观望' }
          }
          // 激进型AI可能尝试第1轮秒杀
          if (ctx.currentRound === 1 && p.aggression > 0.8 && Math.random() < 0.3) {
            const killBid = Math.floor(mentalPrice * 2.1)
            if (killBid <= bidder.lingshi) {
              return { willBid: true, amount: killBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '第1轮尝试秒杀！' }
            }
          }
          return { willBid: true, amount: probeBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '试探性出价' }
        }
        case 3:
        case 4: {
          // 中段：根据线索校准，考虑秒杀
          const threshold = ctx.killPriceThreshold
          if (threshold > 0 && p.aggression > 0.6) {
            const estimatedSecond = mentalPrice * 0.6
            const killBid = Math.floor(estimatedSecond * (1 + threshold) * 1.1)
            if (killBid <= bidder.lingshi && killBid < mentalPrice * 1.5) {
              return { willBid: true, amount: killBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: `第${ctx.currentRound}轮尝试秒杀` }
            }
          }
          const bid = Math.floor(mentalPrice * (0.5 + p.greed * 0.3))
          if (bid > bidder.lingshi) {
            if (p.aggression > 0.7 && bidder.shouyuan > 30) {
              const sy = Math.ceil((bid - bidder.lingshi) / this['SHOUYUAN_EXCHANGE_RATE'])
              return { willBid: true, amount: bid, overdraftShouyuan: true, shouyuanToSpend: sy, reason: '透支寿元出价' }
            }
            return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '灵石不足' }
          }
          return { willBid: true, amount: Math.min(bid, bidder.lingshi), overdraftShouyuan: false, shouyuanToSpend: 0, reason: '中段出价' }
        }
        case 5: {
          // 最终轮：全力出击
          const finalBid = Math.floor(mentalPrice * (0.7 + p.aggression * 0.3))
          if (finalBid > bidder.lingshi) {
            if (bidder.shouyuan > 20) {
              const sy = Math.ceil((finalBid - bidder.lingshi) / this['SHOUYUAN_EXCHANGE_RATE'])
              return { willBid: true, amount: finalBid, overdraftShouyuan: true, shouyuanToSpend: sy, reason: '最终轮透支出价' }
            }
            return { willBid: true, amount: bidder.lingshi, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '最终轮全力出价' }
          }
          return { willBid: true, amount: finalBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '最终轮出价' }
        }
        default:
          return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '未知轮次' }
      }
    }

    // 单件模式（兼容旧接口）
    // 根据已释放线索估算价值
    let estimatedValue = item.basePrice * 3 // 初始估算

    for (const clue of ctx.revealedClues) {
      if (clue.type === 'quality') {
        const q = clue.data as ItemQuality
        if (q === ItemQuality.RED) estimatedValue *= 2.5
        else if (q === ItemQuality.GOLD) estimatedValue *= 1.5
      }
      if (clue.type === 'valueRange') {
        const vr = clue.data as IValueRangeClue
        estimatedValue = (vr.min + vr.max) / 2 // 第4轮后用区间中值
      }
    }

    // 加入噪声（AI不知道精确价值）
    const noise = (Math.random() - 0.5) * 0.3
    const mentalPrice = estimatedValue * (1 + noise)

    // 根据轮次调整策略
    switch (ctx.currentRound) {
      case 1:
      case 2: {
        // 前两轮：低额试探
        const probeBid = Math.floor(item.basePrice * (0.8 + Math.random() * 0.4))
        if (probeBid > bidder.lingshi) {
          return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '灵石不足，观望' }
        }
        // 激进型AI可能尝试第1轮秒杀
        if (ctx.currentRound === 1 && p.aggression > 0.8 && Math.random() < 0.3) {
          const killBid = Math.floor(mentalPrice * 2.1) // 翻倍以上尝试秒杀
          if (killBid <= bidder.lingshi) {
            return { willBid: true, amount: killBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '第1轮尝试秒杀！' }
          }
        }
        return { willBid: true, amount: probeBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '试探性出价' }
      }

      case 3:
      case 4: {
        // 中段：根据线索校准，考虑秒杀
        const threshold = ctx.killPriceThreshold
        if (threshold > 0 && p.aggression > 0.6) {
          // 估算第二名可能出价，尝试秒杀
          const estimatedSecond = mentalPrice * 0.6
          const killBid = Math.floor(estimatedSecond * (1 + threshold) * 1.1)
          if (killBid <= bidder.lingshi && killBid < mentalPrice * 1.5) {
            return { willBid: true, amount: killBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: `第${ctx.currentRound}轮尝试秒杀` }
          }
        }
        // 正常出价
        const bid = Math.floor(mentalPrice * (0.5 + p.greed * 0.3))
        if (bid > bidder.lingshi) {
          if (p.aggression > 0.7 && bidder.shouyuan > 30) {
            const sy = Math.ceil((bid - bidder.lingshi) / this['SHOUYUAN_EXCHANGE_RATE'])
            return { willBid: true, amount: bid, overdraftShouyuan: true, shouyuanToSpend: sy, reason: '透支寿元出价' }
          }
          return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '灵石不足' }
        }
        return { willBid: true, amount: Math.min(bid, bidder.lingshi), overdraftShouyuan: false, shouyuanToSpend: 0, reason: '中段出价' }
      }

      case 5: {
        // 最终轮：全力出击
        const finalBid = Math.floor(mentalPrice * (0.7 + p.aggression * 0.3))
        if (finalBid > bidder.lingshi) {
          if (bidder.shouyuan > 20) {
            const sy = Math.ceil((finalBid - bidder.lingshi) / this['SHOUYUAN_EXCHANGE_RATE'])
            return { willBid: true, amount: finalBid, overdraftShouyuan: true, shouyuanToSpend: sy, reason: '最终轮透支出价' }
          }
          return { willBid: true, amount: bidder.lingshi, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '最终轮全力出价' }
        }
        return { willBid: true, amount: finalBid, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '最终轮出价' }
      }

      default:
        return { willBid: false, amount: 0, overdraftShouyuan: false, shouyuanToSpend: 0, reason: '未知轮次' }
    }
  }
}

// ============================================================
// 第七部分：导出与使用示例
// ============================================================

export {
  AuctionState,
  type AuctionMode,
  type ItemType,
  type ResourceType,
  type IBidder,
  type IAuctionItem,
  type BidContext,
  type BidDecision,
  type ProbeResult,
  type IBidRecord,
  type ISettlementResult,
  type IInterceptRequest,
  type AuctionEvent,
  type AuctionEventListener,
  AuctionManager,
  AINPCBidder,
  ShushanBidder,
  GuiguBidder,
  PenglaiBidder,
  // —— 新增导出 ——
  AuctionTier,
  type ITierConfig,
  TIER_CONFIGS,
  ItemQuality,
  ItemEra,
  ItemRarity,
  type IInfoClue,
  type IValueRangeClue,
  KILL_PRICE_THRESHOLDS,
  TOTAL_ROUNDS,
  checkKillPrice,
  ComebackMethod,
  type IComebackRequest,
  type IComebackResult,
  type IOwnedItem,
  type IDebt,
  type IMultiRoundBidContext,
  AuctionManagerEnhanced,
  // —— 仓库集模型导出 ——
  WarehouseItemQuality,
  type IQualityConfig,
  QUALITY_CONFIGS,
  type IWarehouseItem,
  type IWarehouse,
  type WarehouseClueType,
  type IWarehouseClue,
}

/**
 * 使用示例：
 *
 * const manager = new AuctionManager()
 *
 * // 注册事件监听（驱动UI）
 * manager.on((event) => {
 *   if (event.type === 'ANNOUNCEMENT') {
 *     showAnnouncement(event.text) // 显示天道使者气泡
 *   }
 * })
 *
 * // 注册竞拍者
 * const player = { id: 'p1', name: '李逍遥', sect: '仙灵岛', isPlayer: true, ... }
 * manager.registerBidder(player)
 * manager.registerBidder(new ShushanBidder('ai1', '独孤剑圣', 5000))
 * manager.registerBidder(new GuiguBidder('ai2', '鬼谷子', 4000))
 *
 * // 展示物品并开始拍卖
 * manager.displayItem({
 *   id: 'item1',
 *   name: '上古诛仙剑残片·叁',
 *   description: '传闻为上古大能炼制诛仙剑之残片，',
 *   type: '法宝残片',
 *   basePrice: 500,
 *   trueValue: 3000,
 *   probeDifficulty: 7,
 * }, '明拍')
 *
 * manager.startBidding()
 *
 * // 玩家出价
 * manager.submitBid('p1', 600)
 *
 * // AI自动出价（定时调用）
 * setInterval(() => manager.driveAIBids(), 2000)
 *
 *
 * ============================================================
 * 仓库集竞拍示例（致敬《竞拍之王》）：
 *
 * const enhanced = new AuctionManagerEnhanced()
 *
 * // 选择拍卖场等级
 * enhanced.selectTier(AuctionTier.LINGBAO, player)
 *
 * // 生成仓库集（含多件藏品）
 * const warehouse = enhanced.generateWarehouse()
 * console.log(`${warehouse.name}：${warehouse.itemCount}件藏品，底价${warehouse.basePrice}灵石`)
 *
 * // 开始仓库集多轮竞拍
 * enhanced.startWarehouseBidding(warehouse)
 *
 * // 每轮玩家出价
 * enhanced.submitMultiRoundBid('p1', 1500)
 *
 * // AI自动出价
 * enhanced.driveMultiRoundAIBids()
 *
 * // 结束本轮（检查秒杀或推进下一轮）
 * enhanced.endRound()
 *
 * // 结算后中标者获得仓库内全部藏品
 * // enhanced.ownedItems 包含所有拍得的藏品
 */
