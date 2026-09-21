import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import type { GalleryImage } from '@/utils/imageUtil'
import {
  displaySrc,
  downloadGalleryImage,
  isCloudFileId,
  isHttpUrl,
  isLocalFilePath,
  preloadNeighbors,
  saveGalleryImage,
} from '@/utils/imageUtil'
import styles from './index.module.scss'

interface ImageGalleryProps {
  /** 图源：云存储 fileID / http(s) 链接 / 历史文本记录均可 */
  items: GalleryImage[]
  /** 初始展示第几张 */
  current?: number
  visible: boolean
  onClose: () => void
}

type Phase = 'idle' | 'native' | 'fallback'

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
const touchDist = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

const WINDOW = () => {
  try {
    const info = Taro.getSystemInfoSync()
    return { w: info.windowWidth || 375, h: info.windowHeight || 667 }
  } catch (err) {
    return { w: 375, h: 667 }
  }
}

/**
 * 图片浏览增强画廊（零域名设计）：
 *  - 主通道：微信原生 previewImage —— urls 直接传云存储 fileID（cloud://），官方支持，无需 downloadFile 域名；
 *  - 降级通道（原生失败 / 含历史文本记录 / 部分项无链接）：
 *    自研全屏浏览 → 双指捏合缩放、单指平移、左右滑切、单张保存、下载进度、失败重试、相邻图云链路预加载。
 */
export default function ImageGallery({ items, current = 0, visible, onClose }: ImageGalleryProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [list, setList] = useState<GalleryImage[]>(items)
  const [idx, setIdx] = useState(0)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  // 微信端：当前图下载到本地（带真实进度）
  const [localPath, setLocalPath] = useState('')
  const [percent, setPercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [retryTick, setRetryTick] = useState(0)
  // 非微信端 Image 自身 onLoad 态
  const [imgLoaded, setImgLoaded] = useState(false)

  const itemsRef = useRef(items)
  const currentRef = useRef(current)
  const onCloseRef = useRef(onClose)
  itemsRef.current = items
  currentRef.current = current
  onCloseRef.current = onClose

  // 手势状态（用 ref 承载过程量，避免渲染抖动）
  const gesture = useRef({
    mode: '' as '' | 'pinch' | 'pan' | 'swipe',
    baseDist: 0,
    baseScale: 1,
    startX: 0,
    startY: 0,
    baseTx: 0,
    baseTy: 0,
    dx: 0,
    dy: 0,
  })

  const resetZoom = () => {
    setScale(1)
    setTx(0)
    setTy(0)
    gesture.current = { mode: '', baseDist: 0, baseScale: 1, startX: 0, startY: 0, baseTx: 0, baseTy: 0, dx: 0, dy: 0 }
  }

  // 打开：微信端优先走原生预览（urls 直接传 fileID，官方支持云文件 ID）
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setIdx(clamp(currentRef.current, 0, Math.max(itemsRef.current.length - 1, 0)))
    resetZoom()
    setList(itemsRef.current)
    setLocalPath('')
    setPercent(null)
    setErrMsg('')
    setImgLoaded(false)

    if (process.env.TARO_ENV !== 'weapp') {
      setPhase('fallback')
      return
    }
    const it = itemsRef.current
    const urls = it.map((x) => {
      if (x.fileID && isCloudFileId(x.fileID)) return x.fileID
      if (isCloudFileId(x.src)) return x.src
      if (x.src && isHttpUrl(x.src)) return x.src
      return ''
    })
    // 全部具备可预览地址（fileID 或 http）才走原生；含历史文本/无链接项走自研降级
    const canNative = it.length > 0 && urls.every((u) => !!u) && !it.some((x) => x.text && !x.src)
    if (!canNative) {
      setPhase('fallback')
      return
    }
    const currentUrl = urls[clamp(currentRef.current, 0, urls.length - 1)] as string
    setPhase('native')
    Taro.previewImage({ urls: urls as string[], current: currentUrl })
      .then(() => {
        if (!cancelled) onCloseRef.current()
      })
      .catch((err) => {
        console.error('[ImageGallery] 原生预览失败，降级自研浏览', err)
        if (!cancelled) setPhase('fallback')
      })
    return () => {
      cancelled = true
    }
    // 依赖固定为 visible：避免父级内联回调导致预览被意外重启
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // 降级模式：把当前图下载到本地（fileID 走云下载链路；进度可见、失败可重试）
  useEffect(() => {
    if (phase !== 'fallback' || process.env.TARO_ENV !== 'weapp') return
    let cancelled = false
    const it = list[idx]
    if (!it) return
    setImgLoaded(false)
    setErrMsg('')
    setLocalPath('')
    setPercent(0)
    if (!it.src && !it.fileID) {
      setErrMsg(it.text ? '' : '无可用图片地址')
      setLoading(false)
      return
    }
    // 本地路径直接使用
    if (it.src && isLocalFilePath(it.src)) {
      setLocalPath(it.src)
      setLoading(false)
      return
    }
    setLoading(true)
    downloadGalleryImage({ fileID: it.fileID, src: it.src }, (p) => {
      if (!cancelled) setPercent(p)
    })
      .then((path) => {
        if (cancelled) return
        setLocalPath(path)
        setLoading(false)
        setPercent(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoading(false)
        setPercent(null)
        setErrMsg((err as Error).message || '图片加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [phase, idx, list, retryTick])

  // 左右滑切 / 还原时重置缩放与下载态，并预加载相邻图（云链路）
  const switchTo = (next: number) => {
    const n = clamp(next, 0, Math.max(list.length - 1, 0))
    setIdx(n)
    resetZoom()
    setLocalPath('')
    setPercent(null)
    setErrMsg('')
    setImgLoaded(false)
    preloadNeighbors(list, n)
  }

  const currentItem: GalleryImage | undefined = list[idx]
  const viewSrc = process.env.TARO_ENV === 'weapp' ? localPath : displaySrc(currentItem)
  const isTextOnly = !!currentItem && !currentItem.src && !currentItem.fileID && !!currentItem.text

  // ---------- 手势 ----------
  const onTouchStart = (e: any) => {
    const arr = Array.prototype.slice.call(e.touches || []) as Array<{ clientX: number; clientY: number }>
    if (arr.length >= 2) {
      gesture.current.mode = 'pinch'
      gesture.current.baseDist = touchDist(arr[0], arr[1])
      gesture.current.baseScale = scale
      return
    }
    const p = arr[0]
    if (!p) return
    gesture.current.mode = scale > 1.02 ? 'pan' : 'swipe'
    gesture.current.startX = p.clientX
    gesture.current.startY = p.clientY
    gesture.current.baseTx = tx
    gesture.current.baseTy = ty
    gesture.current.dx = 0
    gesture.current.dy = 0
  }

  const onTouchMove = (e: any) => {
    const arr = Array.prototype.slice.call(e.touches || []) as Array<{ clientX: number; clientY: number }>
    const g = gesture.current
    if (arr.length >= 2 && (g.mode === 'pinch' || g.mode === 'pan')) {
      g.mode = 'pinch'
      const dist = touchDist(arr[0], arr[1])
      const next = clamp((dist / (g.baseDist || 1)) * g.baseScale, 1, 4)
      setScale(next)
      return
    }
    if (arr.length === 1) {
      const p = arr[0]
      if (g.mode === 'pan') {
        const { w, h } = WINDOW()
        const nx = g.baseTx + (p.clientX - g.startX)
        const ny = g.baseTy + (p.clientY - g.startY)
        const boundX = (scale - 1) * w * 0.6
        const boundY = (scale - 1) * h * 0.6
        setTx(clamp(nx, -boundX, boundX))
        setTy(clamp(ny, -boundY, boundY))
      } else if (g.mode === 'swipe') {
        g.dx = p.clientX - g.startX
        g.dy = p.clientY - g.startY
      }
    }
  }

  const onTouchEnd = () => {
    const g = gesture.current
    if (g.mode === 'swipe') {
      const { dx, dy } = g
      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        switchTo(idx + (dx < 0 ? 1 : -1))
      }
    }
    if (g.mode === 'pinch') {
      if (scale < 1.12) {
        setScale(1)
        setTx(0)
        setTy(0)
      }
    }
    gesture.current = { mode: '', baseDist: 0, baseScale: 1, startX: 0, startY: 0, baseTx: 0, baseTy: 0, dx: 0, dy: 0 }
  }

  const retryLoad = () => {
    setErrMsg('')
    setRetryTick((t) => t + 1)
  }

  const saveCurrent = () => {
    const it = currentItem
    if (!it) return
    saveGalleryImage({ fileID: it.fileID, src: process.env.TARO_ENV === 'weapp' && localPath ? localPath : it.src }).catch(
      () => {
        /* 用户取消 / 授权失败时静默（toast 已提示） */
      }
    )
  }

  // 原生主通道成功时无需渲染任何内容（系统层预览覆盖）
  if (!visible || phase === 'native' || phase === 'idle') return null

  // ---------- 自研降级全屏浏览 ----------
  return (
    <View className={styles.mask} catchMove>
      <View className={styles.header}>
        <Text className={styles.headerName}>{currentItem?.name || '图片预览'}</Text>
        <View className={styles.closeBtn} onClick={onClose}>
          <Text className={styles.closeIcon}>✕</Text>
        </View>
      </View>

      <View
        className={styles.stage}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {isTextOnly ? (
          <View className={styles.textPanel}>
            <Text className={styles.textBody}>{currentItem?.text}</Text>
            <Text className={styles.textHint}>该记录为历史文本材料，无云存储图片</Text>
          </View>
        ) : viewSrc ? (
          <View
            className={styles.imgWrap}
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          >
            <Image
              className={styles.bigImg}
              src={viewSrc}
              mode="aspectFit"
              onLoad={() => {
                setImgLoaded(true)
                setLoading(false)
              }}
              onError={() => {
                setImgLoaded(false)
                if (process.env.TARO_ENV !== 'weapp') {
                  setErrMsg('图片加载失败')
                }
                console.error('[ImageGallery] 大图显示失败', displaySrc(currentItem).slice(0, 120))
              }}
            />
          </View>
        ) : null}

        {errMsg ? (
          <View className={styles.errorOverlay}>
            <Text className={styles.errorIcon}>🖼️</Text>
            <Text className={styles.errorText}>{errMsg}</Text>
            <View className={styles.errorActions}>
              <View className={styles.errorBtn} onClick={retryLoad}>
                <Text className={styles.errorBtnText}>重新加载</Text>
              </View>
            </View>
          </View>
        ) : null}

        {loading && !errMsg && !imgLoaded ? (
          <View className={styles.loadingOverlay}>
            <Text className={styles.loadingIcon}>⏳</Text>
            <Text className={styles.loadingText}>
              {percent != null ? `图片加载中… ${percent}%` : '图片加载中…'}
            </Text>
          </View>
        ) : null}
      </View>

      <View className={styles.footer}>
        <View className={styles.counter}>
          <Text className={styles.counterText}>
            {idx + 1} / {Math.max(list.length, 1)}
          </Text>
        </View>
        <View className={styles.footerActions}>
          <View className={styles.footerBtn} onClick={resetZoom}>
            <Text className={styles.footerBtnText}>{scale > 1.02 ? '还原' : '放大'}</Text>
          </View>
          <View className={styles.footerBtn} onClick={saveCurrent}>
            <Text className={styles.footerBtnText}>保存图片</Text>
          </View>
        </View>
        {scale > 1.02 ? (
          <Text className={styles.gestureHint}>双指缩放 · 单指拖动 · 还原后左右滑动切换</Text>
        ) : (
          <Text className={styles.gestureHint}>左右滑动切换 · 双指缩放</Text>
        )}
      </View>
    </View>
  )
}
